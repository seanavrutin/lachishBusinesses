# lachishBusinesses - server

Read-only WhatsApp monitor that extracts local-business data into Firestore.

## Prerequisites

1. **A dedicated/secondary WhatsApp number** that is a **member of the target group**.
   The server links to it as a "linked device" (you scan a QR once). Using a separate number
   keeps any risk away from your personal account. The server never sends messages.
2. **A Firebase project** with **Firestore** and **Storage** enabled, plus a **service-account JSON** key
   (Project settings -> Service accounts -> Generate new private key).
3. **A Gemini API key** from Google AI Studio.

## Setup

```bash
cd server
cp .env.example .env
```

Fill in `.env`:

- `GEMINI_API_KEY`
- `FIREBASE_PROJECT_ID`, `FIREBASE_STORAGE_BUCKET`
- `GOOGLE_APPLICATION_CREDENTIALS` -> path to your service-account JSON (e.g. `./secrets/serviceAccount.json`),
  or paste the JSON into `FIREBASE_SERVICE_ACCOUNT_JSON`.

Put the key file at `server/secrets/serviceAccount.json` (this folder is git-ignored).

## Verify Firebase first (recommended)

After filling in `.env`, confirm your credentials work before linking WhatsApp:

```bash
npm install
npm run check:firebase
```

This does a real write/read/delete against Firestore and Storage and prints clear
hints if the project ID, bucket name, or service-account key is wrong.

## Run locally

```bash
npm run dev
```

On first run a **QR code** is printed in the terminal (and served at `GET /api/whatsapp/qr`).
Open WhatsApp on the dedicated phone -> **Linked devices** -> **Link a device** -> scan it.

Once connected, the logs print every group the number is in (JID + name). Copy the target group's
JID into `TARGET_GROUP_ID` in `.env` and restart. From then on, new posts in that group are ingested
and turned into businesses automatically.

## Run with Docker

```bash
docker compose up --build
```

- The `auth/` session and your `secrets/` key are bind-mounted, so re-deploys don't force re-linking.
- Configuration comes from `.env` (via `env_file`).

## REST API

| Method | Path                     | Description                                   |
| ------ | ------------------------ | --------------------------------------------- |
| GET    | `/api/health`            | Liveness check                                |
| GET    | `/api/whatsapp/status`   | Connection state + resolved target group      |
| GET    | `/api/whatsapp/qr`       | Current link QR (PNG data URL) when pairing    |
| GET    | `/api/whatsapp/groups`   | Groups the number belongs to (jid + name)     |
| GET    | `/api/businesses`        | List businesses (`?category=`, `?moshav=`, `?q=`) |
| GET    | `/api/businesses/:id`    | One business                                  |
| PATCH  | `/api/businesses/:id`    | Manual fix / approve a `needs_review` business |

## Data model (Firestore)

- `raw_messages/{messageId}` - ingestion log + work queue (`status`: pending/processing/done/failed).
- `businesses/{id}` - extracted businesses: `name`, Hebrew `categories[]`, `description`,
  `openingHours` (raw text, verbatim from the post), `phone`,
  `location.{raw,moshav,address,lat,lng,geohash}`, latest `images[]` + `lastRawText`,
  `lastPostedAt` (WhatsApp post time = "info last updated"), `lastUpdatedAt` (server write),
  `extractionConfidence`, and `status` (`active`/`needs_review`).

## Geocoding (map placement)

Each business is placed on the map in priority order:

1. **Real street address** (e.g. `תירוש 37, שדה משה`) -> geocoded to an exact point by the
   configured provider. A result outside the Lachish region is rejected as a bad match.
2. **Moshav name only** -> the verified moshav-center gazetteer in `src/geocode/moshavim.ts`.

For accurate Israeli addresses use Google (`GEOCODER_PROVIDER=google`). One-time setup:

1. [Google Cloud Console](https://console.cloud.google.com/) -> pick a project (you can reuse the
   one your Gemini key belongs to, or create a new one).
2. **Enable billing** on that project (Billing -> link a billing account). Geocoding requires it,
   but this volume sits well within the free monthly credit.
3. **APIs & Services -> Library** -> search **"Geocoding API"** -> **Enable**.
4. **APIs & Services -> Credentials** -> **Create credentials -> API key**. Then **Restrict key** ->
   *API restrictions* -> allow only **Geocoding API**. (This is a Cloud API key - different from the
   AI Studio Gemini key.)
5. In `server/.env` set `GEOCODER_PROVIDER=google` and `GEOCODING_API_KEY=<the key>`.

After changing the gazetteer or the provider, fix already-saved records.

With npm (local dev):

```bash
npm run regeocode          # re-geocode every business and update Firestore
npm run verify:moshavim    # audit gazetteer entries against OpenStreetMap
```

On a Docker-only host (e.g. the always-on laptop) there's no npm; rebuild the image
and run the compiled script in a one-off container instead:

