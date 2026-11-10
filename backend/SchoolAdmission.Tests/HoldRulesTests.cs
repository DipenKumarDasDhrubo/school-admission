using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace SchoolAdmission.Tests;

public class HoldRulesTests
{
    private static async Task<(string ClassId, string HoldId)> ClassWithHold(HttpClient c, string student, int seats = 5)
    {
        var cls = await Helpers.CreateClass(c, "Rules " + Guid.NewGuid().ToString("N")[..6], seats);
        var classId = cls.GetProperty("id").GetString()!;
        var res = await Helpers.Apply(c, classId, student);
        Assert.Equal(HttpStatusCode.Created, res.StatusCode);
        var hold = await res.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("HELD", hold.GetProperty("status").GetString());
        return (classId, hold.GetProperty("holdId").GetString()!);
    }

    [Fact]
    public async Task Same_student_cannot_hold_twice_in_one_class_but_can_in_another()
    {
        using var app = new TestApp();
        var c = app.CreateClient();
        var student = Helpers.NewStudent();
        var (classId, _) = await ClassWithHold(c, student);

        Assert.Equal(HttpStatusCode.Conflict, (await Helpers.Apply(c, classId, student)).StatusCode);

        var other = await Helpers.CreateClass(c, "Other class", 5);
        Assert.Equal(HttpStatusCode.Created,
            (await Helpers.Apply(c, other.GetProperty("id").GetString()!, student)).StatusCode);
    }

    [Fact]
    public async Task Expired_hold_releases_the_seat_and_cannot_be_confirmed()
    {
        using var app = new TestApp(holdSeconds: 1);
        var c = app.CreateClient();
        var student = Helpers.NewStudent();
        var (classId, holdId) = await ClassWithHold(c, student, seats: 1);

        // The only seat is taken while the hold is active.
        Assert.Equal(HttpStatusCode.Conflict, (await Helpers.Apply(c, classId, Helpers.NewStudent())).StatusCode);

        await Task.Delay(1600); // no API call needed for the seat to come back

        var cls = await Helpers.GetClass(c, classId);
        Assert.Equal(1, cls.GetProperty("availableSeats").GetInt32());
        Assert.Equal(0, cls.GetProperty("heldSeats").GetInt32());

        var hold = await c.GetFromJsonAsync<JsonElement>($"/holds/{holdId}");
        Assert.Equal("EXPIRED", hold.GetProperty("status").GetString());

        Assert.Equal(HttpStatusCode.Conflict,
            (await Helpers.Send(c, HttpMethod.Post, $"/holds/{holdId}/confirm", student)).StatusCode);

        // The same student can apply again once the old hold expired.
        Assert.Equal(HttpStatusCode.Created, (await Helpers.Apply(c, classId, student)).StatusCode);
    }

    [Fact]
    public async Task Confirming_many_times_counts_the_seat_once_and_only_owner_can_confirm()
    {
        using var app = new TestApp();
        var c = app.CreateClient();
        var student = Helpers.NewStudent();
        var (classId, holdId) = await ClassWithHold(c, student);

        Assert.Equal(HttpStatusCode.Forbidden,
            (await Helpers.Send(c, HttpMethod.Post, $"/holds/{holdId}/confirm", Helpers.NewStudent())).StatusCode);

        var results = await Task.WhenAll(Enumerable.Range(0, 10).Select(_ =>
            Helpers.Send(app.CreateClient(), HttpMethod.Post, $"/holds/{holdId}/confirm", student)));
        Assert.All(results, r => Assert.Equal(HttpStatusCode.OK, r.StatusCode));

        var cls = await Helpers.GetClass(c, classId);
        Assert.Equal(1, cls.GetProperty("confirmedSeats").GetInt32());
        Assert.Equal(0, cls.GetProperty("heldSeats").GetInt32());

        var hold = await c.GetFromJsonAsync<JsonElement>($"/holds/{holdId}");
        Assert.Equal("CONFIRMED", hold.GetProperty("status").GetString());
    }

    [Fact]
    public async Task Cancel_frees_the_seat_and_my_holds_lists_the_application()
    {
        using var app = new TestApp();
        var c = app.CreateClient();
        var student = Helpers.NewStudent();
        var (classId, holdId) = await ClassWithHold(c, student);

        var mine = await (await Helpers.Send(c, HttpMethod.Get, "/me/holds", student)).Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(1, mine.GetArrayLength());
        Assert.False(string.IsNullOrEmpty(mine[0].GetProperty("className").GetString()));

        Assert.Equal(HttpStatusCode.NoContent, (await Helpers.Send(c, HttpMethod.Delete, $"/holds/{holdId}", student)).StatusCode);

        var cls = await Helpers.GetClass(c, classId);
        Assert.Equal(0, cls.GetProperty("heldSeats").GetInt32());
        var hold = await c.GetFromJsonAsync<JsonElement>($"/holds/{holdId}");
        Assert.Equal("CANCELLED", hold.GetProperty("status").GetString());
    }

    [Fact]
    public async Task Invalid_input_returns_400_with_a_readable_message_and_unknown_ids_return_404()
    {
        using var app = new TestApp();
        var c = app.CreateClient();

        var bad = await c.PostAsync("/classes", Helpers.Json(new { name = "", totalSeats = 0 }));
        Assert.Equal(HttpStatusCode.BadRequest, bad.StatusCode);
        var body = await bad.Content.ReadFromJsonAsync<JsonElement>();
        Assert.False(string.IsNullOrWhiteSpace(body.GetProperty("message").GetString()));

        var cls = await Helpers.CreateClass(c, "Validation", 3);
        var classId = cls.GetProperty("id").GetString()!;
        Assert.Equal(HttpStatusCode.BadRequest, (await Helpers.Apply(c, classId, "123")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await Helpers.Apply(c, classId, null!)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await Helpers.Apply(c, Guid.NewGuid().ToString(), Helpers.NewStudent())).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await c.GetAsync($"/holds/{Guid.NewGuid()}")).StatusCode);
    }

    [Fact]
    public async Task Response_contains_all_contract_fields()
    {
        using var app = new TestApp();
        var c = app.CreateClient();
        var student = Helpers.NewStudent();
        var (classId, holdId) = await ClassWithHold(c, student);

        var cls = await Helpers.GetClass(c, classId);
        foreach (var f in new[] { "id", "name", "totalSeats", "heldSeats", "confirmedSeats", "availableSeats" })
            Assert.True(cls.TryGetProperty(f, out _), $"class is missing {f}");

        var hold = await c.GetFromJsonAsync<JsonElement>($"/holds/{holdId}");
        foreach (var f in new[] { "holdId", "classId", "status", "expiresAt" })
            Assert.True(hold.TryGetProperty(f, out _), $"hold is missing {f}");
    }
}
