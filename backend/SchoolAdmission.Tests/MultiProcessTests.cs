using System.Net;

namespace SchoolAdmission.Tests;

/// <summary>Bonus: two backend instances sharing one database must still respect the seat limit.</summary>
public class MultiProcessTests
{
    [Fact]
    public async Task Two_backend_instances_sharing_one_database_never_exceed_seats()
    {
        using var appA = new TestApp();
        using var appB = new TestApp();
        var a = appA.CreateClient();
        var cls = await Helpers.CreateClass(a, "Two processes", 10);
        var classId = cls.GetProperty("id").GetString()!;

        var tasks = Enumerable.Range(0, 200).Select(i => Task.Run(async () =>
        {
            var client = (i % 2 == 0 ? appA : appB).CreateClient();
            return (await Helpers.Apply(client, classId, Helpers.NewStudent())).StatusCode;
        }));
        var results = await Task.WhenAll(tasks);

        Assert.Equal(10, results.Count(r => r == HttpStatusCode.Created));
        Assert.Equal(190, results.Count(r => r == HttpStatusCode.Conflict));

        var after = await Helpers.GetClass(appB.CreateClient(), classId);
        Assert.Equal(10, after.GetProperty("heldSeats").GetInt32());
        Assert.Equal(0, after.GetProperty("availableSeats").GetInt32());
    }
}
