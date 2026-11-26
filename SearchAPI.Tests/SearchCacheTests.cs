using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.FeatureManagement;
using SearchAPI.Api.Controllers;
using SearchAPI.Application;
using SearchAPI.Core.Entities;
using Shared.Model;
using Xunit;

namespace SearchAPI.Tests;

public sealed class SearchCacheTests
{
    [Fact]
    public async Task Search_caches_results_for_one_sliding_minute_and_separates_requests()
    {
        var cache = new RecordingCache();
        var search = new CountingSearch();
        var controller = new SearchController(search, cache, Features(cacheEnabled: true));

        var first = Result(await controller.Post(new SearchRequest(["apple"], false), default));
        var repeated = Result(await controller.Post(new SearchRequest(["apple"], false), default));
        var caseSensitive = Result(await controller.Post(new SearchRequest(["apple"], true), default));
        var otherQuery = Result(await controller.Post(new SearchRequest(["cherry"], false), default));

        Assert.Equal(3, search.Calls);
        Assert.Equal(first.Query, repeated.Query);
        Assert.Equal(first.DocumentHits[0].Document.mUrl, repeated.DocumentHits[0].Document.mUrl);
        Assert.Equal(3, cache.Keys.Count);
        Assert.All(cache.Keys, key => Assert.DoesNotContain("apple", key));
        Assert.Equal(TimeSpan.FromMinutes(1), cache.Options!.SlidingExpiration);
        Assert.Null(cache.Options.AbsoluteExpirationRelativeToNow);
        Assert.Equal(new[] { "cherry" }, otherQuery.Query);
        Assert.Equal(new[] { "apple" }, caseSensitive.Query);
    }

    [Fact]
    public async Task Search_skips_the_cache_when_the_flag_is_off()
    {
        var cache = new RecordingCache();
        var search = new CountingSearch();
        var controller = new SearchController(search, cache, Features(cacheEnabled: false));

        await controller.Post(new SearchRequest(["apple"], false), default);
        var repeated = Result(await controller.Post(new SearchRequest(["apple"], false), default));

        Assert.Equal(2, search.Calls);
        Assert.Empty(cache.Keys);
        Assert.Equal(new[] { "apple" }, repeated.Query);
    }

    private static IFeatureManager Features(bool cacheEnabled)
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                [$"FeatureManagement:{SearchController.SearchCacheFlag}"] = cacheEnabled.ToString(),
            })
            .Build();
        return new ServiceCollection()
            .AddFeatureManagement(configuration)
            .Services.BuildServiceProvider()
            .GetRequiredService<IFeatureManager>();
    }

    private static SearchResult Result(ActionResult<SearchResult> action) =>
        Assert.IsType<SearchResult>(Assert.IsType<OkObjectResult>(action.Result).Value);

    private sealed class CountingSearch : ISearchService
    {
        public int Calls { get; private set; }

        public SearchOutcome Search(string[] query, bool caseSensitive)
        {
            Calls++;
            return new SearchOutcome
            {
                Query = query,
                TotalHits = 1,
                Hits = [new SearchHit
                {
                    Document = new Document
                    {
                        Id = 1,
                        Url = "/data/docs/apple.txt",
                        IndexedAt = "2026-01-01",
                        CreatedAt = "2026-01-01",
                    },
                    MatchedWords = 1,
                    MissingWords = [],
                }],
                IgnoredWords = [],
                Elapsed = TimeSpan.FromMilliseconds(1),
            };
        }
    }

    private sealed class RecordingCache : IDistributedCache
    {
        private readonly Dictionary<string, byte[]> _items = [];
        public IReadOnlyCollection<string> Keys => _items.Keys;
        public DistributedCacheEntryOptions? Options { get; private set; }

        public byte[]? Get(string key) => _items.GetValueOrDefault(key);
        public Task<byte[]?> GetAsync(string key, CancellationToken token = default) => Task.FromResult(Get(key));
        public void Refresh(string key) { }
        public Task RefreshAsync(string key, CancellationToken token = default) => Task.CompletedTask;
        public void Remove(string key) => _items.Remove(key);
        public Task RemoveAsync(string key, CancellationToken token = default)
        {
            Remove(key);
            return Task.CompletedTask;
        }
        public void Set(string key, byte[] value, DistributedCacheEntryOptions options)
        {
            _items[key] = value;
            Options = options;
        }
        public Task SetAsync(string key, byte[] value, DistributedCacheEntryOptions options, CancellationToken token = default)
        {
            Set(key, value, options);
            return Task.CompletedTask;
        }
    }
}
