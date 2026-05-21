# EventHub — Booking Management Test Strategy

Generated: 2026-05-19
Scope: Layer assignment for the 58 scenarios in `docs/test-scenarios.md`.

Inputs:
- `docs/test-scenarios.md`
- `backend/src/services/bookingService.js`, `controllers/bookingController.js`, `validators/bookingValidator.js`
- `frontend/app/bookings/page.tsx`, `frontend/app/bookings/[id]/page.tsx`, `frontend/app/admin/bookings/page.tsx`
- `frontend/components/bookings/BookingCard.jsx`, `frontend/components/ui/*` (ConfirmDialog, Modal, Toast, EmptyState, Pagination)
- `tests/booking-management.spec.js` (existing E2E coverage)

---

## 1. Executive Summary

The booking-management feature is well-suited for a true pyramid because most of its behavior is either (a) pure logic in `bookingService.js` (FIFO pruning, ref generation, price math) or (b) deterministic API contracts (cancel/clear, ownership 403s, validation 400s). Only the multi-page journeys (book → list → detail → cancel) and the redirect-on-401 behavior truly require E2E.

The two highest-risk paths — **same-event FIFO fallback (TC-105)** which mutates `event.availableSeats`, and **cross-user 403 on every booking endpoint (TC-201, 202, 205, 206)** — must live at the API layer where they can be tested deterministically without UI flake.

The 4-second refund spinner (TC-006, 007, 103, 400, 401, 406, 407) is a **pure client-side state machine** with a `setTimeout`. It should be tested at the component layer with fake timers, **not at E2E** where it would force every test to spend ≥4 s of real time.

---

## 2. Layer Distribution

| Layer | Count | Focus | Approx. Run Time | Coverage % |
|---|---|---|---|---|
| **Unit** | 5 | Pure functions: ref generator, price math, collision retry | < 1 s total | 9% |
| **Component** | 24 | Refund state machine, dialogs, empty/loading/error states, badge gating, breadcrumb, admin modal/empty | ~5–10 s total | 41% |
| **API / Integration** | 22 | Ownership 403s, validation 400s, 404s, FIFO pruning, seat math, filtering, pagination | ~10–20 s total | 38% |
| **E2E** | 7 | Critical user journeys: book→detail→cancel, clear-all, admin cancel, list nav, access-denied UI, redirect-on-401, native confirm-dismiss | ~60–90 s total | 12% |
| **Total** | **58** |  |  | 100% |

The pyramid shape: 5 unit, 24 component, 22 API, 7 E2E.

---

## 3. Layer Assignments

### 3.1 Unit (5)

Test directly in Jest/Vitest against `backend/src/services/bookingService.js` helpers. No HTTP, no DB.

| ID | Title | Target function |
|---|---|---|
| TC-100 | Booking ref prefix is uppercased event title first letter | `randomRef(eventTitle)` |
| TC-107 | Booking ref is unique across all bookings (collision retry) | `generateUniqueRef(eventTitle)` with mocked `bookingRepository.findByRef` |
| TC-109 | totalPrice = event.price × quantity | The `parseFloat(event.price) * data.quantity` expression — extract into a `computeTotalPrice` helper for testability |
| TC-402 | Free event ($0) — total displays as $0 | Same helper as TC-109 with `price=0` |
| TC-411 | Booking ref collision retry path (timestamp fallback after 10) | `generateUniqueRef` with `findByRef` returning truthy 11 times |

### 3.2 Component (24)

Test with React Testing Library + Vitest, rendering the affected component with mocked React Query / props. Use `vi.useFakeTimers()` for refund spinner. Where the test needs network, mock at `bookingsApi` / fetch boundary.

