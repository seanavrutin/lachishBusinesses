# CLAUDE.md

## What & why
Directory of local businesses in the Lachish-area moshavim, built from a WhatsApp
group of forwarded business posts (mostly Hebrew, text + image). The server reads
the group as a read-only linked device, extracts structured business data with
Gemini, geocodes it and stores it in Firestore; the client shows a list + map.
`README.md` and `server/README.md` are detailed and current — read the relevant
section before changing behaviour (dedupe, categories, post types, admin mode).

- `server/` — **the live backend.** TypeScript, ESM (`"type": "module"`, imports
  use `.js` extensions), Express 5, Node 20. `src/index.ts` starts three
  independent parts: `api/` (REST), `worker/` (extraction queue), `whatsapp/`
  (Baileys client + ingest). `extraction/` = Gemini prompt/schema/categories,
  `geocode/` = provider + moshav gazetteer, `store/` = Firestore/Storage repos,
  `scripts/` = one-off maintenance jobs, `config/env.ts` = zod-validated env.
- `client/` — Vite + React + TS. All HTTP in `src/lib/api.ts`, base URL from
  `VITE_API_BASE_URL`. **Auto-deploys to Firebase Hosting on every push to
  `master` that touches `client/**`** (`.github/workflows/deploy-hosting.yml`) —
  merging a client change is a production deploy.

## Pipeline (follow a message by its `id`)
1. `whatsapp/client.ts` → `ingest.ts`: `Target group message received` →
   `Ingested group message` (raw message + image saved, `raw_messages/{id}`
   status `pending`).
2. `worker/processor.ts` polls `pending` every `WORKER_POLL_INTERVAL_MS`:
   status → `processing` → Gemini extraction → either
   `Message skipped (not a relevant listing)` (post type not in
   `RELEVANT_POST_TYPES`) or dedupe (`worker/dedupe.ts`) + geocode + write →
   `Processed business` (`businessId`, `updated`).
3. On error: `Message will be retried` (backoff, `attempts`) until
   `WORKER_MAX_ATTEMPTS`, then `Message failed permanently` (status `failed`).
4. Confidence below `MIN_CONFIDENCE` → business saved as `needs_review`.

## Diagnostics
Container `lachish-businesses-server` (compose in `server/`), port = `PORT` from
`server/.env`, `restart: unless-stopped`.

```bash
curl localhost:$PORT/api/health            # {status, uptime}
curl localhost:$PORT/api/whatsapp/status   # connection, resolvedTargetJid, isPairing, lastError
docker logs --since 2h lachish-businesses-server 2>&1 | grep -E '"level":(40|50|60)'
docker logs --since 2h lachish-businesses-server 2>&1 | grep '<message id>'
```

- **Two log streams.** stdout = pino JSON at `LOG_LEVEL` (info). The audit file
  `server/logs/app.log` (bind-mounted) is at `LOG_FILE_LEVEL=debug` and includes
  every Gemini request/response — go there for "why was this extracted/classified
  like that". It is never rotated and grows without bound.
- pino fields: `level` 30 info / 40 warn / 50 error / 60 fatal, `time` epoch ms.
- Healthy boot: `HTTP API listening`, `Firebase initialized`,
  `Extraction worker started`, `WhatsApp connection open`, `Monitoring target group`.
- `WhatsApp connection closed` with `loggedOut: true` → **no auto-reconnect**
  (`Device logged out…`). Needs a re-link: clear `server/auth/`, restart, scan the
  QR (`/api/whatsapp/qr`) with the dedicated phone. Any other close reconnects
  after 3 s.
- The API keeps running even if the worker or WhatsApp fail to start — a healthy
  `/api/health` does not mean messages are flowing. Check `/api/whatsapp/status`
  and for recent `Ingested group message` lines.

Known gaps (not bugs to "discover" again):
- A message left in `processing` by a crash/restart mid-extraction is never
  picked up again — the worker only queries `pending`. It stays stuck until
  reset by hand in Firestore.
- `/api/whatsapp/groups` and `/api/whatsapp/qr` are unauthenticated.

## Rules
- Verify server changes with `cd server && npm run typecheck` (and `npm run build`
  for anything touching imports/config). There is no test suite.
- Don't run the server locally against the production Firebase project or the
  production WhatsApp number: a second linked session would ingest and process
  the same group into the same Firestore.
- `test:extract` calls Gemini, and `regeocode`, `backfill:posts`,
  `recategorize -- --apply` write to Firestore — ask before running any of them.
- New env var → add it to `server/.env.example` **and** the zod schema in
  `server/src/config/env.ts`.
- Behaviour documented in the READMEs (dedupe rules, category cap, post-type
  buckets, admin token) — update the README in the same change.
- NEVER commit or print `server/.env`, `server/secrets/`, or `server/auth/`
  (the WhatsApp session is full access to the linked account).
