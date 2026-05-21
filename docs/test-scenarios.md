# EventHub — Booking Management Test Scenarios

Generated: 2026-05-19
Scope: Booking Management (Flow 4) — viewing the bookings list, viewing booking detail, cancelling a booking, clearing all bookings, refund eligibility check, cross-user isolation, FIFO pruning, and the admin bookings table.

Sources:
- `eventhub-domain` skill (overview, business-rules, user-flows, api-reference, ui-selectors)
- `backend/src/services/bookingService.js` — FIFO pruning, ref generation, cancel/clear logic
- `backend/src/validators/bookingValidator.js` — input validation rules
- `frontend/app/bookings/page.tsx` — list, clear-all UX, empty/error states
- `frontend/app/bookings/[id]/page.tsx` — detail, cancel, 4-second refund spinner
- `frontend/app/admin/bookings/page.tsx` — admin table, status filter, modal

---

## Happy Path (TC-001–099)

### TC-001: View bookings list with existing bookings
**Category**: Happy Path
**Priority**: P0
**Preconditions**: User is logged in; user has ≥1 confirmed booking
**Steps**:
1. Navigate to `/bookings`
2. Wait for the list to render
**Expected Results**: Page title "My Bookings" + subtitle "View and manage all your ticket bookings" is visible. One `#booking-card` element appears per booking, each showing booking reference, event title, quantity, total price, and a "View Details" link. The "Clear all bookings" link is visible in the header.
**Business Rule**: Flow 4 — Manage Bookings
**Suggested Layer**: E2E

---

### TC-002: View single booking detail page
**Category**: Happy Path
**Priority**: P0
**Preconditions**: User is logged in; user has ≥1 confirmed booking
**Steps**:
1. Navigate to `/bookings`
2. Click "View Details" on a booking card
3. Land on `/bookings/:id`
**Expected Results**: Detail page renders four sections — Event Details (title, category, date, venue, city), Customer Details (name, email, phone), Payment Summary (tickets, price/ticket, total paid), Booking Information (booked on, booking ID). Header shows booking ref + confirmed badge. Breadcrumb shows `My Bookings / <ref>`. "Cancel Booking" button is visible.
**Business Rule**: Booking model fields; Flow 4
**Suggested Layer**: E2E

---

### TC-003: Cancel a single booking from the detail page
**Category**: Happy Path
**Priority**: P0
**Preconditions**: User is logged in; user has ≥1 confirmed booking
**Steps**:
1. Open a booking at `/bookings/:id`
2. Click "Cancel Booking"
3. In the ConfirmDialog, click "Yes, cancel it"
**Expected Results**: Success toast "Booking cancelled successfully" appears, user is redirected to `/bookings`, the cancelled booking no longer appears in the list, and the seat count for the associated event is restored (re-verify by visiting the event detail page).
**Business Rule**: Booking deletion (cancellation) immediately frees seats (business rule §4, §6)
**Suggested Layer**: E2E

---

### TC-004: Cancel a booking from the admin bookings table
**Category**: Happy Path
**Priority**: P1
**Preconditions**: User is logged in with ≥1 confirmed booking
**Steps**:
1. Navigate to `/admin/bookings`
2. Click "Cancel" on a row whose status is "confirmed"
3. Confirm the dialog
**Expected Results**: Toast "Booking cancelled" appears, the table refetches, and the row is removed (or status flips to cancelled if status filter shows all).
**Business Rule**: Same as TC-003
**Suggested Layer**: E2E

---

### TC-005: Clear all bookings
**Category**: Happy Path
**Priority**: P0
**Preconditions**: User is logged in with ≥2 confirmed bookings
**Steps**:
1. Navigate to `/bookings`
2. Click "Clear all bookings"
3. Accept the native `confirm()` dialog
**Expected Results**: The "Clearing…" text appears briefly on the button, list refetches, all the user's bookings are removed, and the "No bookings yet" empty state is shown with a Browse Events CTA.
**Business Rule**: Business rule §4 — "Clear All Bookings"
**Suggested Layer**: E2E

---

### TC-006: Refund eligibility — single-ticket booking is eligible
**Category**: Happy Path
**Priority**: P0
**Preconditions**: User is logged in with a confirmed booking where `quantity === 1`
**Steps**:
1. Open `/bookings/:id`
2. Click `#check-refund-btn`
3. Observe spinner for ~4 seconds
**Expected Results**: `#refund-spinner` is visible with text "Checking your refund eligibility…". After ~4 s, `#refund-result` replaces it showing green styling and text "Eligible for refund. Single-ticket bookings qualify for a full refund."
**Business Rule**: Business rule §8 — refund eligibility (quantity = 1)
**Suggested Layer**: E2E

