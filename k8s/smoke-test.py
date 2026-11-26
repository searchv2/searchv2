"""Run with API :5071, Prometheus :9090 and Loki :3100 forwarded to localhost."""

import json
import time
import urllib.parse
import urllib.request


def get(url, **params):
    with urllib.request.urlopen(url + "?" + urllib.parse.urlencode(params), timeout=10) as response:
        return json.load(response)


def search():
    request = urllib.request.Request(
        "http://localhost:5071/api/Search",
        data=json.dumps({"Query": ["apple"], "CaseSensitive": False}).encode(),
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(request, timeout=10) as response:
        assert response.status == 200, "Search failed"
        assert response.headers.get("X-Served-By"), "API pod identity is missing"
        json.load(response)


def main():
    # Keep generating real traffic while waiting for export and scrape intervals.
    deadline = time.monotonic() + 90
    metrics = logs = database = []
    while time.monotonic() < deadline:
        search()
        metrics_response = get(
            "http://localhost:9090/api/v1/query",
            query='http_server_request_duration_seconds_count{service_name="search-api",http_route!="/healthz"}',
        )
        assert metrics_response["status"] == "success", "Prometheus query failed"
        metrics = metrics_response["data"]["result"]
        database_response = get(
            "http://localhost:9090/api/v1/query",
            query='searchv2_database_operation_duration_seconds_count{service_name="search-api"}',
        )
        assert database_response["status"] == "success", "Database metrics query failed"
        database = database_response["data"]["result"]
        logs_response = get(
            "http://localhost:3100/loki/api/v1/query_range",
            query='{service_name="search-api"} |= "api/Search"',
            limit=10,
        )
        assert logs_response["status"] == "success", "Loki query failed"
        logs = logs_response["data"]["result"]
        if (any(float(series["value"][1]) > 0 for series in metrics)
                and any(float(series["value"][1]) > 0 for series in database) and logs):
            print("PASS: search responds, Prometheus has request and database metrics, Loki has search request logs.")
            return
        time.sleep(2)
    raise AssertionError(
        f"Telemetry did not arrive within 90s: request series={len(metrics)}, "
        f"database series={len(database)}, log streams={len(logs)}")


if __name__ == "__main__":
    main()
