#!/usr/bin/env python3
"""Load test for the search API (see PERFORMANCE-TEST.md). Standard library only.

    kubectl --context searchv2 -n searchv2 port-forward service/search-api 5071:8080
    # port-forward to a Service picks ONE pod; to hit both replicas forward each pod
    # (pod/NAME 5071:8080 and 5072:8080) and pass --url http://localhost:5071/api/Search,http://localhost:5072/api/Search
    python3 k8s/load-test.py --docs ../seData/medium --stages 2x30,8x60,16x60

A stage is CONCURRENCYxSECONDS: that many workers send searches back to back for that long.
Queries come from a pool of "popular" queries picked with a Zipf-like skew (these repeat,
so they become cache hits) mixed with --unique-ratio of one-off queries (always cache misses).
Latency is measured at the client, so it includes the network and the port-forward.

With --prometheus the script also compares its own request count with the request counter in
Prometheus (Prometheus port-forwarded to localhost:9090), which verifies the metric.
"""

import argparse
import collections
import json
import os
import random
import re
import threading
import time
import urllib.error
import urllib.parse
import urllib.request

DEFAULT_WORDS = (
    "enron meeting forwarded coverage direct open fall find know above power gas "
    "energy trading schedule contract report update market price load review "
    "agreement credit position budget payment invoice office lunch friday monday"
).split()


def vocabulary(docs, limit_files=300):
    """Words of 4+ letters from a sample of the indexed documents (queries that really hit)."""
    if not docs:
        return DEFAULT_WORDS
    counts = collections.Counter()
    seen = 0
    for folder, _, files in os.walk(docs):
        for name in files:
            if name.endswith(".txt"):
                with open(os.path.join(folder, name), errors="ignore") as handle:
                    counts.update(re.findall(r"[a-z]{4,}", handle.read(20000).lower()))
                seen += 1
                if seen >= limit_files:
                    break
        if seen >= limit_files:
            break
    words = [word for word, _ in counts.most_common(2000)]
    return words or DEFAULT_WORDS


class Workload:
    def __init__(self, words, popular, unique_ratio, seed):
        self.rng = random.Random(seed)
        self.words = words
        self.unique_ratio = unique_ratio
        self.lock = threading.Lock()
        self.popular = [self._query() for _ in range(popular)]
        self.weights = [1 / (rank + 1) for rank in range(popular)]

    def _query(self):
        return self.rng.sample(self.words, self.rng.choice([1, 1, 2, 3]))

    def next(self):
        with self.lock:
            if self.rng.random() < self.unique_ratio:
                return self._query() + [self.rng.choice(self.words)]  # new combination, almost surely a miss
            return self.rng.choices(self.popular, self.weights)[0]


def one_request(urls, query):
    url = random.choice(urls)
    body = json.dumps({"Query": query, "CaseSensitive": False}).encode()
    request = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"})
    started = time.perf_counter()
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            response.read()
            return time.perf_counter() - started, response.status, response.headers.get("X-Served-By", "?")
    except urllib.error.HTTPError as error:
        return time.perf_counter() - started, error.code, "?"
    except Exception:
        return time.perf_counter() - started, 0, "?"


def percentile(sorted_values, fraction):
    if not sorted_values:
        return float("nan")
    return sorted_values[min(len(sorted_values) - 1, int(fraction * len(sorted_values)))]


def run_stage(url, workload, concurrency, seconds):
    deadline = time.monotonic() + seconds
    results, lock = [], threading.Lock()

    def worker():
        local = []
        while time.monotonic() < deadline:
            local.append(one_request(url, workload.next()))
        with lock:
            results.extend(local)

    started = time.monotonic()
    threads = [threading.Thread(target=worker) for _ in range(concurrency)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()
    elapsed = time.monotonic() - started

    latencies = sorted(r[0] for r in results)
    errors = sum(1 for r in results if r[1] != 200)
    return {
        "concurrency": concurrency,
        "seconds": round(elapsed, 1),
        "requests": len(results),
        "errors": errors,
        "error_rate": errors / len(results) if results else 0,
        "rps": round(len(results) / elapsed, 1),
        "p50_ms": round(percentile(latencies, 0.50) * 1000, 1),
        "p95_ms": round(percentile(latencies, 0.95) * 1000, 1),
        "p99_ms": round(percentile(latencies, 0.99) * 1000, 1),
        "max_ms": round(latencies[-1] * 1000, 1) if latencies else float("nan"),
        "pods": dict(collections.Counter(r[2] for r in results)),
    }


def prometheus_count(base, wait=0):
    if wait:
        time.sleep(wait)
    query = 'sum(http_server_request_duration_seconds_count{service_name="search-api",http_route!="/healthz"})'
    url = base.rstrip("/") + "/api/v1/query?" + urllib.parse.urlencode({"query": query})
    with urllib.request.urlopen(url, timeout=10) as response:
        result = json.load(response)["data"]["result"]
    return float(result[0]["value"][1]) if result else 0.0


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--url", default="http://localhost:5071/api/Search", help="one URL, or several separated by commas (requests are spread randomly)")
    parser.add_argument("--stages", default="2x30,8x60,16x60", help="CONCURRENCYxSECONDS,... (default %(default)s)")
    parser.add_argument("--docs", help="indexed document folder to take query words from")
    parser.add_argument("--popular", type=int, default=50, help="size of the repeating query pool")
    parser.add_argument("--unique-ratio", type=float, default=0.2, help="share of one-off queries (cache misses)")
    parser.add_argument("--seed", type=int, default=1)
    parser.add_argument("--prometheus", help="e.g. http://localhost:9090, to verify the request counter")
    parser.add_argument("--json", help="write the stage results to this file")
    args = parser.parse_args()

    stages = [tuple(int(part) for part in stage.split("x")) for stage in args.stages.split(",")]
    workload = Workload(vocabulary(args.docs), args.popular, args.unique_ratio, args.seed)
    before = prometheus_count(args.prometheus) if args.prometheus else None

    print(f"{'conc':>4} {'secs':>5} {'reqs':>7} {'err%':>6} {'req/s':>7} {'p50 ms':>8} {'p95 ms':>8} {'p99 ms':>8}  pods")
    all_stages, sent = [], 0
    for concurrency, seconds in stages:
        stage = run_stage(args.url.split(","), workload, concurrency, seconds)
        all_stages.append(stage)
        sent += stage["requests"]
        print(f"{stage['concurrency']:>4} {stage['seconds']:>5} {stage['requests']:>7} {stage['error_rate'] * 100:>6.2f} "
              f"{stage['rps']:>7} {stage['p50_ms']:>8} {stage['p95_ms']:>8} {stage['p99_ms']:>8}  {stage['pods']}")

    if args.prometheus:
        after = prometheus_count(args.prometheus, wait=40)  # OTLP export (10 s) plus scrape interval
        print(f"\nverification: client sent {sent}, Prometheus counted {after - before:.0f} "
              f"(difference {sent - (after - before):+.0f})")
    if args.json:
        with open(args.json, "w") as handle:
            json.dump(all_stages, handle, indent=2)


if __name__ == "__main__":
    main()
