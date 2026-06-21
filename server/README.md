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
  `openingHours` (`raw` text + normalized `weekly` per-day ranges), `phone`,
  `location.{raw,moshav,address,lat,lng,geohash}`, latest `images[]` + `lastRawText`,
  `lastPostedAt` (WhatsApp post time = "info last updated"), `lastUpdatedAt` (server write),
  `extractionConfidence`, and `status` (`active`/`needs_review`).

## Notes

- Extraction = one multimodal Gemini call per message (text + image), validated with zod.
- Moshav coordinates come from a small static gazetteer in `src/geocode/moshavim.ts` (approximate;
  refine as needed). Full street addresses optionally use a geocoder.
- The queries use single-field filters to avoid requiring Firestore composite indexes.
