# GoWind API

Auth backend with MongoDB, JWT, and Google SSO.

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

## Endpoints

- `POST /auth/signup` – Create account (email, password, name?)
- `POST /auth/login` – Sign in (email, password)
- `GET /auth/google` – Redirect to Google SSO
- `GET /auth/me` – Current user (requires cookie)
- `POST /auth/logout` – Clear session
- `GET /user-data` – List user data
- `POST /user-data` – Save user data (type, data)
