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

> Fill this in with your own real findings after you run and review the code. Examples of what to look for: a compile error, a wrong status code compared with the contract, a test that passed for the wrong reason, a missed edge case. Be specific: what the AI produced, how you noticed, and what you changed.

- _(your entry here)_
