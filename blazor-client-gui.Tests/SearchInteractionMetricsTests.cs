using System.Diagnostics.Metrics;
using BlazorClientGui.Services;
using Xunit;

namespace BlazorClientGui.Tests;

public sealed class SearchInteractionMetricsTests
{
    [Fact]
    public void Only_valid_browser_durations_are_recorded_without_user_labels()
    {
        var measurements = new List<double>();
        using var listener = new MeterListener();
        listener.InstrumentPublished = (instrument, meterListener) =>
        {
            if (instrument.Meter.Name == "SearchV2.Browser")
            {
                Assert.Equal("searchv2.search.interaction.duration", instrument.Name);
                Assert.Equal("s", instrument.Unit);
                meterListener.EnableMeasurementEvents(instrument);
            }
        };
        listener.SetMeasurementEventCallback<double>((_, value, tags, _) =>
        {
            Assert.Empty(tags.ToArray());
            measurements.Add(value);
        });
        listener.Start();

        foreach (var seconds in new[] { double.NaN, double.PositiveInfinity, double.NegativeInfinity, -1, 0, 301 })
            SearchInteractionMetrics.Record(seconds);
        Assert.Empty(measurements);

        SearchInteractionMetrics.Record(0.25);
        SearchInteractionMetrics.Record(300);
        Assert.Equal(new[] { 0.25, 300 }, measurements);
    }
}
