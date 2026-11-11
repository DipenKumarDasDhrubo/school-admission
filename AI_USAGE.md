# AI usage

## Tools

- **Claude (Anthropic)**, used in a chat interface with a sandboxed Linux environment.

## Where it was used

- Turning the assignment brief into a product requirements document (scope, rules, concurrency design, test plan).
- Writing the first version of the backend (SQL, endpoints), backend tests, React UI, frontend tests, Dockerfiles and these docs.

## What was verified, and how

- **Frontend:** type-checked, built, and the 7 Vitest tests were run. One test (expiry flips to `EXPIRED`) was checked by deliberately breaking the logic to confirm the test fails.
- **Seat-locking SQL:** run against a real PostgreSQL 16 using a throw-away Node script: 200 parallel requests across 3 separate connection pools gave exactly 10 holds; 30 parallel confirms changed the row once; lapsed holds report `EXPIRED`.
- **Not verified in the AI's environment:** the C# code and xUnit tests could not be compiled or run there (no .NET SDK or NuGet access). They need to be built and run once with `docker compose --profile test run --rm backend-tests`.

## Where the AI got something wrong, and how it was caught

These are issues found while the code was being built and reviewed. The AI environment had no .NET SDK, so the C# could not be compiled there. Items 1 to 3 were caught by reading the code, not by a compiler.

1. **Test helper name clashed with a namespace.**
   The AI named a test helper class `Api`, but the backend namespace is `SchoolAdmission.Api`, which can make name lookup ambiguous.
   *Caught:* by the AI during a manual review before anything was run.
   *Fix:* renamed the class to `Helpers` in all test files.

2. **Missing `using` statements in the test project.**
   The test project uses the plain .NET SDK, which does not import `Microsoft.Extensions.Configuration` automatically, so `AddInMemoryCollection` would fail to compile. `Xunit` was also only relied on through implicit usings.
   *Caught:* by the AI during the same review.
   *Fix:* added explicit `using` lines to the test files.

3. **The PRD and the code disagreed.**
   The PRD said the hold SQL would use `now()` and EF Core. `now()` returns the transaction start time, which is stale after a request waits for the row lock, so hold expiry would be slightly wrong under heavy load. The code uses `clock_timestamp()` and plain Npgsql instead.
   *Caught:* while writing the SQL, by thinking through what happens when requests queue on the lock.
   *Fix:* the code uses `clock_timestamp()` everywhere. The difference from the PRD is documented in `ASSUMPTIONS.md`.

4. **A misleading check in the SQL test script.**
   The AI's throw-away script printed `409` for "same student re-applies after expiry", which looked like a bug. The check was badly designed: the only seat had already been taken by another student, so 409 was the correct answer.
   *Caught:* by reading the script output against the scenario.
   *Fix:* understood that the behaviour was correct. The proper re-apply-after-expiry case is covered by the backend test `Expired_hold_releases_the_seat_and_cannot_be_confirmed`.

5. **Tests that passed on the first run.**
   All 7 frontend tests passed immediately, which could mean they test nothing.
   *Caught:* by checking that they can fail.
   *Fix:* the expiry logic was temporarily broken and the expiry test failed as expected, then the code was restored.

### Still unverified by the AI
The C# backend and its xUnit tests were never compiled or run by the AI. Any compile errors or failing tests found when running `docker compose --profile test run --rm backend-tests` should be listed below.

