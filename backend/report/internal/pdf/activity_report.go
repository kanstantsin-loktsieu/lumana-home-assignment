package pdf

import (
	"fmt"

	"github.com/johnfercher/maroto/v2"
	"github.com/johnfercher/maroto/v2/pkg/components/col"
	"github.com/johnfercher/maroto/v2/pkg/components/image"
	"github.com/johnfercher/maroto/v2/pkg/components/row"
	"github.com/johnfercher/maroto/v2/pkg/components/text"
	"github.com/johnfercher/maroto/v2/pkg/config"
	"github.com/johnfercher/maroto/v2/pkg/consts/align"
	"github.com/johnfercher/maroto/v2/pkg/consts/border"
	"github.com/johnfercher/maroto/v2/pkg/consts/extension"
	"github.com/johnfercher/maroto/v2/pkg/consts/fontstyle"
	"github.com/johnfercher/maroto/v2/pkg/consts/pagesize"
	"github.com/johnfercher/maroto/v2/pkg/core"
	"github.com/johnfercher/maroto/v2/pkg/props"
)

type KPI struct {
	Label string
	Value string
}

type Chart struct {
	PNG     []byte
	Caption string
}

type RouteRow struct {
	Route    string
	Requests string
	AvgMs    string
	MaxMs    string
}

// built-in PDF fonts only, so all text must be ASCII
type Report struct {
	Title     string
	Range     string
	Bucket    string
	Generated string
	KPIs      []KPI
	Charts    []Chart
	Routes    []RouteRow
}

const (
	margin = 15.0
	// 180 mm content width at the chart's 17:7.5 aspect ratio
	chartHeight = 80.0
)

var (
	muted       = &props.Color{Red: 100, Green: 100, Blue: 100}
	rule        = &props.Color{Red: 210, Green: 210, Blue: 210}
	panel       = &props.Color{Red: 245, Green: 247, Blue: 250}
	accent      = &props.Color{Red: 31, Green: 119, Blue: 180}
	tableHead   = &props.Color{Red: 230, Green: 236, Blue: 243}
	tableStripe = &props.Color{Red: 248, Green: 248, Blue: 248}
)

func Render(report Report) ([]byte, error) {
	cfg := config.NewBuilder().
		WithPageSize(pagesize.A4).
		WithLeftMargin(margin).
		WithTopMargin(margin).
		WithRightMargin(margin).
		WithBottomMargin(margin).
		WithTitle(report.Title, false).
		WithCreator("lumana report service", false).
		WithPageNumber(props.PageNumber{Pattern: "Page {current} of {total}", Place: props.RightBottom, Size: 8, Color: muted}).
		Build()
	m := maroto.New(cfg)

	m.AddRows(header(report)...)
	m.AddRows(kpiRow(report.KPIs), row.New(6))
	for _, chart := range report.Charts {
		m.AddRows(
			image.NewFromBytesRow(chartHeight, chart.PNG, extension.Png, props.Rect{Center: true, Percent: 100}),
			text.NewRow(10, chart.Caption, props.Text{Size: 8, Color: muted, Align: align.Center, Top: 1}),
		)
	}
	m.AddRows(routeTable(report.Routes)...)

	document, err := m.Generate()
	if err != nil {
		return nil, fmt.Errorf("generate pdf: %w", err)
	}
	return document.GetBytes(), nil
}

func header(report Report) []core.Row {
	return []core.Row{
		text.NewRow(10, report.Title, props.Text{Size: 18, Style: fontstyle.Bold, Color: accent}),
		text.NewRow(6, report.Range, props.Text{Size: 10}),
		row.New(6).Add(
			text.NewCol(6, "Bucket size: "+report.Bucket, props.Text{Size: 8, Color: muted}),
			text.NewCol(6, "Generated "+report.Generated, props.Text{Size: 8, Color: muted, Align: align.Right}),
		),
		row.New(4).WithStyle(&props.Cell{BorderType: border.Bottom, BorderColor: rule}),
		row.New(6),
	}
}

func kpiRow(kpis []KPI) core.Row {
	size := 12 / max(len(kpis), 1)
	cols := make([]core.Col, 0, len(kpis))
	for _, kpi := range kpis {
		cols = append(cols, col.New(size).
			Add(
				text.New(kpi.Label, props.Text{Size: 8, Color: muted, Align: align.Center, Top: 3}),
				text.New(kpi.Value, props.Text{Size: 15, Style: fontstyle.Bold, Align: align.Center, Top: 9}),
			).
			WithStyle(&props.Cell{BackgroundColor: panel, BorderType: border.Full, BorderColor: rule}))
	}
	return row.New(20).Add(cols...)
}

func routeTable(routes []RouteRow) []core.Row {
	rows := []core.Row{
		text.NewRow(10, "Requests by route", props.Text{Size: 12, Style: fontstyle.Bold, Top: 2}),
		tableRow(RouteRow{Route: "Route", Requests: "Requests", AvgMs: "Avg ms", MaxMs: "Max ms"}, fontstyle.Bold).
			WithStyle(&props.Cell{BackgroundColor: tableHead}),
	}
	if len(routes) == 0 {
		return append(rows, text.NewRow(8, "No requests in this range", props.Text{Size: 9, Color: muted, Top: 2, Left: 2}))
	}
	for i, route := range routes {
		r := tableRow(route, fontstyle.Normal)
		if i%2 == 1 {
			r = r.WithStyle(&props.Cell{BackgroundColor: tableStripe})
		}
		rows = append(rows, r)
	}
	return rows
}

func tableRow(route RouteRow, style fontstyle.Type) core.Row {
	cell := props.Text{Size: 9, Style: style, Top: 1.5, Left: 2}
	number := props.Text{Size: 9, Style: style, Top: 1.5, Right: 2, Align: align.Right}
	return row.New(7).Add(
		text.NewCol(6, route.Route, cell),
		text.NewCol(2, route.Requests, number),
		text.NewCol(2, route.AvgMs, number),
		text.NewCol(2, route.MaxMs, number),
	)
}
