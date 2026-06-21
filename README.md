# lachishBusinesses

A system that monitors a WhatsApp group of forwarded local-business posts (text + images, mostly Hebrew),
extracts structured business data with AI, and stores it so a future client (list + map) can present
all available local businesses in the Lachish-area moshavim.

This repo is a monorepo:

- `server/` - the backend (this is what's built first).
- `client/` - the UI (planned later).

## What the server does

1. Connects to WhatsApp via [Baileys](https://github.com/WhiskeySockets/Baileys) as a **read-only linked device**.
2. Listens to **one target group** and, for every forwarded post, persists the raw message + image
   immediately (so nothing is lost).
3. A background worker extracts `{ name, categories, opening hours, location, phone }` from the
   text + image using **Google Gemini** (Hebrew-aware, structured JSON output).
4. Resolves the moshav/location to coordinates (static gazetteer + optional geocoder) and stores/updates
   the business in **Firestore**, tracking when it was last updated.
5. Exposes a small **REST API** for the future client.

See [server/README.md](server/README.md) for setup and run instructions (local + Docker).

## Quick start (local)

```bash
cd server
cp .env.example .env   # then fill in the values
npm install
npm run dev            # scan the QR shown in the terminal with the dedicated WhatsApp number
```
