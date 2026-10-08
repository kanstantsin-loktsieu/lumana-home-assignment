package report

import (
	"time"

	"lumana/report/gen/reportv1"
)

type grid struct {
	fromMs   int64
	bucketMs int64
	bucket   time.Duration
	size     int
}

// expects a validated request, so the bucket count is positive and bounded
func newGrid(req *reportv1.RenderActivityReportRequest) grid {
	span := req.GetToMs() - req.GetFromMs()
	size := (span + req.GetBucketMs() - 1) / req.GetBucketMs()
	return grid{
		fromMs:   req.GetFromMs(),
		bucketMs: req.GetBucketMs(),
		bucket:   time.Duration(req.GetBucketMs()) * time.Millisecond,
		size:     int(size),
	}
}

func (g grid) times() []time.Time {
	times := make([]time.Time, g.size)
	for i := range times {
		// milliseconds, not time.Duration: the grid may span more than Duration's 292 years
		times[i] = time.UnixMilli(g.fromMs + int64(i)*g.bucketMs).UTC()
	}
	return times
}

func (g grid) index(timestampMs int64) (int, bool) {
	offset := timestampMs - g.fromMs
	if offset < 0 {
		return 0, false
	}
	i := int(offset / g.bucketMs)
	return i, i < g.size
}

func (g grid) values(points []*reportv1.Point, empty float64) []float64 {
	values := make([]float64, g.size)
	for i := range values {
		values[i] = empty
	}
	for _, point := range points {
		if i, ok := g.index(point.GetTimestampMs()); ok {
			values[i] = point.GetValue()
		}
	}
	return values
}
