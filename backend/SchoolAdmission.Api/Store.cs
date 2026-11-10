using Npgsql;

namespace SchoolAdmission.Api;

/// <summary>All database access. Every seat-affecting operation runs in a transaction.</summary>
public sealed class Store(NpgsqlDataSource ds, IConfiguration config, ILogger<Store> log)
{
    public int HoldDurationSeconds { get; } =
        int.TryParse(config["HOLD_DURATION_SECONDS"], out var s) && s > 0 ? s : 600;

    // ---------- helpers ----------

    private static NpgsqlCommand Cmd(NpgsqlConnection conn, NpgsqlTransaction? tx, string sql,
        params (string Name, object Value)[] ps)
    {
        var cmd = new NpgsqlCommand(sql, conn, tx);
        foreach (var (name, value) in ps) cmd.Parameters.AddWithValue(name, value);
        return cmd;
    }

    private static async Task<int> Exec(NpgsqlConnection c, NpgsqlTransaction? t, string sql,
        params (string, object)[] ps)
    {
        await using var cmd = Cmd(c, t, sql, ps);
        return await cmd.ExecuteNonQueryAsync();
    }

    private static async Task<object?> Scalar(NpgsqlConnection c, NpgsqlTransaction? t, string sql,
        params (string, object)[] ps)
    {
        await using var cmd = Cmd(c, t, sql, ps);
        return await cmd.ExecuteScalarAsync();
    }

    // ---------- startup ----------

    /// <summary>Creates the schema, retrying while the database is still starting.</summary>
    public async Task InitAsync()
    {
        for (var attempt = 1; ; attempt++)
        {
            try
            {
                await using var conn = await ds.OpenConnectionAsync();
                // Advisory lock so two backend processes starting together do not race on DDL.
                await Exec(conn, null, "SELECT pg_advisory_lock(727274)");
                try { await Exec(conn, null, Schema.Sql); }
                finally { await Exec(conn, null, "SELECT pg_advisory_unlock(727274)"); }
                return;
            }
            catch (Exception ex) when (attempt < 30)
            {
                log.LogWarning("Database not ready (attempt {Attempt}): {Message}", attempt, ex.Message);
                await Task.Delay(2000);
            }
        }
    }

    // ---------- classes ----------

    public async Task<CreatedClassDto> CreateClassAsync(string name, int totalSeats)
    {
        var id = Guid.NewGuid();
        await using var conn = await ds.OpenConnectionAsync();
        await Exec(conn, null, "INSERT INTO classes (id, name, total_seats) VALUES (@id, @n, @t)",
            ("id", id), ("n", name), ("t", totalSeats));
        return new CreatedClassDto(id, name, totalSeats);
    }

    // "Held" only counts holds that have not expired yet, so expiry frees seats with no background job.
    private const string ClassSelect = """
        SELECT c.id, c.name, c.total_seats,
               COUNT(h.id) FILTER (WHERE h.status = 'HELD' AND h.expires_at > clock_timestamp()) AS held,
               COUNT(h.id) FILTER (WHERE h.status = 'CONFIRMED') AS confirmed
        FROM classes c
        LEFT JOIN holds h ON h.class_id = c.id
        {where}
        GROUP BY c.id
        ORDER BY c.created_at, c.id
        """;

    private static ClassDto ReadClass(NpgsqlDataReader r)
    {
        var total = r.GetInt32(2);
        var held = (int)r.GetInt64(3);
        var confirmed = (int)r.GetInt64(4);
        return new ClassDto(r.GetGuid(0), r.GetString(1), total, held, confirmed,
            Math.Max(0, total - held - confirmed));
    }

    public async Task<List<ClassDto>> ListClassesAsync()
    {
        await using var conn = await ds.OpenConnectionAsync();
        await using var cmd = Cmd(conn, null, ClassSelect.Replace("{where}", ""));
        await using var r = await cmd.ExecuteReaderAsync();
        var list = new List<ClassDto>();
        while (await r.ReadAsync()) list.Add(ReadClass(r));
        return list;
    }

    public async Task<ClassDto> GetClassAsync(Guid id)
    {
        await using var conn = await ds.OpenConnectionAsync();
        await using var cmd = Cmd(conn, null, ClassSelect.Replace("{where}", "WHERE c.id = @id"), ("id", id));
        await using var r = await cmd.ExecuteReaderAsync();
        if (!await r.ReadAsync()) throw new ApiException(404, "CLASS_NOT_FOUND", "This class does not exist.");
        return ReadClass(r);
    }

    // ---------- holds ----------

    /// <summary>
    /// Creates a seat hold. The class row is locked (FOR UPDATE) for the whole transaction, so all hold
    /// attempts on one class are serialized by PostgreSQL itself. This is what keeps
    /// held + confirmed &lt;= totalSeats across any number of concurrent requests and backend processes.
    /// All time comparisons use the database clock.
    /// </summary>
    public async Task<HoldCreatedDto> CreateHoldAsync(Guid classId, string studentId)
    {
        await using var conn = await ds.OpenConnectionAsync();
        await using var tx = await conn.BeginTransactionAsync();
        try
        {
            var totalObj = await Scalar(conn, tx, "SELECT total_seats FROM classes WHERE id = @id FOR UPDATE",
                ("id", classId));
            if (totalObj is null) throw new ApiException(404, "CLASS_NOT_FOUND", "This class does not exist.");
            var total = (int)totalObj;

            // Flip expired holds of this class to EXPIRED so the unique index never blocks a re-apply.
            await Exec(conn, tx, """
                UPDATE holds SET status = 'EXPIRED'
                WHERE class_id = @id AND status = 'HELD' AND expires_at <= clock_timestamp()
                """, ("id", classId));

            var existing = await Scalar(conn, tx, """
                SELECT 1 FROM holds
                WHERE class_id = @id AND student_id = @s AND status IN ('HELD','CONFIRMED') LIMIT 1
                """, ("id", classId), ("s", studentId));
            if (existing is not null)
                throw new ApiException(409, "ALREADY_APPLIED",
                    "You already have an active application or confirmed admission in this class.");

            var used = (long)(await Scalar(conn, tx,
                "SELECT count(*) FROM holds WHERE class_id = @id AND status IN ('HELD','CONFIRMED')",
                ("id", classId)))!;
            if (used >= total)
                throw new ApiException(409, "NO_SEATS", "Sorry, there are no seats left in this class.");

            var holdId = Guid.NewGuid();
            await using var ins = Cmd(conn, tx, """
                INSERT INTO holds (id, class_id, student_id, status, expires_at)
                VALUES (@h, @c, @s, 'HELD', clock_timestamp() + @d * interval '1 second')
                RETURNING expires_at
                """, ("h", holdId), ("c", classId), ("s", studentId), ("d", HoldDurationSeconds));
            var expiresAt = (DateTime)(await ins.ExecuteScalarAsync())!;

            await tx.CommitAsync();
            return new HoldCreatedDto(holdId, classId, studentId, "HELD", expiresAt);
        }
        catch (PostgresException e) when (e.SqlState == PostgresErrorCodes.UniqueViolation)
        {
            throw new ApiException(409, "ALREADY_APPLIED",
                "You already have an active application or confirmed admission in this class.");
        }
    }
}
