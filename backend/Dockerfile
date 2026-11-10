FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY . .
RUN dotnet restore SchoolAdmission.Api/SchoolAdmission.Api.csproj
RUN dotnet publish SchoolAdmission.Api/SchoolAdmission.Api.csproj -c Release -o /out --no-restore

# `docker compose --profile test run --rm backend-tests` uses this stage.
FROM build AS test
RUN dotnet restore SchoolAdmission.Tests/SchoolAdmission.Tests.csproj
CMD ["dotnet", "test", "SchoolAdmission.Tests/SchoolAdmission.Tests.csproj", "--no-restore", "--logger", "console;verbosity=normal"]

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app
COPY --from=build /out .
ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080
ENTRYPOINT ["dotnet", "SchoolAdmission.Api.dll"]
