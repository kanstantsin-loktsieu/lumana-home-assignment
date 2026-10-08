package report

import (
	"math"
	"sort"

	"lumana/report/gen/reportv1"
)

type routeRow struct {
	route    string
	requests float64
	// both are NaN when the route has no latency samples
	avgMs float64
	maxMs float64
}

type summary struct {
	totalRequests   float64
	errorRequests   float64
	avgLatencyMs    float64 // request-weighted; NaN without samples
	recordsUpserted float64
	routes          []routeRow
}

func sumPoints(points []*reportv1.Point) float64 {
	total := 0.0
	for _, point := range points {
		total += point.GetValue()
	}
	return total
}

func pointsByLabel(series []*reportv1.Series) map[string][]*reportv1.Point {
	byLabel := make(map[string][]*reportv1.Point, len(series))
	for _, s := range series {
		byLabel[s.GetLabel()] = s.GetPoints()
	}
	return byLabel
}

func summarize(req *reportv1.RenderActivityReportRequest) summary {
	result := summary{avgLatencyMs: math.NaN()}
	for _, series := range req.GetRequestsByOutcome() {
		total := sumPoints(series.GetPoints())
		result.totalRequests += total
		if series.GetLabel() != "success" {
			result.errorRequests += total
		}
	}
	for _, series := range req.GetDomainEventsByName() {
		if series.GetLabel() == "images.batch.upserted" {
			result.recordsUpserted += sumPoints(series.GetPoints())
		}
	}

	avgByRoute := pointsByLabel(req.GetAvgLatencyByRoute())
	maxByRoute := pointsByLabel(req.GetMaxLatencyByRoute())
	var weightedSum, weight float64
	for _, series := range req.GetRequestsByRoute() {
		row := routeRow{route: series.GetLabel(), requests: sumPoints(series.GetPoints()), avgMs: math.NaN(), maxMs: math.NaN()}

		// weight each bucket's average latency by that bucket's request count
		requestsAt := make(map[int64]float64, len(series.GetPoints()))
		for _, point := range series.GetPoints() {
			requestsAt[point.GetTimestampMs()] = point.GetValue()
		}
		var routeSum, routeWeight float64
		for _, point := range avgByRoute[row.route] {
			if n := requestsAt[point.GetTimestampMs()]; n > 0 {
				routeSum += point.GetValue() * n
				routeWeight += n
			}
		}
		if routeWeight > 0 {
			row.avgMs = routeSum / routeWeight
			weightedSum += routeSum
			weight += routeWeight
		}
		for _, point := range maxByRoute[row.route] {
			if math.IsNaN(row.maxMs) || point.GetValue() > row.maxMs {
				row.maxMs = point.GetValue()
			}
		}
		if row.requests > 0 {
			result.routes = append(result.routes, row)
		}
	}
	if weight > 0 {
		result.avgLatencyMs = weightedSum / weight
	}
	sort.SliceStable(result.routes, func(i, j int) bool {
		return result.routes[i].requests > result.routes[j].requests
	})
	return result
}
