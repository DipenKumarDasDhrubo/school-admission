namespace SchoolAdmission.Api;

public sealed class ApiException(int status, string code, string message) : Exception(message)
{
    public int Status { get; } = status;
    public string Code { get; } = code;
}

public sealed record CreatedClassDto(Guid Id, string Name, int TotalSeats);

public sealed record ClassDto(Guid Id, string Name, int TotalSeats, int HeldSeats, int ConfirmedSeats, int AvailableSeats);

public sealed record HoldCreatedDto(Guid HoldId, Guid ClassId, string StudentId, string Status, DateTime ExpiresAt);

public sealed record HoldStatusDto(Guid HoldId, Guid ClassId, string StudentId, string Status, DateTime ExpiresAt);

public sealed record HoldConfirmedDto(Guid HoldId, string Status);

public sealed record MyHoldDto(Guid HoldId, Guid ClassId, string ClassName, string Status, DateTime ExpiresAt);
