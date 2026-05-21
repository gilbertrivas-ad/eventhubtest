import { test, expect } from '@playwright/test';

// baseURL is configured in playwright.config.ts — use relative paths everywhere.
const USER_EMAIL    = 'rahulshetty1@gmail.com';
const USER_PASSWORD = 'Magiclife1!';

// ── Helpers ────────────────────────────────────────────────────────────────────

async function login(page) {
  await page.goto('/login');
  await page.getByPlaceholder('you@email.com').fill(USER_EMAIL);
  await page.getByLabel('Password').fill(USER_PASSWORD);
  await page.locator('#login-btn').click();
  await expect(page.getByRole('link', { name: /Browse Events/i }).first()).toBeVisible();
}

/**
 * Books the first available (non-sold-out) event on the events page.
 * Returns { bookingRef, eventTitle } captured from the confirmation card.
 * Precondition: user must be logged in.
 */
async function bookFirstAvailableEvent(page, { customerName = `QA User ${Date.now()}` } = {}) {
  await page.goto('/events');

  const firstBookableCard = page.getByTestId('event-card').filter({
    has: page.getByTestId('book-now-btn'),
  }).first();
  await expect(firstBookableCard).toBeVisible();

  const eventTitle = (await firstBookableCard.getByRole('heading').textContent())?.trim() ?? '';
  await firstBookableCard.getByTestId('book-now-btn').click();
  await expect(page).toHaveURL(/\/events\/\d+/);

  const stamp = Date.now();
  await page.getByLabel('Full Name').fill(customerName);
  await page.locator('#customer-email').fill(`qa+${stamp}@example.com`);
  await page.getByPlaceholder('+91 98765 43210').fill('9876543210');
  await page.locator('#confirm-booking').click();

  const refEl = page.locator('.booking-ref').first(); // No data-testid available — file FE ticket.
  await expect(refEl).toBeVisible();
  const bookingRef = (await refEl.textContent())?.trim() ?? '';
  return { bookingRef, eventTitle };
}

/**
 * Clears all bookings via the UI. Safe to call when already empty.
 */
async function resetBookings(page) {
  await page.goto('/bookings');
  const alreadyEmpty = await page.getByText('No bookings yet').isVisible();
  if (alreadyEmpty) return;

  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: /clear all bookings/i }).click();
  await expect(page.getByText('No bookings yet')).toBeVisible();
}

// ── Test Suite ─────────────────────────────────────────────────────────────────

test.describe('Booking Flow — First 3 Critical E2E Journeys', () => {

  // TC-001 ─────────────────────────────────────────────────────────────────────
  test('TC-001: bookings list renders a card for each existing booking', async ({ page }) => {
    // -- Step 1: Login and reset state --
    await login(page);
    await resetBookings(page);

    // -- Step 2: Create exactly one booking so we know what to assert against --
    const { bookingRef, eventTitle } = await bookFirstAvailableEvent(page);

    // -- Step 3: Navigate to /bookings --
    await page.goto('/bookings');

    // -- Step 4: Page header is correct --
    await expect(page.getByRole('heading', { name: 'My Bookings' })).toBeVisible();
    await expect(page.getByText('View and manage all your ticket bookings')).toBeVisible();

    // -- Step 5: "Clear all bookings" link is visible in the header --
    await expect(page.getByRole('button', { name: /clear all bookings/i })).toBeVisible();

    // -- Step 6: A booking card for the new booking is rendered with the expected fields --
    const card = page.getByTestId('booking-card').filter({ hasText: bookingRef });
    await expect(card).toBeVisible();
    await expect(card).toContainText(eventTitle);
    await expect(card).toContainText('confirmed');
    await expect(card).toContainText(bookingRef);

    // -- Step 7: Card exposes the "View Details" link contract --
    await expect(card.getByRole('link', { name: 'View Details' })).toBeVisible();
  });

  // TC-003 ─────────────────────────────────────────────────────────────────────
  test('TC-003: cancel a booking from the detail page → toast + redirect + removed from list', async ({ page }) => {
    // -- Step 1: Login, reset state, create one booking --
    await login(page);
    await resetBookings(page);
    const { bookingRef } = await bookFirstAvailableEvent(page);

    // -- Step 2: Open the booking detail page via the card's "View Details" link --
    await page.goto('/bookings');
    const card = page.getByTestId('booking-card').filter({ hasText: bookingRef });
    await card.getByRole('link', { name: 'View Details' }).click();
    await expect(page).toHaveURL(/\/bookings\/\d+/);

    // -- Step 3: Trigger cancel from the detail page --
    await page.getByRole('button', { name: 'Cancel Booking' }).click();

    // -- Step 4: ConfirmDialog appears with the expected title and confirm button --
    await expect(page.getByText('Cancel this booking?')).toBeVisible();
    const confirmBtn = page.getByTestId('confirm-dialog-yes');
    await expect(confirmBtn).toBeVisible();
    await expect(confirmBtn).toHaveText(/Yes, cancel it/i);

    // -- Step 5: Confirm the cancellation --
    await confirmBtn.click();

    // -- Step 6: Success toast appears and user is redirected to /bookings --
    await expect(page.getByText('Booking cancelled successfully')).toBeVisible();
    await expect(page).toHaveURL(/\/bookings$/);

    // -- Step 7: The cancelled booking is no longer in the list --
    await expect(page.getByTestId('booking-card').filter({ hasText: bookingRef })).toHaveCount(0);
    await expect(page.getByText('No bookings yet')).toBeVisible();
  });

  // TC-005 ─────────────────────────────────────────────────────────────────────
  test('TC-005: clear all bookings via native confirm() empties the list', async ({ page }) => {
    // -- Step 1: Login, reset state --
    await login(page);
    await resetBookings(page);

    // -- Step 2: Create two bookings (precondition: ≥ 2) --
    await bookFirstAvailableEvent(page, { customerName: `QA User A ${Date.now()}` });
    await bookFirstAvailableEvent(page, { customerName: `QA User B ${Date.now()}` });

    // -- Step 3: Navigate to /bookings and confirm both cards are present --
    await page.goto('/bookings');
    const cards = page.getByTestId('booking-card');
    await expect(cards).toHaveCount(2);

    // -- Step 4: Accept the native confirm() dialog when Clear all is clicked --
    page.once('dialog', async (dialog) => {
      expect(dialog.type()).toBe('confirm');
      expect(dialog.message()).toMatch(/clear all your bookings/i);
      await dialog.accept();
    });
    await page.getByRole('button', { name: /clear all bookings/i }).click();

    // -- Step 5: After the DELETE resolves, the empty state with Browse Events CTA renders --
    await expect(page.getByText('No bookings yet')).toBeVisible();
    await expect(
      page.getByRole('main').getByRole('link', { name: 'Browse Events' })
    ).toBeVisible();

    // -- Step 6: No booking cards remain --
    await expect(page.getByTestId('booking-card')).toHaveCount(0);
  });

});
