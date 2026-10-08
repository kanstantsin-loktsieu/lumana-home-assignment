package charts

import (
	"bytes"
	"fmt"
	"image/color"
	"math"
	"strconv"
	"time"

	"gonum.org/v1/plot"
	"gonum.org/v1/plot/font"
	"gonum.org/v1/plot/plotter"
	"gonum.org/v1/plot/text"
	"gonum.org/v1/plot/vg"
	"gonum.org/v1/plot/vg/draw"
	"gonum.org/v1/plot/vg/vgimg"
)

type Kind int

const (
	Lines Kind = iota
	StackedBars
	GroupedBars
)

type Series struct {
	Label  string
	Values []float64
	Color  color.Color
}

type Chart struct {
	Title  string
	YLabel string
	Kind   Kind
	Times  []time.Time
	Bucket time.Duration
	Series []Series
}

const (
	width  = 17 * vg.Centimeter
	height = 7.5 * vg.Centimeter
	dpi    = 300
	// the legend gets its own column right of the plot, so it never covers data
	maxLegendWidth = 6 * vg.Centimeter
	legendGap      = 3 * vg.Millimeter
	titleSpace     = 26
	maxXLabels     = 8
	maxMinorTicks  = 60
)

var palette = []color.Color{
	color.RGBA{R: 0x1f, G: 0x77, B: 0xb4, A: 0xff},
	color.RGBA{R: 0xff, G: 0x7f, B: 0x0e, A: 0xff},
	color.RGBA{R: 0x2c, G: 0xa0, B: 0x2c, A: 0xff},
	color.RGBA{R: 0xd6, G: 0x27, B: 0x28, A: 0xff},
	color.RGBA{R: 0x94, G: 0x67, B: 0xbd, A: 0xff},
	color.RGBA{R: 0x8c, G: 0x56, B: 0x4b, A: 0xff},
	color.RGBA{R: 0xe3, G: 0x77, B: 0xc2, A: 0xff},
	color.RGBA{R: 0x7f, G: 0x7f, B: 0x7f, A: 0xff},
	color.RGBA{R: 0xbc, G: 0xbd, B: 0x22, A: 0xff},
	color.RGBA{R: 0x17, G: 0xbe, B: 0xcf, A: 0xff},
}

var mutedText = color.Gray{Y: 0x70}

func init() {
	// sans-serif to match the PDF text; both packages copy the default at their own init
	sans := font.Font{Typeface: "Liberation", Variant: "Sans"}
	plot.DefaultFont = sans
	plotter.DefaultFont = sans
}

func Render(chart Chart) ([]byte, error) {
	p := plot.New()
	p.Title.Text = chart.Title
	p.Title.TextStyle.Font.Size = vg.Points(12)
	p.Title.Padding = vg.Points(6)

	if !hasData(chart) {
		addPlaceholder(p)
		return encode(p, nil)
	}

	p.X.Label.Text = "Time (UTC)"
	p.Y.Label.Text = chart.YLabel
	p.Y.Min = 0
	p.Y.Tick.Marker = plainTicks{}
	p.Add(plotter.NewGrid())
	legend := plot.NewLegend()
	legend.Top = true
	legend.Left = true
	legend.Padding = vg.Points(3)
	legend.TextStyle.Font.Size = vg.Points(8)

	var err error
	switch chart.Kind {
	case Lines:
		err = addLines(p, &legend, chart)
	case StackedBars:
		err = addBars(p, &legend, chart, true)
	case GroupedBars:
		err = addBars(p, &legend, chart, false)
	default:
		err = fmt.Errorf("unknown chart kind %d", chart.Kind)
	}
	if err != nil {
		return nil, err
	}
	return encode(p, &legend)
}

// the default ticks print "50000.00"; these print "50000"
type plainTicks struct{}

func (plainTicks) Ticks(min, max float64) []plot.Tick {
	ticks := plot.DefaultTicks{}.Ticks(min, max)
	for i := range ticks {
		if ticks[i].Label != "" {
			ticks[i].Label = strconv.FormatFloat(ticks[i].Value, 'f', -1, 64)
		}
	}
	return ticks
}

func hasData(chart Chart) bool {
	for _, series := range chart.Series {
		for _, value := range series.Values {
			if !math.IsNaN(value) && value != 0 {
				return true
			}
		}
	}
	return false
}

func colorOf(series Series, index int) color.Color {
	if series.Color != nil {
		return series.Color
	}
	return palette[index%len(palette)]
}

func timeFormat(bucket time.Duration) string {
	switch {
	case bucket < time.Hour:
		return "15:04"
	case bucket < 24*time.Hour:
		return "Jan 02 15:04"
	default:
		return "2006-01-02"
	}
}

func unixSeconds(t time.Time) float64 {
	return float64(t.UnixMilli()) / 1000
}