---

### TC-007: Refund eligibility — multi-ticket booking is not eligible
**Category**: Happy Path
**Priority**: P0
**Preconditions**: User is logged in with a confirmed booking where `quantity > 1` (e.g., 3)
**Steps**:
1. Open `/bookings/:id`
2. Click `#check-refund-btn`
3. Wait ~4 seconds
**Expected Results**: `#refund-result` shows red styling and text "Not eligible for refund. Group bookings (3 tickets) are non-refundable." The quantity in the message matches the booking quantity exactly.
**Business Rule**: Business rule §8 — refund eligibility (quantity > 1)
**Suggested Layer**: E2E

---

### TC-008: Lookup booking by reference via API
**Category**: Happy Path
**Priority**: P1
**Preconditions**: Authenticated user with a confirmed booking; valid Bearer token
**Steps**:
1. GET `/api/bookings/ref/:bookingRef` with the user's token
**Expected Results**: 200 OK with `{ data: { id, bookingRef, eventId, userId, customerName, customerEmail, customerPhone, quantity, totalPrice, status, event: {...} } }`. Reference matches the requested value.
**Business Rule**: api-reference — `GET /api/bookings/ref/:ref`
**Suggested Layer**: API

---

### TC-009: Bookings list pagination — navigate to page 2
**Category**: Happy Path
**Priority**: P2
**Preconditions**: User is logged in with >10 bookings (set `limit=10` per page)
**Steps**:
1. Navigate to `/bookings`
2. Click pagination "2"
**Expected Results**: URL updates to `?page=2`, list refetches with the second page of bookings, current page indicator highlights "2".
**Business Rule**: Business rule §4 — pagination on bookings page
**Suggested Layer**: E2E

---

### TC-010: Admin bookings — filter by status
**Category**: Happy Path
**Priority**: P2
**Preconditions**: User has both confirmed bookings (live data set has only "confirmed", but the filter must still work)
**Steps**:
1. Navigate to `/admin/bookings`
2. Change the status `Select` to "Confirmed"
**Expected Results**: Page resets to page 1, table refetches, all rows display a green "confirmed" badge, the total count reflects only confirmed bookings.
**Business Rule**: api-reference — `?status` query param
**Suggested Layer**: E2E

---

### TC-011: Admin bookings — view booking modal
**Category**: Happy Path
**Priority**: P2
**Preconditions**: User has ≥1 booking
**Steps**:
1. Navigate to `/admin/bookings`
2. Click "View" on a row
**Expected Results**: Modal "Booking — <ref>" opens with sections Reference, Status, Event (title/date/city), Customer (name/email/phone), Tickets, Total, Booked on. Closing returns focus to the table.
**Business Rule**: Flow 5 — Admin view
**Suggested Layer**: E2E

---

### TC-012: Booking ref first character matches event title first letter
**Category**: Happy Path / Business Rule contract
**Priority**: P0
**Preconditions**: User books any event (e.g., "Tech Summit")
**Steps**:
1. Complete booking flow
2. Read the booking ref shown on the detail page
**Expected Results**: Ref matches pattern `^[A-Z]-[A-Z0-9]{6}$` AND first character equals `event.title[0].toUpperCase()`.
**Business Rule**: Business rule §7 — booking reference format
**Suggested Layer**: API (faster) + E2E smoke

---

## Business Rules (TC-100–199)

### TC-100: Booking ref prefix is uppercased event title first letter
**Category**: Business Rule
**Priority**: P0
**Preconditions**: Bookings exist for events whose titles begin with letters (A, T) and a digit (e.g., title "3-Day Bootcamp")
**Steps**:
1. Create one booking per event via API
2. Inspect each returned `bookingRef`
**Expected Results**: Letter-titled events produce refs prefixed with their uppercase first letter. Digit-titled event produces a digit-prefixed ref (`3-XXXXXX`), since `toUpperCase()` is a no-op on digits.
**Business Rule**: Business rule §7
**Suggested Layer**: Unit (ref generator) + API

---

### TC-101: Cancelling a booking restores seats on a static event
**Category**: Business Rule
**Priority**: P0
**Preconditions**: User logged in; create a booking for a static event with `quantity = 2`
**Steps**:
1. Read `availableSeats` on the event detail page before booking → `S`
2. Book 2 tickets
3. Verify `availableSeats` on the event detail page is `S - 2`
4. Cancel the booking
5. Re-read `availableSeats`
**Expected Results**: After cancellation, `availableSeats` returns to `S` (per-user computed: `totalSeats - sum(user's booking quantities)`).
**Business Rule**: Business rule §6 — per-user seat availability
**Suggested Layer**: E2E or API

