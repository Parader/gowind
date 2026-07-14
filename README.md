# GoWind

Monorepo: Vite frontend (`gowind/`) + Express API (`api/`).

- Frontend → Netlify (`https://go-wind.com`)
- API → Oracle Cloud Always Free VM (`https://api.go-wind.com`)

First-time Oracle setup: [`api/deploy/oracle/README.md`](api/deploy/oracle/README.md).

---

## How to update the API (push a new release)

Use this whenever you change code under `api/` and want it live on the Oracle VM.

### 1. Develop locally (optional)

```powershell
cd C:\solo\tempest\api
npm run dev
```

API: `http://localhost:3001` (see root `.env`).

### 2. Commit and push to GitHub

From the repo root on your PC:

```powershell
cd C:\solo\tempest
git status
git add api
git commit -m "Describe the API change"
git push origin main
```

Use your real branch name if it isn’t `main`. Do **not** commit `.env` files.

### 3. Deploy on the Oracle VM

SSH in (use your VM public IP):

```powershell
ssh ubuntu@147.15.131.135
```

Pull and rebuild with the deploy script:

```bash
cd ~/gowind/api/deploy/oracle
chmod +x deploy.sh   # first time only
./deploy.sh
```

Optional:

```bash
./deploy.sh main       # pull a specific branch
./deploy.sh --no-pull  # rebuild without git pull
./deploy.sh --env-only # restart after editing .env (no rebuild)
```

Both `api` and `caddy` should be **Up**; the script waits until the API is healthy.

### 4. Smoke-check

```bash
docker compose logs --tail=50 api
```

Then in a browser (logged out is fine):

`https://api.go-wind.com/auth/me` → **401** means the API is up.

Exercise the feature you changed (login, Go Time, etc.) on `https://go-wind.com`.

### 5. If you only changed environment variables

Edit `.env` on the VM (not in git):

```bash
cd ~/gowind/api/deploy/oracle
nano .env
./deploy.sh --env-only
```

---

## Quick reference

| Step | Where | Command |
|------|--------|---------|
| Push code | Your PC | `git push origin main` |
| Deploy | VM | `cd ~/gowind/api/deploy/oracle && ./deploy.sh` |
| Logs | VM | `docker compose logs -f api` |
| Restart only | VM | `docker compose restart api` |
| Status | Browser | `https://api.go-wind.com/auth/me` → 401 |

---

## Frontend updates

Frontend deploys separately via Netlify (push to the branch Netlify watches, or trigger a redeploy). After an API host/URL change, set Netlify `VITE_API_URL=https://api.go-wind.com` and redeploy.