func timeLabels(times []time.Time, bucket time.Duration) []string {
	step := (len(times) + maxXLabels - 1) / maxXLabels
	format := timeFormat(bucket)
	labels := make([]string, len(times))
	for i, t := range times {
		if i%step == 0 {
			labels[i] = t.Format(format)
		}
	}
	return labels
}

// splitting at NaN shows missing buckets as gaps instead of interpolating across them
func segments(times []time.Time, values []float64) []plotter.XYs {
	var result []plotter.XYs
	var current plotter.XYs
	for i, value := range values {
		if math.IsNaN(value) {
			if len(current) > 0 {
				result = append(result, current)
				current = nil
			}
			continue
		}
		current = append(current, plotter.XY{X: unixSeconds(times[i]), Y: value})
	}
	if len(current) > 0 {
		result = append(result, current)
	}
	return result
}

func addLines(p *plot.Plot, legend *plot.Legend, chart Chart) error {
	labels := timeLabels(chart.Times, chart.Bucket)
	var ticks plot.ConstantTicks
	for i, t := range chart.Times {
		// a minor tick per bucket only while they stay distinguishable
		if labels[i] != "" || len(chart.Times) <= maxMinorTicks {
			ticks = append(ticks, plot.Tick{Value: unixSeconds(t), Label: labels[i]})
		}
	}
	p.X.Tick.Marker = ticks
	p.X.Min = unixSeconds(chart.Times[0])
	p.X.Max = unixSeconds(chart.Times[len(chart.Times)-1])
	for i, series := range chart.Series {
		lineColor := colorOf(series, i)
		var legendLine *plotter.Line
		for _, segment := range segments(chart.Times, series.Values) {
			line, points, err := plotter.NewLinePoints(segment)
			if err != nil {
				return fmt.Errorf("series %q: %w", series.Label, err)
			}
			line.Color = lineColor
			line.Width = vg.Points(1.5)
			points.Color = lineColor
			points.Shape = draw.CircleGlyph{}
			points.Radius = vg.Points(1.5)
			p.Add(line, points)
			if legendLine == nil {
				legendLine = line
			}
		}
		if legendLine != nil {
			legend.Add(series.Label, legendLine)
		}
	}
	return nil
}

func addBars(p *plot.Plot, legend *plot.Legend, chart Chart, stacked bool) error {
	// bar widths are canvas lengths, so derive them from the approximate data area width
	slot := (width - maxLegendWidth) / vg.Length(len(chart.Times))
	barWidth := slot * 0.7
	if !stacked {
		barWidth = slot * 0.8 / vg.Length(len(chart.Series))
	}
	var below *plotter.BarChart
	for i, series := range chart.Series {
		values := make(plotter.Values, len(series.Values))
		for j, value := range series.Values {
			if !math.IsNaN(value) {
				values[j] = value
			}
		}
		bars, err := plotter.NewBarChart(values, barWidth)
		if err != nil {
			return fmt.Errorf("series %q: %w", series.Label, err)
		}
		bars.Color = colorOf(series, i)
		bars.LineStyle.Width = 0
		if stacked {
			if below != nil {
				bars.StackOn(below)
			}
			below = bars
		} else {
			center := vg.Length(len(chart.Series)-1) / 2
			bars.Offset = (vg.Length(i) - center) * barWidth
		}
		p.Add(bars)
		legend.Add(series.Label, bars)
	}
	p.NominalX(timeLabels(chart.Times, chart.Bucket)...)
	return nil
}

func addPlaceholder(p *plot.Plot) {
	p.HideAxes()
	p.X.Min, p.X.Max, p.Y.Min, p.Y.Max = 0, 1, 0, 1
	labels, err := plotter.NewLabels(plotter.XYLabels{
		XYs:    plotter.XYs{{X: 0.5, Y: 0.5}},
		Labels: []string{"No data in this range"},
	})
	if err != nil {
		return
	}
	labels.TextStyle[0].XAlign = text.XCenter
	labels.TextStyle[0].YAlign = text.YCenter
	labels.TextStyle[0].Font.Size = vg.Points(11)
	labels.TextStyle[0].Color = mutedText
	p.Add(labels)
}

func encode(p *plot.Plot, legend *plot.Legend) ([]byte, error) {
	canvas := vgimg.NewWith(vgimg.UseWH(width, height), vgimg.UseDPI(dpi))
	area := draw.New(canvas)
	if legend != nil {
		column := min(legend.Rectangle(area).Size().X+legendGap, maxLegendWidth)
		legend.Draw(draw.Crop(area, width-column, 0, 0, -vg.Points(titleSpace)))
		area = draw.Crop(area, 0, -column, 0, 0)
	}
	p.Draw(area)
	var buf bytes.Buffer
	if _, err := (vgimg.PngCanvas{Canvas: canvas}).WriteTo(&buf); err != nil {
		return nil, fmt.Errorf("encode png: %w", err)
	}
	return buf.Bytes(), nil
}
