# build context: backend/, because the service needs ../proto. the Go toolchain and protoc only
# exist in these stages.

FROM golang:1.27-alpine AS codegen
RUN apk add --no-cache protoc protobuf-dev
RUN go install google.golang.org/protobuf/cmd/protoc-gen-go@v1.36.12 \
  && go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@v1.6.2
WORKDIR /src
COPY report/go.mod report/go.sum* ./
RUN go mod download
COPY proto /proto
COPY report/ ./
RUN protoc -I /proto \
  --go_out=. --go_opt=module=lumana/report \
  --go-grpc_out=. --go-grpc_opt=module=lumana/report \
  /proto/report/v1/activity_report.proto

# exports go.mod/go.sum without a local Go:
#   docker build -f report/Dockerfile --target modules --output type=local,dest=report .
FROM codegen AS tidy
RUN go mod tidy

FROM scratch AS modules
COPY --from=tidy /src/go.mod /src/go.sum /

FROM codegen AS build
RUN unformatted="$(gofmt -l ./cmd ./internal)"; \
  if [ -n "$unformatted" ]; then echo "gofmt needed:"; echo "$unformatted"; exit 1; fi
RUN go vet ./...
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/report ./cmd/report

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /out/report /report
EXPOSE 50051
ENTRYPOINT ["/report"]
