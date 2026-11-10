# Assumptions

The brief leaves some things open. This is what I assumed and why.

## How the seat limit is guaranteed (including two processes)

`held + confirmed <= totalSeats` is enforced by **PostgreSQL, not by application memory**:

1. `POST /classes/{id}/holds` runs in one transaction that starts with `SELECT ... FROM classes WHERE id = @id FOR UPDATE`. That row lock makes all hold attempts on the same class queue up in the database, whichever backend process they came through.
2. Inside the lock it counts active seats (confirmed + unexpired held) and only inserts if there is room.
3. All time comparisons use the **database clock** (`clock_timestamp()`), so two processes can never disagree about whether a hold has expired.
4. A partial unique index on `(class_id, student_id) WHERE status IN ('HELD','CONFIRMED')` is a second line of defence for the one-active-hold-per-student rule.
5. Different classes lock different rows, so they do not slow each other down.

There is no in-process cache, lock or counter, so running two backends on different ports against one database is safe. This is covered by an automated test that starts two backend instances and fires 200 requests across both.

## Expiry

A hold is "active" only while `status = 'HELD'` and `expires_at > now`. Seat counts and reported status are computed with that rule at read time, so a seat returns **by itself** at the exact moment a hold lapses. No background job or API call is needed. When someone applies, old lapsed rows in that class are flipped to `EXPIRED` inside the locked transaction, which also lets a student re-apply after their hold expired.

## Behaviour choices

| Topic | Assumption |
|---|---|
| Student id | Exactly 17 digits, sent in `X-Student-Id`. No checksum or date validation. Missing/invalid gives 400 `INVALID_STUDENT_ID`. |
| No seats | 409 `NO_SEATS` |
| Already has an active/confirmed hold in that class | 409 `ALREADY_APPLIED` (same student may apply to different classes) |
| Re-applying after expiry or cancellation | Allowed |
| Confirm an expired hold | 409 `HOLD_EXPIRED`; cancelled: 409 `HOLD_CANCELLED` |
| Confirm someone else's hold | 403 `NOT_YOUR_APPLICATION` |
| Confirm twice | 200 both times; `confirmedSeats` increases once |
| Cancel | Only a `HELD` application can be cancelled (204). Cancelling again is a harmless 204. Cancelling a confirmed admission is 409 (no refund flow in scope). |
| Cancel/confirm unknown id | 404 |
| `GET /holds/{id}` | Has no ownership check (the contract does not require the header there); it exposes only status data and a random UUID |
| Admin | No login, so any user can create classes, as the brief says login is not needed |
| Class validation | Name 1-100 characters; seats whole number 1-100000; duplicate names allowed |
| IDs | UUIDs |
| Payment | Always succeeds; nothing stored about payment |
| Timestamps | `expiresAt` is UTC ISO-8601 |
| Extra response fields | `studentId` is added on hold responses; the contract fields are never removed or renamed |

## Frontend choices

- Plain English UI text. The backend messages and UI error text are written for non-technical parents.
- Seat counts refresh every 4 seconds, applications every 5 seconds; the countdown ticks every second.
- The countdown uses the **server's clock** (via an `X-Server-Time` response header) so a wrong clock on the parent's device does not change the time left. The server is always the authority.
- The student id is stored in `localStorage`; applications are always loaded from the server, so a refresh or a new browser session shows them again.
- The "application" screen from the brief is the application card on the **My applications** tab (status, time left, pay and cancel). Pressing Apply jumps there.

## Technical choices

- Plain Npgsql with hand-written SQL instead of an ORM, because the correctness of the seat limit depends on exact locking statements.
- The schema is created at startup with `CREATE ... IF NOT EXISTS` under an advisory lock (so two starting processes do not clash), retrying while PostgreSQL boots.
- CORS allows any origin (no credentials are used).
