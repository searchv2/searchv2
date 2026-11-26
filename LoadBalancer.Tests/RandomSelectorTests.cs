using LoadBalancer;
using Xunit;

namespace LoadBalancer.Tests;

public sealed class RandomSelectorTests
{
    [Fact]
    public void Next_only_ever_returns_a_configured_backend()
    {
        var pool = new[] { "a", "b", "c" };
        var selector = new RandomSelector(pool);

        for (var i = 0; i < 100; i++)
            Assert.Contains(selector.Next(), pool);
    }

    [Fact]
    public void Next_with_single_backend_always_returns_it()
    {
        var selector = new RandomSelector(["a"]);

        Assert.Equal("a", selector.Next());
        Assert.Equal("a", selector.Next());
    }

    [Fact]
    public void Constructor_rejects_empty_pool()
    {
        Assert.Throws<ArgumentException>(() => new RandomSelector([]));
    }

    [Fact]
    public void Next_hits_every_backend_over_many_calls()
    {
        var selector = new RandomSelector(["a", "b", "c"]);

        var seen = new HashSet<string>();
        for (var i = 0; i < 1000; i++)
            seen.Add(selector.Next());

        Assert.Equal(3, seen.Count);
    }
}
