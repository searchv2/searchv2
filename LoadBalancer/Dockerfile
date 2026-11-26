# syntax=docker/dockerfile:1
#
#   docker build -t searchv2-load-balancer .
#   docker run --rm -p 5071:8080 \
#     -e LoadBalancing__Backends__0=http://search-api-1:8080 \
#     -e LoadBalancing__Backends__1=http://search-api-2:8080 \
#     searchv2-load-balancer
#
# The load balancer is stateless; run as many replicas as you like. It redirects
# clients to the backends' internal compose DNS names, so it only works for
# clients inside the compose network.

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src/LoadBalancer
COPY . .
RUN dotnet publish LoadBalancer.csproj -c Release -o /app

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
ARG VERSION=1.0.1
LABEL org.opencontainers.image.title="searchv2-load-balancer" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.source="https://github.com/searchv2/load-balancer"
WORKDIR /app
COPY --from=build /app .

ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080

ENTRYPOINT ["dotnet", "LoadBalancer.dll"]