---

### TC-102: Cancelling a booking restores seats on a dynamic (user-created) event
**Category**: Business Rule
**Priority**: P0
**Preconditions**: User created a dynamic event with `totalSeats = 5`; has booked 3 of them
**Steps**:
1. Verify `availableSeats` reads 2
2. Cancel the booking
3. Re-read `availableSeats`
**Expected Results**: `availableSeats` returns to 5. Confirms the per-user computed availability path (no DB write needed on dynamic events).
**Business Rule**: Business rule §6
**Suggested Layer**: API

---

### TC-103: Refund spinner displays for ~4 seconds before result
**Category**: Business Rule
**Priority**: P1
**Preconditions**: User on a booking detail page
**Steps**:
1. Click `#check-refund-btn`
2. Measure time until `#refund-result` becomes visible
**Expected Results**: `#refund-spinner` is visible for between 3.5 s and 4.5 s; the result then replaces it. Button is gone during spinner.
**Business Rule**: Business rule §8 — 4-second spinner
**Suggested Layer**: E2E (with `setTimeout` mocking via clock when possible)

---

### TC-104: FIFO pruning — 10th booking removes the oldest booking on a different event
**Category**: Business Rule
**Priority**: P0
**Preconditions**: User has exactly 9 confirmed bookings spread across at least 2 different events; oldest is for event A
**Steps**:
1. Create a 10th booking for event B
2. Refetch `/api/bookings`
**Expected Results**: Total booking count is still 9. The booking previously identified as the oldest (event A) is no longer in the list. The new booking for event B is present.
**Business Rule**: Business rule §4 — FIFO booking pruning; service `findOldestUserBookingExcludingEvent`
**Suggested Layer**: API

---

### TC-105: FIFO pruning fallback — when all 9 bookings are for the same event, oldest is pruned and a seat is permanently burned
**Category**: Business Rule
**Priority**: P1
**Preconditions**: User has 9 bookings all for a static event with `totalSeats = T`; seats consumed = sum of quantities
**Steps**:
1. Record `availableSeats` on the event before pruning → `A_before`
2. Create a 10th booking for the same event with `quantity = 1`
3. Read `availableSeats` after → `A_after`
**Expected Results**: Total bookings remain 9; the oldest of the same-event bookings is deleted. `eventRepository.decrementSeats` is invoked: `availableSeats` for the event itself drops by 1 permanently. This is the "same-event fallback" branch.
**Business Rule**: `bookingService.createBooking` — `sameEventFallback`
**Suggested Layer**: API + Integration

---

### TC-106: Cancelled booking frees seats and frees one of the 9 booking slots
**Category**: Business Rule
**Priority**: P1
**Preconditions**: User has 9 bookings (at FIFO limit)
**Steps**:
1. Cancel any 1 booking
2. Create a new booking
**Expected Results**: After step 1, booking count is 8. After step 2, count is 9. No older booking gets pruned (because the limit was not yet reached at create time).
**Business Rule**: Business rules §4 + §6
**Suggested Layer**: API

---

### TC-107: Booking ref is unique across all bookings
**Category**: Business Rule
**Priority**: P1
**Preconditions**: Multiple bookings exist
**Steps**:
1. Fetch all bookings via API (admin path or seeded set)
2. Extract `bookingRef` values
**Expected Results**: All refs are unique. (Generator retries up to 10 times, then falls back to timestamp suffix — both paths must remain unique.)
**Business Rule**: Business rule §7
**Suggested Layer**: Unit (mock collision) + API

---

### TC-108: Booking status is always "confirmed" on creation
**Category**: Business Rule
**Priority**: P1
**Preconditions**: User is logged in
**Steps**:
1. Create a booking via API with valid payload
**Expected Results**: Response includes `status: "confirmed"` regardless of whether `status` was supplied in the request body.
**Business Rule**: `bookingService.createBooking` — hardcoded `status: 'confirmed'`
**Suggested Layer**: API

---

### TC-109: totalPrice equals event.price × quantity
**Category**: Business Rule
**Priority**: P0
**Preconditions**: Event with known price (e.g., $1499)
**Steps**:
1. Book the event with `quantity = 3`
2. Read `totalPrice` on detail page and via API
**Expected Results**: `totalPrice = 4497`. Detail page formats as `$4,497` (en-US currency, 0 decimal places per `fmt_price`).
**Business Rule**: Business rule §9
**Suggested Layer**: API + E2E

