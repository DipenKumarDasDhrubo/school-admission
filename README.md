# School Admission System

Online, first-come-first-served school admissions. Applying places a time-limited **hold** on a seat; paying the admission fee inside the window **confirms** the admission; otherwise the seat returns to the pool automatically.

- **Backend:** C# / .NET 8 minimal API + PostgreSQL (plain Npgsql, no ORM)
- **Frontend:** React 18 + TypeScript + Vite
- **Everything runs in Docker.** Docker is the only thing you need to install.

## Run the app

```bash
docker compose up --build
```

| What | URL |
|---|---|
| **Frontend (open this)** | http://localhost:3000 |
| Backend API | http://localhost:8080 |
| PostgreSQL | localhost:5432 (user/password/db: `school`) |

Data lives in the `pgdata` Docker volume, so it survives `docker compose down` followed by `docker compose up`. (Only `docker compose down -v` deletes it.)

### Using the UI

1. Type the student's 17-digit birth registration number in the box at the top and press **Save number** (it is remembered across refreshes and browser restarts).
2. **Create class** tab: add a class with a name and seat count (for example "Class 6 - Morning Shift", 120). Every shift is its own class.
3. **Classes** tab: see total / on hold / confirmed / available seats (refreshes every 4 seconds) and press **Apply**.
4. **My applications** tab: watch the countdown, press **Pay admission fee** (always succeeds, no real gateway) or **Cancel application**. When the timer ends the card shows `EXPIRED` and the pay button is disabled by itself.

### Configuration (environment variables)

| Variable | Used by | Default | Meaning |
|---|---|---|---|
| `HOLD_DURATION_SECONDS` | backend | `600` | How long a hold lasts |
| `ConnectionStrings__Default` | backend | compose sets it | PostgreSQL connection string |
| `API_URL` | frontend container | `http://localhost:8080` | Backend URL **as seen by the browser**; read at container start, no rebuild needed |

Example: `HOLD_DURATION_SECONDS=30 docker compose up --build` gives 30-second holds, handy for trying expiry.

## Run the tests

Both suites run in Docker, nothing else to install:

```bash
# Backend (xUnit against a real PostgreSQL, includes the concurrency tests)
docker compose --profile test run --rm backend-tests

# Frontend (Vitest + React Testing Library)
docker compose --profile test run --rm frontend-tests
```

Without Docker: `cd backend && dotnet test SchoolAdmission.Tests` (needs .NET 8 SDK and a PostgreSQL reachable at the `TEST_CONNECTION_STRING`, default `localhost:5432`, user/password `school`; the `school_test` database is created automatically) and `cd frontend && npm install && npm test`.

Backend tests cover: 150 parallel holds on a 10-seat class never exceed 10; expiry frees seats and blocks confirm; confirm is idempotent and owner-only; cancel frees the seat; validation and 404s; all contract fields present; and **two backend instances sharing one database** never exceed the seat limit (bonus).

## API (matches the assignment contract)

| # | Method and path | Purpose |
|---|---|---|
| 1 | `POST /classes` | Create class |
| 2 | `GET /classes` | List classes with seat counts |
| 3 | `GET /classes/{classId}` | One class |
| 4 | `POST /classes/{classId}/holds` | Apply (`X-Student-Id` header); 409 if no seats |
| 5 | `GET /holds/{holdId}` | Hold status |
| 6 | `POST /holds/{holdId}/confirm` | Pay and confirm (idempotent) |
| 7 | `DELETE /holds/{holdId}` | Cancel, 204 |
| 8 | `GET /me/holds` | The student's applications |

Errors are JSON: `{ "error": "NO_SEATS", "message": "Sorry, there are no seats left in this class." }`.

## Project layout

```
backend/SchoolAdmission.Api     API, SQL and schema
backend/SchoolAdmission.Tests   xUnit tests
frontend/                       React app (+ nginx Dockerfile)
docker-compose.yml              db + backend + frontend (+ test profile)
ASSUMPTIONS.md                  decisions the brief left open, and the concurrency design
AI_USAGE.md                     how AI was used
```
