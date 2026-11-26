# Build from the workspace root, using the checked-out shared library.
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS source
WORKDIR /src
COPY search-utilities/ search-utilities/
RUN dotnet pack search-utilities/SearchUtilities.csproj -c Release -o /src/search-utilities/nupkg

FROM source AS api-build
COPY SearchAPI/ SearchAPI/
RUN dotnet publish SearchAPI/SearchAPI.csproj -c Release -o /out

FROM source AS blazor-build
COPY blazor-client-gui/ blazor-client-gui/
RUN dotnet publish blazor-client-gui/BlazorClientGui.csproj -c Release -o /out

FROM source AS indexer-build
COPY indexer/ indexer/
RUN dotnet publish indexer/indexer.csproj -c Release -o /out

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS search-api
WORKDIR /app
COPY --from=api-build /out .
ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080
ENTRYPOINT ["dotnet", "SearchAPI.dll"]

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS blazor
WORKDIR /app
COPY --from=blazor-build /out .
ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080
ENTRYPOINT ["dotnet", "BlazorClientGui.dll"]

FROM mcr.microsoft.com/dotnet/runtime:10.0 AS indexer
WORKDIR /app
COPY --from=indexer-build /out .
ENTRYPOINT ["dotnet", "indexer.dll"]