---

### TC-110: Clear all bookings only removes the authenticated user's bookings
**Category**: Business Rule
**Priority**: P0
**Preconditions**: User A and User B each have ≥1 booking
**Steps**:
1. As User A: DELETE `/api/bookings`
2. As User B: GET `/api/bookings`
**Expected Results**: User A's bookings count becomes 0; User B's bookings are unaffected. Response from delete includes `{ deleted: <userA count> }`.
**Business Rule**: Business rule §2 — sandbox isolation
**Suggested Layer**: API

---

## Security (TC-200–299)

### TC-200: User B cannot view User A's booking detail page (UI)
**Category**: Security
**Priority**: P0
**Preconditions**: User A has booking with id `X`; User B is a separate authenticated user
**Steps**:
1. As User A, capture `X`
2. Log out, log in as User B
3. Navigate to `/bookings/X`
**Expected Results**: EmptyState renders with title "Access Denied" and description "You are not authorized to view this booking." (driven by 403 from API). A "View My Bookings" CTA is shown. No booking details are leaked.
**Business Rule**: Business rule §2 — cross-user 403; service `getBookingById` ForbiddenError
**Suggested Layer**: E2E

---

### TC-201: User B cannot cancel User A's booking (API)
**Category**: Security
**Priority**: P0
**Preconditions**: User A has booking `X`; User B has a valid token
**Steps**:
1. DELETE `/api/bookings/X` with User B's Bearer token
**Expected Results**: 403 Forbidden with message indicating not owner. The booking remains intact for User A.
**Business Rule**: `bookingService.cancelBooking` — ForbiddenError
**Suggested Layer**: API

---

### TC-202: User B's `/api/bookings` list never includes User A's bookings
**Category**: Security
**Priority**: P0
**Preconditions**: User A has ≥1 booking; User B has ≥1 different booking
**Steps**:
1. GET `/api/bookings` as User B
**Expected Results**: Response contains only bookings whose `userId === User B.id`. No booking IDs from User A's set appear.
**Business Rule**: Business rule §2
**Suggested Layer**: API

---

### TC-203: Unauthenticated request to `/api/bookings/:id` returns 401
**Category**: Security
**Priority**: P0
**Preconditions**: A valid booking ID exists
**Steps**:
1. GET `/api/bookings/:id` with no `Authorization` header
**Expected Results**: 401 Unauthorized; no booking data leaked.
**Business Rule**: `authMiddleware`
**Suggested Layer**: API

---

### TC-204: Unauthenticated visit to `/bookings` redirects to login
**Category**: Security
**Priority**: P0
**Preconditions**: No JWT in localStorage
**Steps**:
1. Navigate to `/bookings`
**Expected Results**: API client intercepts the 401, clears the token, and redirects to `/login`.
**Business Rule**: `lib/api/client.js` 401 interceptor
**Suggested Layer**: E2E

---

### TC-205: User B cannot look up User A's booking by ref
**Category**: Security
**Priority**: P1
**Preconditions**: User A has booking with `bookingRef = T-XXXXXX`
**Steps**:
1. As User B: GET `/api/bookings/ref/T-XXXXXX`
**Expected Results**: 403 Forbidden ("You do not own this booking"), not 200, not a leak of customer fields.
**Business Rule**: `bookingService.getBookingByRef`
**Suggested Layer**: API

---

### TC-206: Cross-user booking ID enumeration is blocked
**Category**: Security
**Priority**: P1
**Preconditions**: User A has booking ids 100, 101, 102; User B is authenticated
**Steps**:
1. As User B, GET `/api/bookings/100`, `/101`, `/102`
**Expected Results**: Every request returns 403, never 200. Response body does not include the customer name/email/phone of User A's bookings.
**Business Rule**: Business rule §2
**Suggested Layer**: API

---

### TC-207: XSS via customer name is neutralized on detail page
**Category**: Security
**Priority**: P2
**Preconditions**: Create a booking whose `customerName` is `<script>window.__pwned=1</script>` (≥2 chars, passes validator)
**Steps**:
1. Open the booking detail page
2. Check `window.__pwned` is undefined in the page context
**Expected Results**: The script tag is rendered as text via React's escape, not executed. `window.__pwned` is `undefined`.
**Business Rule**: React auto-escaping in `{booking.customerName}`
**Suggested Layer**: E2E

---

### TC-208: SQL-injection-style booking ID is rejected
**Category**: Security
**Priority**: P2
**Preconditions**: Authenticated user
**Steps**:
1. GET `/api/bookings/1 OR 1=1` (URL-encoded)
**Expected Results**: 400 or 404 (Prisma parses int and rejects), never returns the full bookings list.
**Business Rule**: Prisma typing on `id`
**Suggested Layer**: API

