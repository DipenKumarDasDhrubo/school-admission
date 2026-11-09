using System.Text.Json;
using System.Text.RegularExpressions;
using Npgsql;
using SchoolAdmission.Api;

var builder = WebApplication.CreateBuilder(args);

if (string.IsNullOrEmpty(builder.Configuration["ASPNETCORE_URLS"]) && string.IsNullOrEmpty(builder.Configuration["urls"]))
    builder.WebHost.UseUrls("http://0.0.0.0:8080");

// Resolved lazily (after configuration is fully built) so tests and Docker can override via environment.
builder.Services.AddSingleton(sp =>
    NpgsqlDataSource.Create(sp.GetRequiredService<IConfiguration>().GetConnectionString("Default")
        ?? "Host=localhost;Port=5432;Database=school;Username=school;Password=school"));
builder.Services.AddSingleton<Store>();
builder.Services.AddCors(o => o.AddDefaultPolicy(p =>
    p.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod().WithExposedHeaders("X-Server-Time")));

var app = builder.Build();

app.UseCors();

// Consistent JSON errors: { "error": "CODE", "message": "Human readable text" }.
app.Use(async (ctx, next) =>
{
    ctx.Response.OnStarting(() =>
    {
        ctx.Response.Headers["X-Server-Time"] = DateTime.UtcNow.ToString("O");
        return Task.CompletedTask;
    });
    try { await next(); }
    catch (ApiException e) { await WriteError(ctx, e.Status, e.Code, e.Message); }
    catch (Exception e) when (e is JsonException or BadHttpRequestException)
    {
        await WriteError(ctx, 400, "INVALID_INPUT", "The request could not be read. Please check the values and try again.");
    }
    catch (Exception e)
    {
        app.Logger.LogError(e, "Unhandled error");
        await WriteError(ctx, 500, "SERVER_ERROR", "Something went wrong on our side. Please try again.");
    }
});

static Task WriteError(HttpContext ctx, int status, string code, string message)
{
    if (ctx.Response.HasStarted) return Task.CompletedTask;
    ctx.Response.Clear();
    ctx.Response.StatusCode = status;
    return ctx.Response.WriteAsJsonAsync(new { error = code, message });
}

await app.Services.GetRequiredService<Store>().InitAsync();

// ---------- classes ----------

app.MapPost("/classes", async (HttpRequest req, Store store) =>
{
    using var doc = await JsonDocument.ParseAsync(req.Body);
    var root = doc.RootElement;
    if (root.ValueKind != JsonValueKind.Object)
        throw new ApiException(400, "INVALID_INPUT", "Please send the class name and number of seats.");

    var name = root.TryGetProperty("name", out var n) && n.ValueKind == JsonValueKind.String
        ? n.GetString()!.Trim() : "";
    if (name.Length == 0 || name.Length > 100)
        throw new ApiException(400, "INVALID_INPUT", "Class name is required and must be 100 characters or fewer.");

    if (!root.TryGetProperty("totalSeats", out var t) || t.ValueKind != JsonValueKind.Number
        || !t.TryGetInt32(out var seats) || seats < 1 || seats > 100000)
        throw new ApiException(400, "INVALID_INPUT", "Total seats must be a whole number between 1 and 100000.");

    var created = await store.CreateClassAsync(name, seats);
    return Results.Created($"/classes/{created.Id}", created);
});

app.MapGet("/classes", async (Store store) => Results.Ok(await store.ListClassesAsync()));

app.MapGet("/classes/{classId:guid}", async (Guid classId, Store store) =>
    Results.Ok(await store.GetClassAsync(classId)));

app.Run();

public partial class Program { }
