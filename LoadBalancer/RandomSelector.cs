namespace LoadBalancer;

/// <summary>
/// Picks a backend uniformly at random on every call. Over many requests the
/// load spreads evenly across the pool without keeping any rotation state.
/// Thread-safe via <see cref="Random.Shared"/>.
/// </summary>
public sealed class RandomSelector
{
    private readonly string[] _backends;

    public RandomSelector(string[] backends)
    {
        if (backends.Length == 0)
            throw new ArgumentException("At least one backend is required.", nameof(backends));
        _backends = backends;
    }

    public string Next() => _backends[Random.Shared.Next(_backends.Length)];
}