---

## Negative (TC-300–399)

### TC-300: View non-existent booking ID → "Booking not found"
**Category**: Negative
**Priority**: P0
**Preconditions**: Authenticated user
**Steps**:
1. Navigate to `/bookings/99999999`
**Expected Results**: EmptyState renders with title "Booking not found" and description "This booking doesn't exist or may have been cancelled." (driven by 404).
**Business Rule**: `getBookingById` NotFoundError
**Suggested Layer**: E2E

---

### TC-301: Cancel a non-existent booking returns 404
**Category**: Negative
**Priority**: P1
**Preconditions**: Authenticated user
**Steps**:
1. DELETE `/api/bookings/99999999`
**Expected Results**: 404 Not Found, response includes `Booking with id 99999999 not found`.
**Business Rule**: `cancelBooking` NotFoundError
**Suggested Layer**: API

---

### TC-302: Cancel an already-cancelled (deleted) booking returns 404
**Category**: Negative
**Priority**: P1
**Preconditions**: Booking `X` exists; cancel it once
**Steps**:
1. DELETE `/api/bookings/X` again
**Expected Results**: 404, message references the missing booking. Front-end shows "Booking not found" EmptyState if it lands on detail page.
**Business Rule**: Same as TC-301
**Suggested Layer**: API + E2E

---

### TC-303: Clear all bookings when user has zero bookings
**Category**: Negative
**Priority**: P2
**Preconditions**: Authenticated user with 0 bookings
**Steps**:
1. DELETE `/api/bookings`
**Expected Results**: 200 OK with `{ deleted: 0 }`. UI continues to show the "No bookings yet" empty state.
**Business Rule**: `clearAllBookings`
**Suggested Layer**: API

---

### TC-304: List API failure shows error EmptyState with Retry
**Category**: Negative
**Priority**: P1
**Preconditions**: Authenticated user; backend deliberately returns 500 (or network is offline)
**Steps**:
1. Navigate to `/bookings`
**Expected Results**: EmptyState renders with title "Couldn't load bookings", description "Failed to connect to the server. Please try again.", and a Retry button. Clicking Retry calls `refetch`.
**Business Rule**: `useBookings` `isError` branch
**Suggested Layer**: E2E (with network mocking)

---

### TC-305: Cancel API failure shows error toast and keeps user on detail page
**Category**: Negative
**Priority**: P1
**Preconditions**: Authenticated user; backend deliberately fails the cancel call (mock 500)
**Steps**:
1. Open booking detail
2. Click "Cancel Booking" → "Yes, cancel it"
**Expected Results**: Error toast appears with the API error message; ConfirmDialog closes (`setConfirm(false)` in `onError`); user remains on the detail page; booking is NOT removed.
**Business Rule**: `useCancelBooking` `onError` handler
**Suggested Layer**: E2E (with network mocking)

---

### TC-306: ConfirmDialog "Cancel" path does not delete the booking
**Category**: Negative
**Priority**: P1
**Preconditions**: User on booking detail page
**Steps**:
1. Click "Cancel Booking"
2. In the dialog, click the dismiss button (X / Cancel / Esc / backdrop click)
**Expected Results**: Dialog closes, booking remains in the list and on the detail page, no API DELETE was issued.
**Business Rule**: `ConfirmDialog onClose`
**Suggested Layer**: E2E

---

### TC-307: "Clear all" — declining the browser `confirm()` does not clear
**Category**: Negative
**Priority**: P1
**Preconditions**: User has ≥1 booking
**Steps**:
1. Click "Clear all bookings"
2. Dismiss the native `confirm()` dialog
**Expected Results**: `setClearing` is never set; no DELETE request is sent; bookings remain.
**Business Rule**: `handleClearAll` early return
**Suggested Layer**: E2E (using `page.on('dialog', d => d.dismiss())`)

---

### TC-308: Booking ref lookup with non-existent ref returns 404
**Category**: Negative
**Priority**: P2
**Preconditions**: Authenticated user
**Steps**:
1. GET `/api/bookings/ref/Z-NOTREAL`
**Expected Results**: 404, body references the missing ref.
**Business Rule**: `getBookingByRef` NotFoundError
**Suggested Layer**: API

---

