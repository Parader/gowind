#!/usr/bin/env bash
# Run on the Ubuntu Always Free VM as ubuntu (or after usermod to docker group).
set -euo pipefail

echo "==> Installing Docker…"
sudo apt-get update -y
sudo apt-get install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
if [[ ! -f /etc/apt/keyrings/docker.gpg ]]; then
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
fi
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
sudo apt-get update -y
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin git
sudo usermod -aG docker "$USER" || true

echo "==> Done. Log out and SSH back in, then:"
echo "    cd ~/tempest/api/deploy/oracle   # after cloning the repo"
echo "    cp .env.example .env && nano .env"
echo "    docker compose up -d --build"
