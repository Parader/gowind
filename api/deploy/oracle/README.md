# Oracle Always Free — GoWind API

True always-on hosting (~$0). Use this path instead of Koyeb/Fly/Render free sleep.

## Phase A — Oracle account + VM (you do this in the browser)

1. Sign up: https://www.oracle.com/cloud/free/  
   - Pick a **home region with Ampere capacity** (e.g. `ca-montreal-1`, `us-ashburn-1`, `eu-frankfurt-1`). You can’t change home region later.
   - Card verification is normal; Always Free Ampere isn’t billed if you stay in free shapes.

2. **Networking ingress** (do this before or right after creating the VM):
   - Networking → Virtual Cloud Networks → your VCN → **Subnet** → **Security List** (or NSG on the instance)
   - Ingress rules:
     | Source | Protocol | Port |
     |--------|----------|------|
     | `0.0.0.0/0` | TCP | 22 |
     | `0.0.0.0/0` | TCP | 80 |
     | `0.0.0.0/0` | TCP | 443 |

3. **Create instance** (Compute → Instances → Create):
   - Name: `gowind-api`
   - Image: Canonical **Ubuntu 22.04** or **24.04** (not Oracle Linux if you prefer these scripts)
   - Shape: **Change shape** → Ampere → **VM.Standard.A1.Flex**
     - Start with **1 OCPU / 6 GB RAM** (or 2 OCPU / 12 GB if free)
   - SSH keys: paste your public key (`type $env:USERPROFILE\.ssh\id_ed25519.pub` on Windows, or generate one)
   - Networking: **Assign a public IPv4 address**
   - Create

4. Note the **Public IP** from the instance details page.

If create fails with “Out of capacity”, try another AD/fault domain, smaller shape, or another region (new tenancy) — Ampere free pool often fills up.

## Phase B — DNS

Create an **A record**:

- Host: `api` (→ `api.go-wind.com`)
- Value: the VM public IP
- TTL: 300

Wait until `nslookup api.go-wind.com` returns that IP before HTTPS will work.

## Phase C — Server setup

On your PC (PowerShell), with the key you registered:

```powershell
ssh ubuntu@YOUR_PUBLIC_IP
```

On the VM:

```bash
# Clone the repo (use your GitHub URL; private repo → deploy key or HTTPS token)
git clone https://github.com/YOUR_USER/tempest.git
cd tempest/api/deploy/oracle
chmod +x install-docker.sh
./install-docker.sh
exit
```

SSH back in (so Docker group applies):

```powershell
ssh ubuntu@YOUR_PUBLIC_IP
cd ~/tempest/api/deploy/oracle
cp .env.example .env
nano .env
```

Fill at least:

- `CADDY_DOMAIN=api.go-wind.com`
- `API_URL=https://api.go-wind.com`
- `FRONTEND_URL=https://go-wind.com`
- `MONGODB_URI`, `JWT_SECRET` (same as Render)
- Google + weather + PostHog keys as on Render

Then:

```bash
docker compose up -d --build
docker compose ps
docker compose logs -f api
```

Healthy API + Caddy → open `https://api.go-wind.com/auth/me` (expect **401** JSON — means the API is up).

## Phase D — Point the app at Oracle

1. **Google Cloud Console** → OAuth client → Authorized redirect URIs → add  
   `https://api.go-wind.com/auth/google/callback`
2. **Netlify** → env `VITE_API_URL=https://api.go-wind.com` → trigger redeploy  
3. Smoke-test: login, Google, Go Time  
4. Turn off / delete the **Render** API service  

## Updates later

```bash
cd ~/tempest && git pull
cd api/deploy/oracle
docker compose up -d --build
```

## Troubleshooting

| Symptom | Fix |
|--------|-----|
| SSH timeout | Open TCP 22 in Security List; confirm public IP |
| Caddy cert fail | DNS A record not pointing here yet; wait / check `CADDY_DOMAIN` |
| `docker: permission denied` | Log out/in after `usermod -aG docker` |
| Wrong arch | Use Ampere A1 (ARM); `node:22-alpine` is multi-arch |
| Instance reclaimed | You exceeded Always Free Ampere quota; shrink/delete other A1 VMs |

Helper scripts in this folder: `install-docker.sh`, `docker-compose.yml`, `Caddyfile`, `.env.example`.