### TC-309: Booking ref lookup with malformed ref returns 404
**Category**: Negative
**Priority**: P3
**Preconditions**: Authenticated user
**Steps**:
1. GET `/api/bookings/ref/!!@@%%`
**Expected Results**: 404 (no booking matches), never 500. URL-encoding is honored without crash.
**Business Rule**: Same as TC-308
**Suggested Layer**: API

---

### TC-310: GET `/api/bookings/:id` with non-numeric id
**Category**: Negative
**Priority**: P2
**Preconditions**: Authenticated user
**Steps**:
1. GET `/api/bookings/abc`
**Expected Results**: 400 or 404 — server does not 500. Front-end EmptyState shows "Booking not found".
**Business Rule**: Prisma int parsing
**Suggested Layer**: API + E2E

---

## Edge Cases (TC-400–499)

### TC-400: Refund eligibility with quantity = 1 (lower boundary)
**Category**: Edge Case
**Priority**: P1
**Preconditions**: Booking with `quantity = 1`
**Steps**: As TC-006
**Expected Results**: Result is "Eligible for refund."
**Business Rule**: Boundary of refund rule §8
**Suggested Layer**: E2E

---

### TC-401: Refund eligibility with quantity = 10 (upper boundary)
**Category**: Edge Case
**Priority**: P1
**Preconditions**: Booking with `quantity = 10` (max allowed by validator)
**Steps**: As TC-007 with quantity 10
**Expected Results**: Result is "Not eligible for refund. Group bookings (10 tickets) are non-refundable."
**Business Rule**: Boundary of refund rule §8 + validator max
**Suggested Layer**: E2E

---

### TC-402: Free event booking — total displays as $0
**Category**: Edge Case
**Priority**: P2
**Preconditions**: Event with `price = 0`
**Steps**:
1. Book 2 tickets
2. View `/bookings/:id`
**Expected Results**: "Price per ticket" = `$0`, "Total Paid" = `$0`. No "NaN" or currency parsing crash.
**Business Rule**: `parseFloat(event.price) * quantity` with 0
**Suggested Layer**: E2E

---

### TC-403: Bookings list at FIFO ceiling shows exactly 9 cards
**Category**: Edge Case
**Priority**: P1
**Preconditions**: User has exactly 9 bookings
**Steps**:
1. GET `/api/bookings?limit=10`
**Expected Results**: `data.length === 9`, `pagination.total === 9`, no pruning has happened yet. UI shows all 9 booking cards.
**Business Rule**: Business rule §4
**Suggested Layer**: API + E2E

---

### TC-404: Cancelling the only booking yields the empty state
**Category**: Edge Case
**Priority**: P1
**Preconditions**: User has exactly 1 booking
**Steps**:
1. Cancel it (per TC-003)
2. Land back on `/bookings`
**Expected Results**: EmptyState "No bookings yet" renders with the Browse Events CTA. No pagination component is shown.
**Business Rule**: Empty state in `BookingsContent`
**Suggested Layer**: E2E

---

### TC-405: Clear all when user has 9 bookings (FIFO max)
**Category**: Edge Case
**Priority**: P2
**Preconditions**: User has 9 bookings
**Steps**:
1. Click "Clear all bookings", accept confirm
2. Refetch list
**Expected Results**: All 9 are cleared in a single request; `{ deleted: 9 }`. EmptyState appears.
**Business Rule**: Business rule §4
**Suggested Layer**: API + E2E

---

### TC-406: Refund check clicked twice rapidly only schedules one 4-second timer
**Category**: Edge Case
**Priority**: P3
**Preconditions**: Booking detail page
**Steps**:
1. Click `#check-refund-btn` twice in quick succession
**Expected Results**: After first click, the button is replaced by the spinner, so the second click hits nothing. Only one transition idle → checking → result happens. No double-timer effect.
**Business Rule**: Conditional rendering in `RefundEligibility`
**Suggested Layer**: E2E

---

### TC-407: Refund spinner — navigating away before 4 seconds does not throw
**Category**: Edge Case
**Priority**: P2
**Preconditions**: Booking detail page
**Steps**:
1. Click `#check-refund-btn`
2. Within 1 s, navigate to `/bookings`
**Expected Results**: No console error. The `setTimeout` resolves on the unmounted component without throwing (component is gone; state updates are no-ops in React 18 dev — accept warnings, fail on errors).
**Business Rule**: Defensive timer cleanup behavior
**Suggested Layer**: E2E (console listener)

---

