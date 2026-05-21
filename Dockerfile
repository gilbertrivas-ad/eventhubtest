# ──────────────────────────────────────────────────────────────────────────────
# Playwright test runner image
#
# Uses Microsoft's official Playwright image which already ships with:
#   - Node.js 20 LTS
#   - Chromium / Firefox / WebKit binaries
#   - All required system libraries (no `apt install` needed)
#
# The image tag MUST match the @playwright/test version in package.json.
# ──────────────────────────────────────────────────────────────────────────────
FROM mcr.microsoft.com/playwright:v1.58.2-jammy

WORKDIR /app

# Install JS deps first so this layer is cached when only test code changes.
COPY package.json package-lock.json ./
RUN npm ci

# Copy only what the tests need — keeps the image small and the build fast.
COPY playwright.config.ts ./
COPY tests ./tests

# Default: run the full suite. Override at runtime, e.g.:
#   docker compose run --rm tests npx playwright test -g "TC-001"
CMD ["npx", "playwright", "test"]