| ID | Title | Target component |
|---|---|---|
| TC-006 | Refund eligibility — single-ticket eligible | `RefundEligibility` in `app/bookings/[id]/page.tsx` |
| TC-007 | Refund eligibility — multi-ticket ineligible | `RefundEligibility` |
| TC-011 | Admin bookings — view booking modal | `BookingModal` in `app/admin/bookings/page.tsx` |
| TC-103 | Refund spinner displays for ~4 seconds | `RefundEligibility` with `vi.useFakeTimers()` + `vi.advanceTimersByTime(4000)` |
| TC-207 | XSS via customer name neutralized | Booking detail page with a `customerName` containing `<script>` |
| TC-300 | Non-existent booking ID → "Booking not found" | Booking detail page with `useBooking` mocked to return 404 |
| TC-304 | List API failure shows error EmptyState with Retry | `BookingsContent` with `useBookings` mocked to `isError: true` |
| TC-305 | Cancel API failure shows error toast | Booking detail page with `useCancelBooking` mocked to throw |
| TC-306 | ConfirmDialog Cancel path does not delete | `ConfirmDialog` interaction; assert `onConfirm` NOT called |
| TC-400 | Refund eligibility with quantity = 1 (boundary) | `RefundEligibility quantity={1}` |
| TC-401 | Refund eligibility with quantity = 10 (boundary) | `RefundEligibility quantity={10}` |
| TC-406 | Refund double-click only schedules one timer | `RefundEligibility` with fake timers |
| TC-407 | Refund — unmount before 4 s does not throw | `RefundEligibility` rendered, unmounted before timer fires |
| TC-408 | Booking detail when linked event is deleted | Booking detail with `booking.event = null`; assert "Event Booking" fallback title |
| TC-409 | Long customer name renders without breaking layout | Booking detail with 100-char name (visual / DOM overflow check) |
| TC-413 | Cancel-in-flight cannot be triggered twice | `ConfirmDialog` with `isLoading=true` — assert confirm button disabled |
| TC-500 | Empty state — zero bookings | `BookingsContent` with empty list |
| TC-501 | Loading skeletons render | `BookingsContent` with `isLoading=true` |
| TC-502 | "Clearing…" label and disabled during clear-all | `BookingsContent` with `clearing` state asserted via mocked `bookingsApi.clearAll` |
| TC-503 | Refund result replaces button, green/red panel | `RefundEligibility` final-state DOM |
| TC-504 | Cancel Booking button hidden when status ≠ "confirmed" | Booking detail with `booking.status='cancelled'` |
| TC-505 | Pagination hidden when only 1 page | `BookingsContent` with `pagination.totalPages=1` |
| TC-507 | Toast on cancel error preserves dialog state | Booking detail with mocked cancel error |
| TC-508 | Breadcrumb on detail page shows ref | Booking detail DOM |
| TC-509 | Admin bookings — empty state under filter | `AdminBookingsPage` with `bookings=[]` |
| TC-510 | Admin "Cancel" hidden when status ≠ confirmed | `AdminBookingsPage` with mixed-status row |

### 3.3 API / Integration (22)

Test against the live Express app with a test DB (Prisma + MySQL). Use Playwright's `request` fixture (already available) or a Jest+Supertest setup. No browser.

| ID | Title | Endpoint / service |
|---|---|---|
| TC-008 | Lookup booking by reference | `GET /api/bookings/ref/:ref` |
| TC-012 | Ref first character matches event title first letter | `POST /api/bookings` × multiple events |
| TC-101 | Cancel restores seats on static event | `DELETE /api/bookings/:id` → `GET /api/events/:id` |
| TC-102 | Cancel restores seats on dynamic event | Same, against user-created event |
| TC-104 | FIFO — 10th booking removes oldest on different event | `POST /api/bookings` × 10; assert `findOldestUserBookingExcludingEvent` path |
| TC-105 | FIFO same-event fallback permanently burns a seat | `POST /api/bookings` × 10 all same event; assert `eventRepository.decrementSeats` was applied |
| TC-106 | Cancelled booking frees a slot in 9-booking limit | DELETE then POST sequence |
| TC-108 | Status always "confirmed" on creation | `POST /api/bookings` with `status: 'cancelled'` in body — verify response is still `confirmed` |
| TC-110 | Clear all only removes auth user's bookings | Two users; clear A; verify B unaffected |
| TC-201 | User B cannot cancel A's booking | `DELETE /api/bookings/:id` as User B → 403 |
| TC-202 | User B's list excludes A's bookings | `GET /api/bookings` as User B |
| TC-203 | Unauthenticated `/api/bookings/:id` → 401 | No `Authorization` header |
| TC-205 | User B cannot look up A's booking by ref | `GET /api/bookings/ref/:ref` cross-user |
| TC-206 | Cross-user booking ID enumeration blocked | Sweep IDs as User B; all 403 |
| TC-208 | SQL-injection-style booking ID rejected | `GET /api/bookings/1 OR 1=1` |
| TC-301 | Cancel non-existent booking → 404 | `DELETE /api/bookings/99999999` |
| TC-302 | Cancel already-cancelled booking → 404 | Double DELETE |
| TC-303 | Clear all when zero bookings | `DELETE /api/bookings` returns `{ deleted: 0 }` |
| TC-308 | Booking ref lookup non-existent ref → 404 | `GET /api/bookings/ref/Z-NOTREAL` |
| TC-309 | Booking ref lookup malformed ref → 404 | `GET /api/bookings/ref/!!@@%%` |
| TC-310 | GET booking with non-numeric id | `GET /api/bookings/abc` |
| TC-403 | Bookings list at FIFO ceiling shows 9 | Seed 9; `GET /api/bookings?limit=10` |
| TC-405 | Clear all when 9 bookings | Seed 9; `DELETE /api/bookings` |
| TC-410 | Bookings filtered by eventId | `GET /api/bookings?eventId=E1` |
| TC-412 | Pagination limit ceiling honored | `GET /api/bookings?page=1&limit=5` |

