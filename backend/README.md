# Backend services

The backend part of the home assignment (`REQUIREMENTS.pdf`). These are two NestJS microservices and a
Go report service, run together with MongoDB and Redis through Docker Compose:

- **Service A, `images`**: fetches a large dataset from the [NASA Image and Video Library](https://images.nasa.gov) in code, saves it as JSON and XLSX, imports either file into MongoDB and searches it.
- **Service B, `logs`**: stores every action and event of A as a log, serves the logs with filters and returns a PDF activity report.
- **`report`** (Go, gRPC): renders that PDF with charts from the RedisTimeSeries data that B sends it.

## Run

Requires **Docker Desktop** with Linux containers. From `backend/`:

```bash
docker compose up --build
```

| URL                        | What                                             |
| -------------------------- | ------------------------------------------------ |
| http://localhost:3000/docs | Swagger UI of `images` (A); JSON at `/docs-json` |
| http://localhost:3001/docs | Swagger UI of `logs` (B); JSON at `/docs-json`   |
| `localhost:50051`          | gRPC `report.v1.ActivityReportService`           |

A typical walk-through in Swagger or with curl:

```bash
curl -X POST localhost:3000/dataset/fetch                       # ~20,000 records, about a minute
curl -o nasa-images.json localhost:3000/dataset/files/json      # or /xlsx
curl -F "file=@nasa-images.json" localhost:3000/images/import   # streams + upserts
curl "localhost:3000/images?q=apollo&limit=5"                   # then pass nextCursor as cursor
curl "localhost:3001/logs?level=warn"
curl -o report.pdf localhost:3001/reports/activity              # last 24 hours
```

**Local development** (Node `^24.15.0` or `>=26`, npm 11) runs the Nest apps on the host and the
rest in Docker:

```bash
npm ci
cp .env.example .env
docker compose up -d mongo redis report
npm run start:images     # and/or npm run start:logs, both with --watch
```

Checks: `npm run typecheck` (the rspack build does not type-check), `npm run build`,
`npm run format:check`. Go and `protoc` are only needed inside Docker. The Go build runs `gofmt -l`
and `go vet` as gates, and `go.sum` is refreshed without a local Go by:

```bash
docker build -f report/Dockerfile --target modules --output type=local,dest=report .
```

## Stack

- **NestJS 12** (`@nestjs/core` 12.1, `microservices`, `swagger` 12.0, `config` 12.0) on Node 24.
  It is a monorepo with two apps and shared libs, built with the CLI's rspack builder.
  - The output is CommonJS, which loads the ESM-only Nest 12 packages through Node's `require(esm)`. This is the Nest 12 template default.
- **TypeScript 6.0**, not 7: `@nestjs/cli` and `@nestjs/swagger` 12 only accept TypeScript `^5 || ^6`. `strict` plus the frontend's extra flags.
- **Official drivers**: `mongodb` 7.7 and `redis` 6.3, whose TimeSeries commands come from `@redis/time-series`. The services use nothing else for data access.
- **Nest Redis transporter** for A → B messaging. It uses `ioredis` internally, because Nest's transporter cannot use node-redis.
- **Files**: `exceljs` 4.4 (streaming writer and reader), `stream-json` 3.7 (streaming JSON array parser), `busboy` (streaming multipart).
- **Go 1.27 report service**: `google.golang.org/grpc` 1.84, `gonum/plot` 0.17 for the charts, `maroto/v2` 2.4 for the PDF. The protobuf code is generated in the Docker build.
- **Images**: `mongo:8.0`, `redis:8.10` (TimeSeries bundled), `node:24-slim`, distroless for Go.

## Architecture

```
backend/
  compose.yaml  Dockerfile (Nest apps, ARG APP)  .env.example
  proto/report/v1/activity_report.proto     gRPC contract B → report
  libs/                                     shared code, imported as @app/<lib>/<file>
    common/    type guards (isRecord, isOneOf), errorMessage, parseZonedDate, raceStreamError
    config/    SharedEnvironment + validateEnvironment (class-validator)
    mongo/     MongoModule (official driver), the one keyset page query
    redis/     RedisModule (official node-redis client)
    activity/  event contract, type guard, transport options, time-series schema
    http/      configureHttpApp (validation, Swagger, shutdown hooks), cursor DTOs, date range
  apps/images/src/                          Service A
    activity/  ActivityInterceptor → ActivityRecorder → TS.ADD + publish
    dataset/   NASA client (retry), fetcher (worker pool), JSON/XLSX writer, controller
    images/    importer (busboy → JSON/XLSX row streams → validator → batches), repository
  apps/logs/src/                            Service B
    logs/      event subscriber, repository, query controller
    reports/   ActivityReports (range rules, bucket), time-series reader (TS.MRANGE), gRPC client,
               controller; gen/ = TS types generated from the proto (gitignored)
  report/                                   Go service
    cmd/report/          gRPC server, health, reflection, graceful stop
    internal/report/     validation, KPIs and route table, chart specs
    internal/charts/     gonum/plot → PNG
    internal/pdf/        maroto A4 layout
```

| Service  | Port  | Talks to                                            |
| -------- | ----- | --------------------------------------------------- |
| `images` | 3000  | MongoDB `images` db, Redis (TS + publish)           |
| `logs`   | 3001  | MongoDB `logs` db, Redis (subscribe + TS), `report` |
| `report` | 50051 | nothing; it only renders what it is sent            |
| `mongo`  | 27017 | (published on 127.0.0.1 only)                       |
| `redis`  | 6379  | (published on 127.0.0.1 only)                       |

The two Nest apps and `report` restart automatically (`restart: unless-stopped`).

Event flow: `HTTP request → ActivityInterceptor (on response close) → ActivityRecorder →
TS.ADD (RedisTimeSeries) + emit 'activity.event' (Redis pub/sub) → B validates → logs collection`.
Domain events such as `images.batch.upserted` take the same path from `ActivityRecorder`. Callers
never await the recorder, so a Redis outage never fails or slows an API call; the recorder logs a warning instead.
A request the client abandons before the response is recorded with status **499** (client closed request).

Conventions:

- Interfaces with `readonly` fields and string-literal unions, no enums, no barrels.
- External shapes carry a `Dto` suffix and go through a pure mapper.
- Files are named for what they hold; Nest keeps its `*.module.ts` / `*.controller.ts` suffixes.
- Config is validated at startup and read only through a typed `ConfigService`.

## Dataset fetch

`POST /dataset/fetch` (optional body `{ queries?, target? }`) runs synchronously and returns a summary.
It has per-query hits, pages fetched or failed, new records, the files and their sizes. A second
call while one runs gets **409**.

- **Queries** come from `NASA_FETCH_QUERIES` (12 space topics by default) and run in order. For each one, page 1 gives `total_hits`, then pages 2..n go through a pool of `NASA_FETCH_CONCURRENCY` (4) parallel requests with `page_size` 100.
- **The NASA cap**: a query only reaches `page × page_size ≤ 10,000` results, so the last page is `min(ceil(hits / 100), 100)`. The cap error (HTTP 400 "Maximum number of search results") also ends a query.
- **Retry**: 2 retries with 400 ms exponential backoff, on network errors, timeouts (15 s) and 429/502/503/504. This is the frontend's retry policy, plus `Retry-After` (capped at 10 s). A page that still fails is counted in `pagesFailed` and skipped, so the run continues.
- **Deduplication** by `nasaId` across queries. The run stops at exactly `NASA_FETCH_TARGET` (20,000) unique records.
- **Files**: `nasa-images.json` (one array, written record by record with backpressure) and `nasa-images.xlsx`. The XLSX uses the ExcelJS streaming writer, a bold frozen header and inline strings. Both are written as `.tmp` and renamed on success, so a failed run keeps the previous files.
- Measured: 20,000 records from 3 queries in **57 s**, 0 failed pages. The JSON is 20 MB and the XLSX 4.6 MB.

`GET /dataset/files/json|xlsx` streams the last files as downloads.

## Import

`POST /images/import` takes a multipart `file` (`.json` or `.xlsx`, at most `UPLOAD_MAX_MB` = 100 MB).

- **Streaming end to end**: busboy reads the request, and `stream-json` (JSON array) or the ExcelJS streaming reader (XLSX, first sheet, columns matched by header text) yields one row at a time. Nothing holds the whole file.
- **Validation per row**: `nasaId`, `title` and `dateCreated` are required; a text `dateCreated` needs a zone, as in the query parameters below, while an XLSX date cell is taken as is. Optional strings may be null, `keywords` is a list or a `"; "`-joined string, and URLs must be http(s). Invalid rows are counted and listed with their position (first 100 errors), and the import continues.
- **Batched, idempotent upserts**: batches of `IMPORT_BATCH_SIZE` (500) go to an unordered `bulkWrite` of `updateOne … upsert` keyed by `_id = nasaId`. Awaiting each batch is the backpressure, so the upload is not read further while MongoDB writes. `$set` holds only record fields, so re-importing the same data reports `unchanged`, not `modified`. Per-document write errors are reported in `failed`; anything else fails the request.
- **Unreadable uploads** (broken JSON, missing XLSX columns, a cut-off multipart body, a client disconnect, over the size limit) stop the import. The response is **400** (**413** for size) with the partial report and `status: "aborted"`. Batches written before the break stay, which is safe because the import is idempotent.
- Measured with the 20,000-record JSON: first import **4.1 s**, re-import 0.7 s (`unchanged: 20000`). An XLSX import over the same data takes 1.0 s.

## Search

`GET /images?q=&center=&keyword=&from=&to=&limit=&cursor=`, newest first. Here and in the logs and report
APIs, `from`/`to` are a date (`2026-10-08`, read as UTC midnight) or a date-time with a zone
(`2026-10-08T10:00:00Z`, `…+02:00`, with `+` encoded as `%2B` in a URL). A date-time without a zone would depend on the process time
zone, so it gives 400, as do week dates (`2026-W41`) and `from >= to`.

| Index                                          | Serves                               |
| ---------------------------------------------- | ------------------------------------ |
| `_id` (= NASA id)                              | idempotent upserts, cursor tie-break |
| text `title`×10, `keywords`×5, `description`×1 | `q`                                  |
| `{dateCreated: -1, _id: -1}`                   | unfiltered pages, date ranges        |
| `{center: 1, dateCreated: -1, _id: -1}`        | `center` (+ date)                    |
| `{keywords: 1, dateCreated: -1, _id: -1}`      | `keyword` (+ date)                   |

**Keyset pagination**: the cursor is base64url `{v: <dateCreated>, id: <_id>}`. The next page is
`dateCreated < v OR (dateCreated = v AND _id < id)`. It reads `limit + 1` documents to know whether
more exist, with no count and no `skip`, so page 1,000 costs the same as page 1. A `center` page of
20 examines 21 index keys and 21 documents (`explain`). An invalid cursor gives 400.

## Activity events and time series

A sends two kinds of events (`libs/activity/src/activity-event.ts`), both with `id`, `source` and `occurredAt`:

- `api-request`: method, route template (`/images`, never the raw URL), status, duration, outcome (`success` / `client-error` / `server-error`).
- `domain-event`: one of `dataset.page.fetched`, `dataset.fetch.completed`, `dataset.fetch.failed`, `images.batch.upserted`, `images.records.rejected`, `images.import.completed` or `images.import.failed`, with a numeric `value` (e.g. records upserted) and attributes.

| Series key                                         | Labels                                     | Value, duplicate policy |
| -------------------------------------------------- | ------------------------------------------ | ----------------------- |
| `activity:api:requests:<METHOD> <route>:<outcome>` | `source metric=api_requests route outcome` | 1, `SUM`                |
| `activity:api:latency:<METHOD> <route>`            | `source metric=api_latency_ms route`       | duration ms, `MAX`      |
| `activity:domain:<name>`                           | `source metric=domain_events name`         | event value, `SUM`      |

Series are created by the first `TS.ADD … LABELS` and kept for **30 days** (`RETENTION`). To try:

```bash
docker compose exec redis redis-cli TS.QUERYINDEX source=images
docker compose exec redis redis-cli TS.MRANGE - + AGGREGATION sum 3600000 FILTER metric=api_requests GROUPBY route REDUCE sum
```

## Logs API

B subscribes to `activity.event`, checks each payload with a type guard and stores it with
`_id = event id`, so a redelivered event is stored once. Each log gets a `type` (`"<METHOD> <route>"`
or the event name) and a `level`: 5xx and `*.failed` are `error`, 4xx and `images.records.rejected`
are `warn`, everything else is `info`.

- `GET /logs?from=&to=&kind=&type=&level=&limit=&cursor=`: newest first, with the same keyset cursor as the search. Each filter has a compound index `{<filter>: 1, occurredAt: -1, _id: -1}`.
- `GET /logs/types`: every type with its count, to discover filter values.

## PDF report

`GET /reports/activity?from=&to=` (default: the last 24 hours, at most 30 days) returns
`activity-report-<from>-<to>.pdf`.

1. B picks a bucket size giving at most 60 points (1 minute … 12 hours) and runs five `TS.MRANGE … AGGREGATION … GROUPBY … REDUCE` queries aligned to `from`:
   - requests by route
   - requests by outcome
   - average latency by route
   - maximum latency by route
   - domain events by name
2. B sends the series to `report` in one `RenderActivityReport` call (`proto/report/v1/activity_report.proto`) with a 10 s gRPC deadline; a 30-day report renders in about 0.3 s. The Go service checks the call context between charts, so a cancelled or expired call stops rendering. The TypeScript message types are generated from the same proto (`npm run generate:proto`, run before `typecheck` and `start:logs`, and in the Docker build, which type-checks against them before bundling).
3. The Go service validates the request (`InvalidArgument` → 400), fills count series with zeros on the bucket grid, and computes the KPIs and the route table.
4. It draws four 300 dpi charts with gonum/plot. Each has a title, `Time (UTC)` and y-axis labels, and a legend in its own column:
   - API requests per bucket by route: lines
   - responses by outcome: stacked bars
   - average latency by route: lines, with gaps where a route had no requests
   - dataset and import activity: grouped bars
5. It lays them out with maroto on A4:
   - header with range, bucket size and generation time
   - four KPI boxes: requests, error rate, request-weighted average latency, records upserted
   - the charts with captions
   - the route table (requests, avg ms, max ms)
   - "Page n of m"

   An empty range renders "No data in this range" placeholders.

The report service stopped, unreachable or past the 10 s deadline → **503**; any other gRPC failure → 502. Both bodies carry a fixed message; the gRPC details, which can include internal addresses or library errors, go to the logs of B and `report`. The Go API on its own:

```bash
docker run --rm --network lumana-backend_default fullstorydev/grpcurl -plaintext report:50051 list
```

## Decisions and trade-offs

- **Go only renders.** B owns data access and sends typed series, so the time-series schema (`libs/activity/src/activity-series.ts`) lives in one language. The cost: the Go API is not usable without a caller that has the data.
- **The fetch is synchronous**: simpler, and the response is the summary. About a minute at the defaults; a job API with a status endpoint would suit much larger targets.
- **`nasaId` as `_id`** makes the primary key the idempotency key and the cursor tie-breaker, with no extra unique index.
- **Text search sorts by date, not relevance**: a keyset cursor over `textScore` is not stable.
- **Protobuf code is generated, not committed.** The Go code is generated in the Docker build, so no local Go or protoc is needed. The TypeScript message types come from `npm run generate:proto` (proto-loader-gen-types, no protoc) into the gitignored `apps/logs/src/reports/gen`.
- **Compose `environment` overrides** hosts, ports and `DATA_DIR`; an optional `.env` supplies only the tunables.
- **Apps are named for what they hold** (`images`, `logs`), not `service-a` / `service-b`.

## Limits

- Redis pub/sub is **at-most-once**. Events A emits while B is down, or while B reconnects after a Redis restart (both transporter sides retry every second, indefinitely), are missing from the logs, but they are still counted in the time series. Verified by stopping `logs`: 3 requests answered 200, appeared in `TS.RANGE` and not in `/logs`.
- The Nest Redis transporter uses `ioredis`. All other Redis access, the time series included, uses the official `redis` client.
- Text search (`q`) filters with the text index and then sorts in memory, which is fine for tens of thousands of records. Millions would need Atlas Search or a relevance mode with offset pagination.
- **XLSX round trip**: some records come back from the XLSX different from the JSON, so re-importing the XLSX after the JSON reports them as `modified`. How many depends on the data: 97 of 20,000 (0.5 %) for the default queries, 108 of 800 (13.5 %) for the query `hubble`, whose descriptions carry a lot of HTML-escaped text. The causes:
  - The ExcelJS 4.4 streaming reader decodes XML entities in inline strings twice, so literal entity text in NASA descriptions (`&quot;`, `&amp;`) comes back as `"` and `&`. The written file is correct. Shared strings avoid the double decoding, but the streaming reader then returns unresolved string references, because the streaming writer puts `sharedStrings.xml` after the sheet.
  - XML cannot hold some control characters, and they are dropped.
  - Cells are cut at Excel's 32,767-character limit.
- A truncated JSON upload loses the few rows the parser had buffered when it hit the break. Those rows are not imported and not counted.
- Requests to unmatched routes (404) are not recorded, because the interceptor only sees routed requests.
- If the `report` container is stopped, B answers 503 after the 10 s gRPC deadline rather than at once.
- No auth, no rate limiting. No automated tests, because the assignment does not ask for them.
