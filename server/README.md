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

After changing the gazetteer or the provider, fix already-saved records:

```bash
npm run regeocode          # re-geocode every business and update Firestore
npm run verify:moshavim    # audit gazetteer entries against OpenStreetMap
```

If no key is set, address geocoding simply falls back to the moshav center - nothing breaks.

## Notes

- Extraction = one multimodal Gemini call per message (text + image), validated with zod.
- Moshav coordinates are a small static gazetteer in `src/geocode/moshavim.ts`, verified against
  OpenStreetMap/Wikipedia; they serve as the fallback when a post has no precise street address.
- The queries use single-field filters to avoid requiring Firestore composite indexes.