### TC-408: Booking detail when the linked event was deleted
**Category**: Edge Case
**Priority**: P1
**Preconditions**: User had a booking for a dynamic event they then deleted (cascade should remove booking too)
**Steps**:
1. After cascade delete, attempt to GET the booking detail page using the cached id
**Expected Results**: 404 → EmptyState "Booking not found". The cascade behavior is verified by the absence of the booking. (If the booking row somehow survived, the detail page falls back to title "Event Booking" — verify via direct DB seed of an orphan.)
**Business Rule**: Cascade delete on `Event → Booking`; `BookingDetailPage` fallback title
**Suggested Layer**: Integration + E2E

---

### TC-409: Long customer name renders without breaking layout
**Category**: Edge Case
**Priority**: P3
**Preconditions**: Create booking with a 100-character `customerName`
**Steps**: View detail page and admin row
**Expected Results**: Name wraps or truncates within its container; the page does not horizontally scroll; admin table cell does not push neighboring columns out of view.
**Business Rule**: UI resilience
**Suggested Layer**: Visual / E2E

---

### TC-410: Bookings filtered by `eventId` query param
**Category**: Edge Case
**Priority**: P2
**Preconditions**: User has 3 bookings, 2 of them for event `E1`
**Steps**:
1. GET `/api/bookings?eventId=E1`
**Expected Results**: Only the 2 bookings for `E1` are returned. `pagination.total === 2`.
**Business Rule**: api-reference — `?eventId` query
**Suggested Layer**: API

---

### TC-411: Booking ref collision retry path
**Category**: Edge Case
**Priority**: P3
**Preconditions**: Unit-test environment where `bookingRepository.findByRef` is mocked to return existing on first 10 calls
**Steps**:
1. Invoke `generateUniqueRef('Tech Summit')`
**Expected Results**: Function returns a ref with timestamp fallback shape `T-<8 base36 chars>` after 10 collisions. No infinite loop, no thrown error.
**Business Rule**: Business rule §7 — collision retry
**Suggested Layer**: Unit

---

### TC-412: Pagination `limit` ceiling honored
**Category**: Edge Case
**Priority**: P3
**Preconditions**: User has 9 bookings
**Steps**:
1. GET `/api/bookings?page=1&limit=5`
**Expected Results**: `data.length === 5`, `pagination.totalPages === 2`, `pagination.total === 9`.
**Business Rule**: `bookingService.getBookings` pagination
**Suggested Layer**: API

---

### TC-413: Cancel-in-flight cannot be triggered twice (button disabled)
**Category**: Edge Case
**Priority**: P2
**Preconditions**: User on detail page; mock the DELETE to take ≥2 s
**Steps**:
1. Click "Cancel Booking" → "Yes, cancel it"
2. Attempt to click "Yes, cancel it" again
**Expected Results**: Button is disabled while `isPending` is true; only one DELETE is issued.
**Business Rule**: `ConfirmDialog` `isLoading` prop wiring
**Suggested Layer**: E2E (with network throttling)

---

## UI State (TC-500–599)

### TC-500: Empty state — zero bookings
**Category**: UI State
**Priority**: P0
**Preconditions**: User has 0 bookings
**Steps**:
1. Navigate to `/bookings`
**Expected Results**: EmptyState shows title "No bookings yet", body "You haven't booked any events yet. Browse upcoming events and grab your tickets!", a "Browse Events" CTA linking to `/events`, and a ticket-stub SVG icon.
**Business Rule**: `BookingsContent` empty branch
**Suggested Layer**: E2E

---

### TC-501: Loading skeletons render while bookings fetch
**Category**: UI State
**Priority**: P2
**Preconditions**: Throttled network or mock that delays response by ≥500 ms
**Steps**:
1. Navigate to `/bookings`
**Expected Results**: 5 `BookingCardSkeleton` cards render until data arrives, then are replaced by real cards. No layout shift breaks neighboring elements.
**Business Rule**: `isLoading` branch
**Suggested Layer**: E2E

---

### TC-502: "Clearing…" label and disabled state during clear-all
**Category**: UI State
**Priority**: P2
**Preconditions**: User has ≥1 booking
**Steps**:
1. Click "Clear all bookings", accept confirm
2. While the DELETE is in flight, inspect the button
**Expected Results**: Label changes from "Clear all bookings" to "Clearing…", `disabled` attribute is true, opacity reduced. After response, label resets.
**Business Rule**: `clearing` state in `BookingsContent`
**Suggested Layer**: E2E

---

### TC-503: Refund result replaces button, then either green or red panel
**Category**: UI State
**Priority**: P1
**Preconditions**: Booking detail page
**Steps**:
1. Click check refund
**Expected Results**: Transition is idle → checking → eligible/ineligible. The button is gone during checking. The result is wrapped in `bg-emerald-50` (eligible) or `bg-red-50` (ineligible). The button does NOT return after a result is shown (single-shot).
**Business Rule**: `RefundEligibility` state machine
**Suggested Layer**: E2E