```bash
docker compose up -d --build   # bake in new code + restart the server
docker compose run --rm server node dist/scripts/regeocodeBusinesses.js
# audit gazetteer:  docker compose run --rm server node dist/scripts/verifyMoshavim.js
```

The one-off container reuses `.env` + the mounted service-account key and doesn't
publish ports, so it won't clash with the running server.

If no key is set, address geocoding simply falls back to the moshav center - nothing breaks.

## Recent posts history

Each business keeps its **last 5 posts** (text + images + date) under `recentPosts`, newest
first, surfaced by the client as the "פרסומים אחרונים" section. New posts accumulate
automatically as messages are processed.

To populate history for businesses that existed before this feature, rebuild `recentPosts`
from the `raw_messages` already stored for each business:

```bash
npm run backfill:posts                                          # local dev
docker compose run --rm server node dist/scripts/backfillRecentPosts.js   # Docker-only host
```

It's safe to re-run (it overwrites `recentPosts` each time).

## Matching posts to existing businesses (dedupe)

When a post is processed, it's matched against existing businesses **by name across the
whole directory** — moshav is only a tie-breaker, never a gate (a missing or misspelled
moshav used to spawn duplicates). Matching is name-only (no phone):

1. **Exact** normalized name (diacritics/case/spacing ignored).
2. **Conservative fuzzy** — every word of the shorter name appears in the longer one, or the
   two share ≥70% of their words, *and* they share a distinctive (3+ char) word. This catches
   "מאפיית רוזנבלט" ↔ "רוזנבלט" but won't merge two businesses that only share a generic word
   like "מאפיה". It errs toward **not** merging; near-duplicates can be removed in admin mode.

When a post matches an existing business, the latest post wins for the headline fields (main
image — replaced only if the new post has one — description, hours, name, location, categories)
while the previous photo/text stay visible under "פרסומים אחרונים".

## Categories

Each business keeps **1 category (2 at most)**. During extraction the model is given the
categories already in use (most common first) plus a curated seed list, and told to **reuse
an existing one** when it fits rather than invent new tags. The result is then de-duped,
snapped to the existing spelling, and hard-capped at two before saving. This keeps the tag
set small and consistent instead of growing endlessly.

To consolidate categories on businesses created before this change, re-classify them against
a controlled vocabulary (frequent existing categories + seeds). It's a dry run by default:

```bash
npm run recategorize                 # show proposed [old] -> [new] changes, write nothing
npm run recategorize -- --apply      # actually update Firestore
# tune the vocabulary:  -- --min=3 (min uses to keep an existing tag) --top=30
docker compose run --rm server node dist/scripts/recategorizeBusinesses.js --apply   # Docker-only host
```

Only the `categories` field is touched.

## Filtering out noise (post types)

The group also carries non-listings: job ads (`דרושים`), school/childcare posts, camps
(`קייטנה`), notices, etc. Rather than stuffing exclusion rules into the prompt, the model
classifies each post's **primary purpose** into one bucket (decided by what the post asks the
reader to do), checked in order:

`job | school | event | business | other`

- **job** — hiring / workers wanted, any sector (reader = employee).
- **school** — anything about education or childcare: schools, kindergartens, gan/משפחתון/צהרון,
  קייטנות, חוגים, courses, registration, schedules (including a private gan offering places).
- **event** — a one-time, non-school happening.
- **business** — an ongoing local business/service offering something to customers.
- **other** — greetings, lost & found, private second-hand sales, anything else.

Only the types in `RELEVANT_POST_TYPES` (default `business`) become directory listings;
everything else is marked done and skipped. The chosen `postType` is stored on the
`raw_messages` record so you can audit what was filtered and why. To surface more, widen the
allowlist, e.g. `RELEVANT_POST_TYPES=business,event`.

## Admin mode (edit / delete)

The web UI has a hidden admin mode for fixing business details or removing bad entries,
gated by a single shared secret (no accounts/login):

1. Set `ADMIN_TOKEN` to a long random string in the server `.env` (leave it empty to disable
   all writes entirely).
2. In the UI, tap the **title** ("עסקים בלכיש") five times quickly to reveal a token prompt,
   and paste the token. It's verified against `GET /api/admin/verify` and stored in the
   browser's `localStorage`, so admin mode persists until you tap "יציאה".
3. Once unlocked, each business page shows **ערוך פרטים** to edit fields (name, categories,
   description, hours, phone, website, address/moshav, lat/lng) and a **delete** action.

Writes are enforced **server-side**: `PATCH`/`DELETE /api/businesses/:id` require the
`x-admin-token` header to match `ADMIN_TOKEN` (constant-time compare). The client-side gate
only controls what's shown. Rotate the secret any time by changing `ADMIN_TOKEN` and
restarting - previously saved tokens stop working immediately.

## Notes

- Extraction = one multimodal Gemini call per message (text + image), validated with zod.
- Moshav coordinates are a small static gazetteer in `src/geocode/moshavim.ts`, verified against
  OpenStreetMap/Wikipedia; they serve as the fallback when a post has no precise street address.
- The queries use single-field filters to avoid requiring Firestore composite indexes.
