namespace SchoolAdmission.Api;

/// <summary>Database schema. Applied at startup (idempotent) under an advisory lock.</summary>
public static class Schema
{
    public const string Sql = """
        CREATE TABLE IF NOT EXISTS classes (
            id          uuid        PRIMARY KEY,
            name        text        NOT NULL,
            total_seats integer     NOT NULL CHECK (total_seats > 0),
            created_at  timestamptz NOT NULL DEFAULT clock_timestamp()
        );

        CREATE TABLE IF NOT EXISTS holds (
            id           uuid        PRIMARY KEY,
            class_id     uuid        NOT NULL REFERENCES classes(id),
            student_id   varchar(17) NOT NULL,
            status       text        NOT NULL CHECK (status IN ('HELD','CONFIRMED','EXPIRED','CANCELLED')),
            created_at   timestamptz NOT NULL DEFAULT clock_timestamp(),
            expires_at   timestamptz NOT NULL,
            confirmed_at timestamptz
        );

        CREATE INDEX IF NOT EXISTS ix_holds_class_status ON holds (class_id, status, expires_at);
        CREATE INDEX IF NOT EXISTS ix_holds_student ON holds (student_id);

        -- Database-level backstop: one active/confirmed hold per student per class.
        CREATE UNIQUE INDEX IF NOT EXISTS ux_holds_active_per_student
            ON holds (class_id, student_id) WHERE status IN ('HELD','CONFIRMED');
        """;
}