### 3.4 E2E — Playwright (7)

| ID | Title | Why E2E |
|---|---|---|
| TC-001 | View bookings list with existing bookings | Critical happy path; verifies full-stack render through `useBookings` + `BookingCard` |
| TC-003 | Cancel a single booking from detail page | Critical journey + toast + redirect + state cleanup |
| TC-005 | Clear all bookings | Critical journey + native `confirm()` dialog + empty-state transition |
| TC-009 | Bookings list pagination — navigate to page 2 | URL state (`?page=2`) handled by Next.js router — not realistic in component |
| TC-200 | User B cannot view A's booking detail page (UI) | The 403 → "Access Denied" rendering integrates the API client, React Query, and route — component test would not exercise the interceptor |
| TC-204 | Unauthenticated visit to `/bookings` redirects to login | The 401 interceptor in `lib/api/client.js` only triggers in a real browser session |
| TC-307 | "Clear all" — declining native `confirm()` does NOT clear | `window.confirm` behavior only exists in a real browser |

**Demoted from E2E** (handled at lower layers, listed for transparency):
- TC-002 booking detail page → covered by component-level rendering tests for sections + one E2E smoke from TC-003 which already lands on the detail page
- TC-004 admin cancel → API (TC-201) + component (TC-510) cover the logic; UI is the same `ConfirmDialog` already covered
- TC-010 admin filter by status → component-level with mocked data
- TC-011 admin modal → component (already assigned)
- TC-404 cancel only booking → E2E smoke TC-003 already lands on the empty state
- TC-506 toast on successful cancel → asserted inside TC-003
- TC-511 sandbox banner → component with mocked counts (real banner state is hard to drive deterministically at E2E without seeding 5+ bookings)

---

## 4. Contested Decisions (Rationale)

**TC-103 (4-second refund spinner) → Component, not E2E**
At E2E this would burn 4 s of real wall-clock per run. With Vitest fake timers, the test runs in milliseconds and is more precise: we can assert "exactly 4000 ms" rather than "between 3.5 s and 4.5 s". The state-machine being tested (`idle → checking → eligible|ineligible`) is entirely client-side; nothing about it is integration-sensitive.

**TC-105 (Same-event FIFO fallback) → API, not Unit**
The branch calls `eventRepository.decrementSeats` *and* deletes the oldest booking *and* creates a new booking in one service call. Mocking three repository methods at unit level would test the mock structure, not the behavior. At the API layer with a real DB we can assert "available seats permanently dropped by 1" — the actual contract we care about.

**TC-200 (cross-user UI Access Denied) → E2E, not Component**
The component-side branch is `(error as any)?.status === 403`. We'd be mocking the error to mock the test. The real risk is the interceptor / React Query error path / Next.js routing — the integration. Plus the rendered "Access Denied" string is a customer-facing string we want to fail loudly on if changed accidentally. The API-side cross-user 403 is already covered by TC-201/TC-202/TC-205/TC-206.

**TC-207 (XSS via customerName) → Component**
Tempting to put at E2E, but the protection is React's text-node escaping, which works the same in any environment. A component test with a `<script>` payload + `expect(window.__pwned).toBeUndefined()` is faster and equally trustworthy. If we wanted to test the API not stripping it (which is also fine, since output escaping is the defense), that's a separate API-layer assertion on `customerName` round-trip.

**TC-307 (native `confirm()` dismissal) → E2E**
The dismiss happens in the browser's native dialog UI. Component tests with JSDOM auto-stub `window.confirm` to return `true` — that defeats the test. Only Playwright's `page.on('dialog', d => d.dismiss())` can exercise the real "user clicked Cancel" path.

**TC-012 vs TC-100 (ref prefix)** — both included intentionally for **defense in depth**: TC-100 is a unit test on the generator (fast, narrow); TC-012 is an API contract test (catches regressions in event title extraction or repository chain that the unit test would miss).

---

## 5. Anti-Patterns Found in `tests/booking-management.spec.js`

### A. Scenario-ID drift between scenarios doc and tests
The current spec contains:
- `TC-006: navigates to bookings list after booking via View My Bookings link` — but scenarios-doc TC-006 is "Refund eligibility — single-ticket eligible"
- `TC-102: booking reference starts with first letter of event title` — but scenarios-doc TC-102 is "Cancel restores seats on dynamic event"; the ref-prefix rule is TC-012 / TC-100
- `TC-004: clears all bookings and shows empty state` — but scenarios-doc TC-004 is "Cancel from admin bookings table"; this maps to TC-005

