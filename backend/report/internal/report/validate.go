package report

import (
	"errors"
	"fmt"

	"lumana/report/gen/reportv1"
)

const (
	maxBuckets         = 2000
	maxSeriesPerField  = 100
	maxPointsPerSeries = 5000
	// bounds keep millisecond arithmetic within int64 and one bucket within time.Duration
	maxTimestampMs = 253402300799999 // 9999-12-31T23:59:59.999Z
	maxBucketMs    = 366 * 24 * 60 * 60 * 1000
)

type namedSeries struct {
	field  string
	series []*reportv1.Series
}

func validate(req *reportv1.RenderActivityReportRequest) error {
	if req.GetFromMs() < 0 || req.GetToMs() > maxTimestampMs {
		return errors.New("from_ms and to_ms must lie between 1970 and the year 9999")
	}
	if req.GetBucketMs() <= 0 || req.GetBucketMs() > maxBucketMs {
		return fmt.Errorf("bucket_ms must be between 1 and %d", int64(maxBucketMs))
	}
	if req.GetFromMs() >= req.GetToMs() {
		return errors.New("from_ms must be before to_ms")
	}
	if (req.GetToMs()-req.GetFromMs())/req.GetBucketMs() > maxBuckets {
		return fmt.Errorf("the range spans more than %d buckets", maxBuckets)
	}
	fields := []namedSeries{
		{"requests_by_route", req.GetRequestsByRoute()},
		{"requests_by_outcome", req.GetRequestsByOutcome()},
		{"avg_latency_by_route", req.GetAvgLatencyByRoute()},
		{"max_latency_by_route", req.GetMaxLatencyByRoute()},
		{"domain_events_by_name", req.GetDomainEventsByName()},
	}
	for _, field := range fields {
		if len(field.series) > maxSeriesPerField {
			return fmt.Errorf("%s has more than %d series", field.field, maxSeriesPerField)
		}
		for _, series := range field.series {
			if series.GetLabel() == "" {
				return fmt.Errorf("%s has a series without a label", field.field)
			}
			if len(series.GetPoints()) > maxPointsPerSeries {
				return fmt.Errorf("%s series %q has more than %d points", field.field, series.GetLabel(), maxPointsPerSeries)
			}
		}
	}
	return nil
}
