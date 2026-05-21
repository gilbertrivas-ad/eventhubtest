# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
EventHub is a full-stack event ticket booking platform used for QA training. Authenticated users browse events, book tickets, manage bookings, and create their own events. Each user operates in an isolated sandbox (user-scoped events and bookings, FIFO limits to keep state tidy).

## Tech Stack
- **Frontend**: Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, React Query v5, Axios — `frontend/` on port 3000
- **Backend**: Express 4.21, Prisma 5.22 (MySQL 8+), express-validator, Swagger UI at `/api/docs` — `backend/` on port 3001
- **Auth**: JWT (7-day expiry) via `jsonwebtoken`, password hashing via `bcryptjs`
- **Testing**: Playwright E2E (Chromium only), targeting the deployed env at `eventhub.rahulshettyacademy.com`

## Commands
Run from the repo root unless noted. Root `package.json` proxies into `backend/` and `frontend/`.

```bash
npm run setup              # Install deps in both backend and frontend
npm run dev                # Start backend (3001) + frontend (3000) concurrently
npm run seed               # Insert 10 static seed events
npm run db:push            # Push Prisma schema to DB (non-interactive)
npm run migrate            # prisma migrate dev (interactive, creates migration files)
npm run build              # Build the Next.js frontend
npm run lint               # ESLint on the frontend
npm test                   # Run all Playwright tests
npm run test:ui            # Playwright UI mode
npm run test:report        # Show the last Playwright HTML report

npx playwright test tests/<file>.spec.js --reporter=line   # Single test file
npx playwright test -g "<title pattern>" --reporter=line   # Single test by name
```

DB setup requires `backend/.env` with `DATABASE_URL`, `PORT`, `CORS_ORIGIN`, and a JWT secret. Frontend needs `frontend/.env.local` with `NEXT_PUBLIC_API_URL` (see `README.md` for full bootstrap).

## Architecture

**Backend** is a strict layered architecture — do not let lower layers leak upward, do not let HTTP concerns leak downward:
```
Routes (Express + Swagger JSDoc)
  → Controllers (HTTP shape only)
    → Services (business logic, transactions, domain errors)
      → Repositories (pure Prisma queries)
        → Prisma / MySQL
```
- Domain errors (`NotFoundError`, `ForbiddenError`, `InsufficientSeatsError`, `ValidationError`) live in `backend/src/utils/errors.js` and are mapped to HTTP responses by `middleware/errorHandler.js`. Throw domain errors from services; never `res.status()` from a service.
- `middleware/authMiddleware.js` verifies the JWT and sets `req.user`. Most `/api/events` and all `/api/bookings` routes require it; only auth endpoints and a small public surface (`/api/health`, `/api/config`, public event reads) are open.
- All booking/event mutations are user-scoped via `req.user.id`. Cross-user reads return Forbidden — preserve this when changing service code.

**Frontend** (Next.js 14 App Router):
- Pages live in `frontend/app/`: `events/`, `bookings/`, `admin/events/`, `admin/bookings/`, plus `login/` and `register/`.
- React Query (`lib/hooks/useEvents.ts`, `useBookings.ts`, `useAuth.ts`) owns server state; mutations invalidate the relevant query keys.
- Auth token is stored client-side and attached by `lib/api/client.js` (Axios interceptor). The same client surfaces 401 → redirect-to-login behavior.
- `data-testid` attributes are the contract with the test suite — when changing UI, preserve testids (see `README.md` for the canonical list).

**Data model** (`backend/prisma/schema.prisma`): `User → Event → Booking` with cascade deletes. `Event.isStatic` marks seeded events as immutable; `availableSeats` is decremented atomically on booking and restored on cancel inside a Prisma transaction.

## Key Business Rules
These are enforced in services and asserted in tests — keep them in sync:
- **Max 6 user-created events per user**; FIFO pruning on overflow.
- **Max 9 bookings per user**; FIFO pruning on overflow (prefers pruning a booking from a *different* event than the one being booked).
- **Booking reference format**: `{first letter of event title, uppercased}-{6 alphanumeric chars}`. Collision retry up to 10 attempts before timestamp fallback.
- **Seat counts** decrement on booking, restore on cancel.
- **Refund eligibility**: quantity `=1` is refund-eligible, `>1` is not (client-side gate).
- **Static (seeded) events are immutable** — services reject mutations on `isStatic: true`.
- **Cross-user access returns "Access Denied"** for bookings/events not owned by the requester.

## Testing
- Tests live in `tests/` as `<feature-name>.spec.js`.
- `playwright.config.ts` uses `baseURL: https://eventhub.rahulshettyacademy.com` — **tests run against the deployed sandbox, not local dev**. You do not need `npm run dev` running to execute tests.
- Test account: `rahulshetty1@gmail.com` / `Magiclife1!` (lives in the deployed sandbox).
- Locator priority: `data-testid` > role > label/placeholder > ID > CSS class.
- Never `page.waitForTimeout()` — use `expect(...).toBeVisible()` and other web-first assertions.
- Tests must be self-contained (log in → act → assert → clean up).
- `fullyParallel: false` and `retries: 0` are intentional — flake should fail loudly, not hide.

## Slash Commands & Skills
User-invocable slash commands are implemented as Claude Code skills in `.claude/skills/<name>/SKILL.md`:
- `/generate-tests <feature>` — generate Playwright tests for a feature
- `/review-tests <file>` — review test code quality
- `/create-scenarios <area>` — produce a test scenario document
- `/test-strategy <scenarios>` — assign scenarios to pyramid layers

Reference skills (not user-invocable, loaded as context when relevant):
- `.claude/skills/playwright-best-practices/SKILL.md` — Playwright standards
- `.claude/skills/eventhub-domain/SKILL.md` — domain knowledge, plus `api-reference.md`, `business-rules.md`, `user-flows.md`, `ui-selectors.md` in the same folder

## Docs
- `docs/test-scenarios.md` — canonical scenario catalog
- `docs/test-strategy.md` — pyramid-layer assignment + rationale
- `README.md` — environment bootstrap, full endpoint list, complete `data-testid` reference

## CI
`.github/workflows/` contains `ci.yml` (lint + tests) and `deploy.yml`. CI sources env vars from `.env` for Prisma 5 compatibility (see recent commit history) — do not switch back to passing them as raw shell args.

## Code Style
- Backend: JavaScript with JSDoc for Swagger generation; CommonJS modules; keep controllers thin and services pure.
- Frontend: TypeScript where files are `.ts`/`.tsx`; React hooks; Tailwind utility classes; no CSS modules.
- Tests: JavaScript (`.spec.js`), Playwright test runner.
