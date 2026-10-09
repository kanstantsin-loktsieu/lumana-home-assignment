package report

import (
	"context"
	"fmt"
	"image/color"
	"log"
	"math"
	"sort"
	"strconv"
	"strings"
	"time"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"lumana/report/gen/reportv1"
	"lumana/report/internal/charts"
	"lumana/report/internal/pdf"
)

// only renders: the caller owns the data
type Server struct {
	reportv1.UnimplementedActivityReportServiceServer
}

func NewServer() *Server {
	return &Server{}
}

type outcomeStyle struct {
	label string
	color color.Color
}

// outcomes in stacking order, bottom to top
var outcomes = []outcomeStyle{
	{"success", color.RGBA{R: 0x2c, G: 0xa0, B: 0x2c, A: 0xff}},
	{"client-error", color.RGBA{R: 0xff, G: 0x9f, B: 0x1c, A: 0xff}},
	{"server-error", color.RGBA{R: 0xd6, G: 0x27, B: 0x28, A: 0xff}},
}

func (s *Server) RenderActivityReport(ctx context.Context, req *reportv1.RenderActivityReportRequest) (*reportv1.RenderActivityReportResponse, error) {
	if err := validate(req); err != nil {
		return nil, status.Error(codes.InvalidArgument, err.Error())
	}
	g := newGrid(req)
	sum := summarize(req)

	chartCaptions := []struct {
		chart   charts.Chart
		caption string
	}{
		{
			charts.Chart{Title: "API requests per " + strings.TrimPrefix(humanDuration(g.bucket), "1 "), YLabel: "Requests", Kind: charts.Lines, Series: gridSeries(g, req.GetRequestsByRoute(), 0)},
			"Handled HTTP requests of the images service per bucket, one line per route.",
		},
		{
			charts.Chart{Title: "Responses by outcome", YLabel: "Responses", Kind: charts.StackedBars, Series: outcomeSeries(g, req.GetRequestsByOutcome())},
			"Success (< 400), client errors (4xx) and server errors (5xx), stacked per bucket.",
		},
		{
			charts.Chart{Title: "Average latency by route (ms)", YLabel: "Latency (ms)", Kind: charts.Lines, Series: gridSeries(g, req.GetAvgLatencyByRoute(), math.NaN())},
			"Mean response time per bucket; gaps are buckets without requests on that route.",
		},
		{
			charts.Chart{Title: "Dataset and import activity", YLabel: "Count", Kind: charts.GroupedBars, Series: gridSeries(g, req.GetDomainEventsByName(), 0)},
			"Domain events per bucket: records fetched per page, upserted per batch, rejected, and completed runs.",
		},
	}
	rendered := make([]pdf.Chart, 0, len(chartCaptions))
	for _, item := range chartCaptions {
		if err := ctx.Err(); err != nil {
			return nil, status.FromContextError(err).Err()
		}
		item.chart.Times = g.times()
		item.chart.Bucket = g.bucket
		png, err := charts.Render(item.chart)
		if err != nil {
			return nil, internalError(fmt.Errorf("render chart %q: %w", item.chart.Title, err))
		}
		rendered = append(rendered, pdf.Chart{PNG: png, Caption: item.caption})
	}

	if err := ctx.Err(); err != nil {
		return nil, status.FromContextError(err).Err()
	}
	from := time.UnixMilli(req.GetFromMs()).UTC()
	to := time.UnixMilli(req.GetToMs()).UTC()
	document, err := pdf.Render(pdf.Report{
		Title:     "Activity report: images service",
		Range:     fmt.Sprintf("%s to %s UTC", from.Format("2006-01-02 15:04"), to.Format("2006-01-02 15:04")),
		Bucket:    humanDuration(g.bucket),
		Generated: time.Now().UTC().Format("2006-01-02 15:04 UTC"),
		KPIs:      kpis(sum),
		Charts:    rendered,
		Routes:    routeRows(sum.routes),
	})
	if err != nil {
		return nil, internalError(fmt.Errorf("render pdf: %w", err))
	}
	return &reportv1.RenderActivityReportResponse{Pdf: document}, nil
}

// library errors stay in the log; the caller gets a fixed message
func internalError(err error) error {
	log.Printf("render failed: %v", err)
	return status.Error(codes.Internal, "render failed")
}

// `empty` is 0 for counts and NaN where missing buckets should show as gaps
func gridSeries(g grid, series []*reportv1.Series, empty float64) []charts.Series {
	result := make([]charts.Series, 0, len(series))
	for _, s := range series {
		result = append(result, charts.Series{Label: s.GetLabel(), Values: g.values(s.GetPoints(), empty)})
	}
	return result
}

func outcomeSeries(g grid, series []*reportv1.Series) []charts.Series {
	result := gridSeries(g, series, 0)
	rank := func(label string) int {
		for i, outcome := range outcomes {
			if outcome.label == label {
				return i
			}
		}
		return len(outcomes)
	}
	for i := range result {
		if r := rank(result[i].Label); r < len(outcomes) {
			result[i].Color = outcomes[r].color
		}
	}
	sort.SliceStable(result, func(i, j int) bool { return rank(result[i].Label) < rank(result[j].Label) })
	return result
}

func kpis(sum summary) []pdf.KPI {
	errorRate := "n/a"
	if sum.totalRequests > 0 {
		errorRate = fmt.Sprintf("%.1f %%", 100*sum.errorRequests/sum.totalRequests)
	}
	return []pdf.KPI{
		{Label: "Requests", Value: formatCount(sum.totalRequests)},
		{Label: "Error rate", Value: errorRate},
		{Label: "Avg latency", Value: formatMs(sum.avgLatencyMs)},
		{Label: "Records upserted", Value: formatCount(sum.recordsUpserted)},
	}
}

func routeRows(routes []routeRow) []pdf.RouteRow {
	rows := make([]pdf.RouteRow, 0, len(routes))
	for _, r := range routes {
		rows = append(rows, pdf.RouteRow{
			Route:    r.route,
			Requests: formatCount(r.requests),
			AvgMs:    formatMs(r.avgMs),
			MaxMs:    formatMs(r.maxMs),
		})
	}
	return rows
}

func formatCount(value float64) string {
	digits := strconv.FormatInt(int64(math.Round(value)), 10)
	var out []byte
	for i := range len(digits) {
		if i > 0 && (len(digits)-i)%3 == 0 && digits[i-1] != '-' {
			out = append(out, ',')
		}
		out = append(out, digits[i])
	}
	return string(out)
}

func formatMs(value float64) string {
	if math.IsNaN(value) {
		return "n/a"
	}
	return fmt.Sprintf("%.1f ms", value)
}

func humanDuration(d time.Duration) string {
	switch {
	case d%(24*time.Hour) == 0:
		return pluralize(int(d/(24*time.Hour)), "day")
	case d%time.Hour == 0:
		return pluralize(int(d/time.Hour), "hour")
	default:
		return pluralize(int(d/time.Minute), "minute")
	}
}

func pluralize(n int, unit string) string {
	if n == 1 {
		return "1 " + unit
	}
	return fmt.Sprintf("%d %ss", n, unit)
}
