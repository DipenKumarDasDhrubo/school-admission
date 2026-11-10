using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Npgsql;

namespace SchoolAdmission.Tests;

/// <summary>Tests run against a real PostgreSQL (never a fake) because locking is what is being tested.</summary>
public static class Db
{
    public static readonly string ConnectionString =
        Environment.GetEnvironmentVariable("TEST_CONNECTION_STRING")
        ?? "Host=localhost;Port=5432;Database=school_test;Username=school;Password=school";

    private static readonly object Gate = new();
    private static bool _created;

    /// <summary>Creates the separate test database on first use so real data is never touched.</summary>
    public static void EnsureCreated()
    {
        lock (Gate)
        {
            if (_created) return;
            var target = new NpgsqlConnectionStringBuilder(ConnectionString);
            var dbName = target.Database!;
            target.Database = "postgres";
            using var conn = new NpgsqlConnection(target.ConnectionString);
            conn.Open();
            using var exists = new NpgsqlCommand("SELECT 1 FROM pg_database WHERE datname = @n", conn);
            exists.Parameters.AddWithValue("n", dbName);
            if (exists.ExecuteScalar() is null)
            {
                using var create = new NpgsqlCommand($"CREATE DATABASE \"{dbName}\"", conn);
                try { create.ExecuteNonQuery(); }
                catch (PostgresException e) when (e.SqlState == "42P04") { /* created by a parallel test */ }
            }
            _created = true;
        }
    }
}

public sealed class TestApp : WebApplicationFactory<Program>
{
    private readonly int _holdSeconds;

    public TestApp(int holdSeconds = 600)
    {
        _holdSeconds = holdSeconds;
        Db.EnsureCreated();
    }

    protected override void ConfigureWebHost(Microsoft.AspNetCore.Hosting.IWebHostBuilder builder)
    {
        builder.ConfigureAppConfiguration((_, cfg) => cfg.AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["ConnectionStrings:Default"] = Db.ConnectionString,
            ["HOLD_DURATION_SECONDS"] = _holdSeconds.ToString(),
        }));
    }
}

public static class Helpers
{
    private static int _studentCounter = Random.Shared.Next(0, 1_000_000);

    /// <summary>A unique, valid 17-digit student id.</summary>
    public static string NewStudent() =>
        "2015" + Interlocked.Increment(ref _studentCounter).ToString("D6") + Random.Shared.Next(0, 10_000_000).ToString("D7");

    public static async Task<JsonElement> CreateClass(HttpClient c, string name, int seats)
    {
        var res = await c.PostAsync("/classes", Json(new { name, totalSeats = seats }));
        Assert.Equal(HttpStatusCode.Created, res.StatusCode);
        return await res.Content.ReadFromJsonAsync<JsonElement>();
    }

    public static Task<HttpResponseMessage> Apply(HttpClient c, string classId, string student) =>
        Send(c, HttpMethod.Post, $"/classes/{classId}/holds", student);

    public static Task<HttpResponseMessage> Send(HttpClient c, HttpMethod m, string url, string? student)
    {
        var req = new HttpRequestMessage(m, url);
        if (student is not null) req.Headers.Add("X-Student-Id", student);
        return c.SendAsync(req);
    }

    public static async Task<JsonElement> GetClass(HttpClient c, string classId) =>
        await c.GetFromJsonAsync<JsonElement>($"/classes/{classId}");

    public static StringContent Json(object o) =>
        new(JsonSerializer.Serialize(o), Encoding.UTF8, "application/json");
}
