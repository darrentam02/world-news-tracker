# World News Tracker on Replit

## Run

- Install dependencies: `pnpm install --frozen-lockfile`
- Build the frontend: `pnpm build`
- Start the web app and API on port 5000 after building: `pnpm build && pnpm start`
- The Replit **Start application** workflow runs `pnpm build && pnpm start`, so it also works after a clean import.

## Services

- The server starts without external credentials; `/api/healthz`, the static frontend, privacy page, and empty market layout remain available.
- News, subscriptions, scheduled ingestion, and digest data require `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in Replit Secrets.
- Email delivery additionally requires `RESEND_API_KEY` and `RESEND_FROM`.
- `PUBLIC_BASE_URL` controls links in subscription emails.
- `DIGEST_SECRET` protects the digest API endpoint.