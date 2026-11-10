using System.Net;

namespace SchoolAdmission.Tests;

public class ConcurrencyTests
{
    [Fact]
    public async Task Parallel_holds_never_exceed_total_seats()
    {
        using var app = new TestApp();
        var client = app.CreateClient();
        var cls = await Api.CreateClass(client, "Concurrency", 10);
        var classId = cls.GetProperty("id").GetString()!;

        // 150 different students hit the same 10-seat class at the same moment.
        var tasks = Enumerable.Range(0, 150)
            .Select(_ => Task.Run(async () => (await Api.Apply(app.CreateClient(), classId, Api.NewStudent())).StatusCode));
        var results = await Task.WhenAll(tasks);

        Assert.Equal(10, results.Count(r => r == HttpStatusCode.Created));
        Assert.Equal(140, results.Count(r => r == HttpStatusCode.Conflict));

        var after = await Api.GetClass(client, classId);
        Assert.Equal(10, after.GetProperty("heldSeats").GetInt32());
        Assert.Equal(0, after.GetProperty("availableSeats").GetInt32());
        Assert.Equal(0, after.GetProperty("confirmedSeats").GetInt32());
    }
}