---

### TC-504: "Cancel Booking" button hidden when status is not "confirmed"
**Category**: UI State
**Priority**: P1
**Preconditions**: A booking whose status is set to anything other than "confirmed" (seed manually for negative coverage)
**Steps**:
1. View its detail page
**Expected Results**: "Cancel Booking" button is not rendered. Status badge color reflects danger variant.
**Business Rule**: `booking.status === 'confirmed'` gate
**Suggested Layer**: E2E

---

### TC-505: Pagination component hidden when only 1 page
**Category**: UI State
**Priority**: P3
**Preconditions**: User has ≤10 bookings; default limit = 10
**Steps**:
1. Navigate to `/bookings`
**Expected Results**: List renders without the `Pagination` component. (Component is conditionally rendered only when `pagination` exists and is truthy — verify zero page-controls.)
**Business Rule**: Conditional in `BookingsContent`
**Suggested Layer**: E2E

---

### TC-506: Toast on successful cancel
**Category**: UI State
**Priority**: P2
**Preconditions**: User cancels a booking
**Steps**:
1. Complete TC-003
**Expected Results**: Toast "Booking cancelled successfully" appears with success styling and auto-dismisses.
**Business Rule**: `useCancelBooking` `onSuccess`
**Suggested Layer**: E2E

---

### TC-507: Toast on cancel error preserves dialog state
**Category**: UI State
**Priority**: P2
**Preconditions**: Mock DELETE to return 500
**Steps**:
1. Trigger cancel
**Expected Results**: Error toast shows API message; `setConfirm(false)` is called so the dialog closes; the user stays on detail page; the booking remains.
**Business Rule**: `onError` handler in detail page
**Suggested Layer**: E2E

---

### TC-508: Breadcrumb on detail page shows ref
**Category**: UI State
**Priority**: P3
**Preconditions**: Booking detail page
**Steps**:
1. Inspect the breadcrumb at the top of the page
**Expected Results**: Text reads `My Bookings / <bookingRef>`. The "My Bookings" segment links to `/bookings` and `<bookingRef>` is rendered in monospace.
**Business Rule**: UI requirement
**Suggested Layer**: E2E

---

### TC-509: Admin bookings — empty state under filter
**Category**: UI State
**Priority**: P2
**Preconditions**: User has only confirmed bookings; switch filter to "Cancelled"
**Steps**:
1. Set status filter to "Cancelled" on `/admin/bookings`
**Expected Results**: Table region renders EmptyState "No bookings found" / "There are no bookings matching your filters." No table headers/rows are shown.
**Business Rule**: Filtered empty branch in admin page
**Suggested Layer**: E2E

---

### TC-510: Admin bookings — "Cancel" action hidden when status is not "confirmed"
**Category**: UI State
**Priority**: P3
**Preconditions**: Mixed dataset including a non-confirmed row
**Steps**:
1. Inspect actions column on `/admin/bookings`
**Expected Results**: Only "View" button is shown for non-confirmed rows; "Cancel" is hidden.
**Business Rule**: `b.status === 'confirmed'` gate in admin table
**Suggested Layer**: E2E

---

### TC-511: Sandbox banner — bookings page heads-up text
**Category**: UI State
**Priority**: P3
**Preconditions**: User is logged in
**Steps**:
1. With many bookings (close to 9), navigate to `/bookings`
2. With few bookings (<5), navigate again
**Expected Results**: When near the limit, the sandbox heads-up text matching `/sandbox holds up to/i` is visible (announcing the 6-event / 9-booking caps). When few bookings exist, the banner is hidden.
**Business Rule**: Business rule §5 — conditional banner
**Suggested Layer**: E2E

---

## Coverage Notes

- Refund eligibility is **client-only**. There is no API endpoint for refund — do not assert against any backend behavior; assert UI state machine and timing.
- The cancel happy path and FIFO pruning are the highest-risk behaviors because they mutate seat counts. Lock those down at the API layer (fast, deterministic) and add a single E2E smoke for the cancel flow.
- Cross-user 403 must be tested at the API layer for every booking endpoint, including the lookup-by-ref endpoint, since the UI only exposes detail-by-id.
- "Same-event FIFO fallback" (TC-105) is the only path that mutates `event.availableSeats` permanently — flag this for integration testing because it is subtle and easy to regress.
- Tests using ConfirmDialog should target the dialog's confirm button by accessible name ("Yes, cancel it"), not by index, to keep them robust to layout changes.
