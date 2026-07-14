# GoWind API

Auth + weather / Go Times backend with MongoDB, JWT, and Google SSO.

## Setup

1. Copy `.env` from the tempest root (or create `api/.env`) with:
   - `MONGODB_URI` – MongoDB connection string
   - `DB_NAME` – Database name (default: gowind)
   - `JWT_SECRET` – Secret for signing tokens
   - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` – For Google SSO (optional)
   - `API_URL` – e.g. http://localhost:3001
   - `FRONTEND_URL` – e.g. http://localhost:5173

2. For Google SSO: create OAuth credentials in [Google Cloud Console](https://console.cloud.google.com/), add `http://localhost:3001/auth/google/callback` (or your API_URL) to authorized redirect URIs.

3. Install and run:
   ```bash
   cd api && npm install && npm run dev
   ```

## Deploy: Oracle Cloud Always Free (always-on, no sleep)

**Do not use Koyeb for new accounts** — after the Mistral acquisition, new signups have no free Starter plan (Pro starts ~$29/mo). Their old “free” instance also scaled to zero after idle.

**Do not use Fly.io** unless you want a paid allowance.

Use [Oracle Cloud Always Free](https://www.oracle.com/cloud/free/) Ampere A1 (ARM) VM — runs 24/7 at $0. Same Docker image: [`Dockerfile`](Dockerfile). Compose + Caddy for HTTPS: [`deploy/oracle/`](deploy/oracle/).

### Overview

1. Create an Oracle Cloud Free Tier account (needs card for verification; Always Free compute isn’t charged if you stay in free shape).
2. Create a **VM.Standard.A1.Flex** instance (Ampere), Ubuntu 22.04/24.04, VCN with ingress **22**, **80**, **443**.
3. SSH in, install Docker, clone the repo (or copy `api/`), copy `.env`, run compose.
4. Point a DNS A record (e.g. `api.go-wind.com`) at the VM public IP.
5. Update Google OAuth redirect + Netlify `VITE_API_URL`, then retire Render.

Step-by-step: [`deploy/oracle/README.md`](deploy/oracle/README.md).

## Endpoints

- `POST /auth/signup` – Create account (email, password, name?)
- `POST /auth/login` – Sign in (email, password)
- `GET /auth/google` – Redirect to Google SSO
- `GET /auth/me` – Current user (requires cookie / Bearer)
- `POST /auth/logout` – Clear session
- `GET /user-data` – List user data
- `POST /user-data` – Save user data (type, data)
