#!/usr/bin/env bash
# Run once on a fresh Amazon Linux 2023 EC2 to prepare jihan-mihwar.
# Usage: bash setup-ec2.sh
set -euo pipefail

REPO="https://github.com/12thmar/jihan-mihwar.git"
APP_DIR="/home/ec2-user/jihan-mihwar"
DOMAIN="api.byjihan.com"

echo "==> Installing Docker & Git"
sudo dnf update -y
sudo dnf install -y docker git nginx certbot python3-certbot-nginx
sudo systemctl enable --now docker
sudo usermod -aG docker ec2-user

echo "==> Cloning repo"
if [ -d "$APP_DIR/.git" ]; then
  echo "    Repo already cloned — skipping"
else
  git clone "$REPO" "$APP_DIR"
fi

echo "==> Setting up nginx"
sudo tee /etc/nginx/conf.d/jihan-mihwar.conf > /dev/null << 'NGINX'
server {
    listen 80;
    server_name api.byjihan.com;

    location / {
        proxy_pass         http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }
}
NGINX

sudo nginx -t
sudo systemctl enable --now nginx

echo "==> Issuing SSL cert for $DOMAIN"
echo "    (DNS A record for $DOMAIN must already point to this server)"
sudo certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m admin@byjihan.com

echo ""
echo "==> Done. Now create /home/ec2-user/jihan-mihwar.env with your Brevo keys:"
echo ""
echo "    BREVO_API_KEY=..."
echo "    BREVO_SENDER_EMAIL=..."
echo "    JIHAN_EMAIL=..."
echo ""
echo "    Then push to main to trigger the first deploy."