**Action**: When `/generate-tests` runs, re-map test IDs to match the new scenarios doc. Don't carry the drift forward.

### B. Ref-prefix assertion lives at E2E (should be Unit/API)
`tests/booking-management.spec.js:156-168` asserts `^[A-Z]-[A-Z0-9]{6}$` against a regex after booking through the UI. This is a pure-function rule. Moving it to a unit test on `randomRef` would (a) run in milliseconds vs ~10 s of UI clicks and (b) deterministically test the digit-titled edge case ("3-Day Bootcamp" → `3-XXXXXX`) without seeding such an event in the UI.

### C. State setup via UI clicks instead of API
Every test does `login → clearBookings → bookEvent` via the UI. That's ~5 s of click-through per test before the actual assertion. For tests where the precondition isn't what's under test, use `request.post('/api/bookings', { headers: { Authorization: \`Bearer ${token}\` } })` to seed state, then drive the UI only for the assertion under test.

### D. No API-layer tests at all
The spec covers only E2E. Validation errors, 401/403/404 responses, FIFO pruning, and ownership checks are all asserted (when asserted at all) by walking the UI. This is the classic ice-cream cone. The plan above moves 22 scenarios down to the API layer — most of which can be expressed in <10 lines each.

### E. Test data not isolated per run
`'Test User'` / `'testuser@example.com'` / `'9876543210'` are reused across all tests. Combined with `fullyParallel: false` this works today, but it makes it impossible to assert customer-name values precisely and would block any future parallelization. Use `\`Test User ${Date.now()}\`` per scenario.

### F. No defensive console-error listener
TC-407 ("navigate away before 4 s") and similar timer-cleanup tests rely on console-error monitoring. The current spec never registers `page.on('pageerror', ...)`. When adding TC-407, the harness must capture and assert no errors.

---

## 6. Infrastructure Gaps

The strategy above assumes three test runners; the project currently has only one.

| Layer | Required tooling | Present in repo? |
|---|---|---|
| Unit | Vitest or Jest with `backend/src` imports | **No** — no `vitest.config.*` or `jest.config.*` |
| Component | Vitest + React Testing Library + JSDOM | **No** |
| API | Either (a) Playwright `request` fixture (already available) or (b) Supertest + Jest | **Partial** — `request` fixture is available via Playwright but unused for booking endpoints |
| E2E | Playwright | **Yes** |

**Recommended order to close gaps**:
1. **API tests first** — Use Playwright's `request` fixture in a new `tests/api/bookings.spec.js`. Zero new dependencies, biggest immediate ROI (covers 22 scenarios).
2. **Unit tests second** — Add Vitest + a `backend/test/` directory. Covers the 5 pure-function scenarios in milliseconds.
3. **Component tests last** — Vitest + RTL. Largest tooling investment, but pays back across 24 scenarios that currently have no home.

---

## 7. Defense-in-Depth Map (Highest-Risk Rules)

The following rules from `business-rules.md` justify coverage at multiple layers:

| Rule | Unit | Component | API | E2E |
|---|---|---|---|---|
| Booking ref format (`§7`) | TC-100, TC-107, TC-411 | — | TC-012 | covered transitively by TC-001 |
| Cancel restores seats (`§4`, `§6`) | — | — | TC-101, TC-102 | TC-003 |
| FIFO 9-booking limit (`§4`) | — | — | TC-104, TC-105, TC-106, TC-403, TC-405 | — |
| Cross-user 403 (`§2`) | — | — | TC-201, TC-202, TC-205, TC-206 | TC-200, TC-204 |
| Refund eligibility (`§8`) | — | TC-006, TC-007, TC-103, TC-400, TC-401, TC-406, TC-407, TC-503 | — | — |
| Price calc (`§9`) | TC-109, TC-402 | — | — | — |

The two "lonely" cells (rules covered at only one layer) are intentional:
- **Refund eligibility** is purely client-side — no API or unit layer makes sense.
- **Price calc** is a pure function — adding API/E2E coverage would be redundant.

All other high-risk rules have at least two layers of coverage.

---

## 8. Next Step

Hand this strategy to `/generate-tests <layer> <feature>` to produce the actual test files. Recommended generation order:

1. `/generate-tests api booking-management` — 22 API tests (highest ROI, no new infra)
2. `/generate-tests unit booking-management` — 5 unit tests (after Vitest is wired in)
3. `/generate-tests component booking-management` — 24 component tests
4. `/generate-tests e2e booking-management` — 7 E2E tests (replace the existing 6 in `tests/booking-management.spec.js` with the new IDs and remove ref-prefix assertion)
