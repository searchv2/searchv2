# load-balancer

A minimal load balancer for the Search API, written from scratch. A single
catch-all controller redirects every incoming request (`307 Temporary
Redirect`) to the same path on a randomly chosen backend; the client then
re-sends the request there itself. `307` preserves the method and body, so a
`POST /api/search` is replayed unchanged.

## How it works

Two files:

- `RandomSelector` picks a backend uniformly at random on every call, so the
  load spreads evenly across the pool without keeping any rotation state. It is
  built once at startup from the `LoadBalancing:Backends` configuration array.
- `ProxyController` has one catch-all route that returns
  `RedirectPreserveMethod("{backend}/{path}{query}")`.

.NET's `HttpClient` (the Blazor and console clients) and `curl -L` both follow
`307` redirects and re-send the body automatically, so nothing else changes.

Because the client connects to the backend directly after the redirect, the
backend URL must be reachable from the client - fine inside the `docker compose`
network, where every service can resolve `search-api-1` / `search-api-2`.

## Setup

Requires the [.NET 10 SDK](https://dotnet.microsoft.com/download). No NuGet
dependencies and no reference to the `SearchUtilities` models - the controller
only rewrites the URL, it never looks at the payload.

## Build and run

`../LoadBalancer.slnx` groups this project, the test project, and the non-code
items (compose file, Dockerfile, settings) under one solution.

```bash
dotnet restore
dotnet build
LoadBalancing__Backends__0=http://localhost:5071 \
LoadBalancing__Backends__1=http://localhost:5072 dotnet run
```

Configure the pool in `appsettings.json` or via environment variables:

```json
"LoadBalancing": {
  "Backends": ["http://localhost:5071", "http://localhost:5072"]
}
```

## Docker

```bash
docker build -t searchv2-load-balancer .
docker run --rm -p 5071:8080 \
  -e LoadBalancing__Backends__0=http://search-api-1:8080 \
  -e LoadBalancing__Backends__1=http://search-api-2:8080 \
  searchv2-load-balancer
```

Under `docker compose` the load balancer publishes port `5071` and sits in front
of `search-api-1` and `search-api-2`; the console and Blazor clients point at
`http://load-balancer:8080`. See `../docker-compose.yml`.

## Tests

```bash
dotnet test ../LoadBalancer.Tests
```

`RandomSelectorTests` covers that only configured backends are returned, the
single-backend case, rejection of an empty pool, and that every backend is hit
over many calls.
