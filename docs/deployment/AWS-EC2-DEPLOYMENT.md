# Deploy Transferly to AWS EC2 — Complete Step-by-Step Guide

This guide walks you through deploying Transferly (API + BullMQ worker + Telegram bot) on a single Ubuntu EC2 instance from scratch. Estimated time: **45–90 minutes**.

---

## Overview

You will deploy:

| Component | Port | Process Manager |
|-----------|------|----------------|
| API server | 3000 | PM2 |
| BullMQ worker | (background) | PM2 |
| Telegram bot | (background) | PM2 |
| Nginx (reverse proxy) | 443 / 80 | systemd |

The API will be accessible at `https://api.your-domain.com` and the Mini App at your Vercel URL.

---

## Phase 1 — Launch an EC2 Instance

### 1.1 Create the Instance

1. Log in to the **AWS Console** → **EC2** → **Instances** → **Launch instances**
2. **Name**: `transferly-prod`
3. **Amazon Machine Image (AMI)**: `Ubuntu Server 24.04 LTS (HVM)`
4. **Instance type**: `t3.medium` (2 vCPU, 4 GB RAM) minimum. Use `t3.small` for testing.
5. **Key pair**: Create a new one (`.pem`) or use an existing pair. **Download and save it securely.**
6. **Network settings** → **Edit**:
   - VPC: your default VPC
   - Subnet: any public subnet
   - Auto-assign public IP: **Enable**
   - **Security Group**: Create new. Add rules:
     - SSH (22) — My IP (restrict to your IP only)
     - HTTP (80) — Anywhere (for Let\'s Encrypt)
     - HTTPS (443) — Anywhere
7. **Storage**: 20 GB GP3 is sufficient.
8. Click **Launch instance**.

### 1.2 Connect to the Instance

```bash
chmod 400 ~/Downloads/your-key.pem
ssh -i ~/Downloads/your-key.pem ubuntu@<YOUR-EC2-PUBLIC-IP>
```

Save your EC2 public IP. You will use it in DNS settings and Nginx config.

---

## Phase 2 — Server Setup

Run all commands on your EC2 instance as the `ubuntu` user.

### 2.1 Update the Server

```bash
sudo apt update && sudo apt upgrade -y
```

### 2.2 Install Node.js 20 LTS

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node --version   # should show v20.x.x
npm --version
```

### 2.3 Install Redis

```bash
sudo apt install -y redis-server
sudo systemctl enable redis-server
sudo systemctl start redis-server
redis-cli ping   # should return PONG
```

### 2.4 Install Nginx

```bash
sudo apt install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx
```

### 2.5 Install PM2 (process manager)

```bash
sudo npm install -g pm2
pm2 --version
```

### 2.6 Install Certbot (for TLS certificates)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx --register-unsafely-without-email
```

Or for a dry-run to test first:

```bash
sudo certbot --nginx --dry-run
```

---

## Phase 3 — Domain & DNS

### 3.1 Point Your Domain

In your domain registrar or AWS Route 53:

| Record Type | Name | Value | TTL |
|-------------|------|-------|-----|
| A | `api` | `<YOUR-EC2-PUBLIC-IP>` | 300 |
| A | `www` | `<YOUR-EC2-PUBLIC-IP>` | 300 |

Replace `your-domain.com` with your actual domain throughout this guide.

Wait 2–5 minutes for DNS to propagate, then verify:

```bash
nslookup api.your-domain.com
```

---

## Phase 4 — Clone & Configure the Repository

### 4.1 Clone the Repository

```bash
cd ~
git clone https://github.com/mccluskeyz/Transferly.git
cd Transferly
```

### 4.2 Create Production Environment Files

```bash
cp api/.env.example api/.env
cp bot/.env.example bot/.env
chmod 600 api/.env bot/.env
```

### 4.3 Configure `api/.env`

Edit the file:

```bash
nano api/.env
```

Set these values (replace placeholders with your real values):

```bash
# === REQUIRED FOR PRODUCTION ===
NODE_ENV=production
PORT=3000

# Database
SQLITE_DATABASE_PATH=./data/transferly.sqlite

# Redis
REDIS_URL=redis://127.0.0.1:6379

# URLs (replace with your actual domain)
APP_BASE_URL=https://api.your-domain.com
FRONTEND_URL=https://transferly-nine.vercel.app
TELEGRAM_MINI_APP_URL=https://transferly-nine.vercel.app
CORS_ALLOWED_ORIGINS=https://transferly-nine.vercel.app

# === SECRETS (generate strong random values) ===
# Generate with: openssl rand -hex 32
JWT_SECRET=<generate-with-openssl-rand-hex-32>
ADMIN_API_TOKEN=<generate-with-openssl-rand-hex-32>
TELEGRAM_WEBHOOK_SECRET=<generate-with-openssl-rand-hex-32>
BOT_API_HMAC_SECRET=<generate-with-openssl-rand-hex-32>

# === PAYPAL (get from PayPal Developer Dashboard) ===
PAYPAL_ENVIRONMENT=production
PAYPAL_CLIENT_ID=<your-live-paypal-client-id>
PAYPAL_CLIENT_SECRET=<your-live-paypal-client-secret>
PAYPAL_WEBHOOK_ID=<your-live-paypal-webhook-id>

# === TELEGRAM (get from @BotFather) ===
TELEGRAM_BOT_TOKEN=<your-telegram-bot-token>

# === PAYMENT PROVIDER FLAGS ===
PAYMENT_PROVIDER_FEATURE_FLAGS=paypal
SERVICE_FEATURE_FLAGS=invoice,payout,topup,referral
PAYPAL_ONLY_PRODUCTION_MVP=true

# === RISK ENGINE ===
RISK_ENGINE_ENABLED=true
HIGH_RISK_AUTO_REVIEW_ENABLED=true
MAX_FUNDING_ATTEMPTS_PER_HOUR=5
MAX_DAILY_FUNDING_AMOUNT=500000
LARGE_FUNDING_THRESHOLD=100000
MAX_FAILED_PAYMENT_ATTEMPTS=3
MAX_REFUND_REQUESTS_PER_DAY=3

# === POINTS ECONOMY ===
POINTS_TO_NAIRA_RATE=1
DEFAULT_SERVICE_POINT_CHARGE=1000

# === QUEUE ===
INLINE_QUEUE_MODE=false
JOB_WAIT_MS=30000

# === FILE UPLOADS ===
STORAGE_DRIVER=local
MAX_EVIDENCE_BYTES=8388608

# === RATE LIMITING ===
API_RATE_LIMIT_WINDOW_MS=60000
API_RATE_LIMIT_MAX=120
AUTH_RATE_LIMIT_WINDOW_MS=60000
AUTH_RATE_LIMIT_MAX=5
```

To generate a strong secret:

```bash
generate_secret() {
  openssl rand -hex 32
}
echo "JWT_SECRET: $(generate_secret)"
echo "ADMIN_API_TOKEN: $(generate_secret)"
echo "TELEGRAM_WEBHOOK_SECRET: $(generate_secret)"
echo "BOT_API_HMAC_SECRET: $(generate_secret)"
```

### 4.4 Configure `bot/.env`

```bash
nano bot/.env
```

```bash
NODE_ENV=production
BOT_TOKEN=<your-telegram-bot-token>
API_URL=https://api.your-domain.com
MINI_APP_URL=https://transferly-nine.vercel.app
ADMIN_API_TOKEN=<same-as-api-env-ADMIN_API_TOKEN>
TELEGRAM_WEBHOOK_SECRET=<same-as-api-env-TELEGRAM_WEBHOOK_SECRET>
```

**Important:** `ADMIN_API_TOKEN` and `TELEGRAM_WEBHOOK_SECRET` must be **identical** in both `api/.env` and `bot/.env`.

---

## Phase 5 — Nginx Reverse Proxy

### 5.1 Create Nginx Config

```bash
sudo nano /etc/nginx/sites-available/api.your-domain.com
```

Paste this configuration:

```nginx
server {
    listen 80;
    server_name api.your-domain.com;

    # Redirect all HTTP to HTTPS
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.your-domain.com;

    # SSL configuration (managed by Certbot)
    ssl_certificate /etc/letsencrypt/live/api.your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.your-domain.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Proxy to API
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Request-ID $request_id;
        proxy_read_timeout 60s;
        proxy_connect_timeout 10s;
        proxy_send_timeout 60s;
        client_max_body_size 10M;
    }

    # Allow large body size for webhook callbacks
    location /webhooks/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 10M;
    }

    access_log /var/log/nginx/api-access.log;
    error_log /var/log/nginx/api-error.log;
}
```

### 5.2 Enable the Site and Get TLS Certificate

```bash
# Enable the site
sudo ln -s /etc/nginx/sites-available/api.your-domain.com /etc/nginx/sites-enabled/

# Remove the default site
sudo rm /etc/nginx/sites-enabled/default

# Test Nginx config
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx

# Get TLS certificate (replace email and domain)
sudo certbot --nginx -d api.your-domain.com --noninteractive --agree-tos --email your@email.com
```

Certbot will automatically update your Nginx config with HTTPS settings.

### 5.3 Auto-Renew TLS Certificates

Certbot installs a renewal cron job automatically. Verify it:

```bash
sudo systemctl status certbot.timer
sudo certbot renew --dry-run
```

---

## Phase 6 — PM2 Deployment

### 6.1 Create Log Directories

```bash
cd ~/Transferly
mkdir -p logs/api logs/bot data
```

### 6.2 Run the Deployment Script

```bash
./scripts/deploy-ec2.sh
```

The script will:
1. Verify Node.js, npm, and PM2 are available
2. Check that `.env` files exist
3. Install API and bot dependencies
4. Create PM2 log directories
5. Run database migrations
6. Start (or reload) the API, worker, and bot via PM2
7. Save the PM2 process list

### 6.3 Configure PM2 Auto-Restart on Reboot

```bash
pm2 startup systemd -u ubuntu --hp /home/ubuntu
```

Copy and run the command that PM2 prints (it will look like `sudo env ...`). Then save the process list:

```bash
pm2 save
```

### 6.4 Verify All Processes Are Running

```bash
pm2 status
```

You should see:

| App | Status | Restarts |
|-----|--------|----------|
| transferly-api | online | 0 |
| transferly-api-worker | online | 0 |
| transferly-bot | online | 0 |

---

## Phase 7 — Verify the Deployment

### 7.1 Check Health Endpoint

```bash
curl https://api.your-domain.com/health
```

You should see:

```json
{
  "ok": true,
  "status": "healthy",
  "signals": {
    "live": true,
    "ready": true
  }
}
```

### 7.2 Check Detailed Health (with connectivity probes)

```bash
curl https://api.your-domain.com/api/health/detailed
```

### 7.3 Check Process Logs

```bash
pm2 logs transferly-api --lines 50
pm2 logs transferly-api-worker --lines 50
pm2 logs transferly-bot --lines 50
```

---

## Phase 8 — Configure Provider Webhooks

### 8.1 PayPal Webhook

1. Go to [PayPal Developer Dashboard](https://developer.paypal.com/)
2. Select your **Live App** → **Webhooks**
3. Add webhook URL:
   ```
   https://api.your-domain.com/webhooks/paypal
   ```
4. Subscribe to events:
   - `PAYMENT.CAPTURE.COMPLETED`
   - `PAYMENT.CAPTURE.DENIED`
   - `PAYMENT.CAPTURE.REFUNDED`
   - `CHECKOUT.ORDER.APPROVED`
   - `CHECKOUT.ORDER.COMPLETED`
   - `PAYOUT.BATCH.COMPLETED`
   - `PAYOUT.PAYMENT.BLOCKED`
   - `PAYOUT.PAYMENT.DENIED`
   - `PAYOUT.PAYMENT.FAILED`

### 8.2 Telegram Webhook (Optional — Long Polling is Default)

If you want webhook mode instead of long polling:

```bash
curl -F "url=https://api.your-domain.com/api/telegram/webhook" \
     -F "secret_token=<TELEGRAM_WEBHOOK_SECRET>" \
     https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook
```

---

## Phase 9 — Backup Strategy

### 9.1 Database Backup

The SQLite database is at `~/Transferly/api/data/transferly.sqlite`.

Create a backup script:

```bash
nano ~/backup.sh
```

```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR=~/backups
mkdir -p $BACKUP_DIR
cp ~/Transferly/api/data/transferly.sqlite $BACKUP_DIR/transferly_$DATE.sqlite
echo "Backup saved: $BACKUP_DIR/transferly_$DATE.sqlite"

# Keep only the last 7 backups
ls -t $BACKUP_DIR/transferly_*.sqlite | tail -n +8 | xargs rm -f
```

```bash
chmod +x ~/backup.sh
```

### 9.2 Schedule Daily Backups with Cron

```bash
crontab -e
```

Add:

```cron
0 3 * * * /home/ubuntu/backup.sh >> /home/ubuntu/backup.log 2>&1
```

### 9.3 Manual Backup Before Updates

Always back up before running updates:

```bash
cp ~/Transferly/api/data/transferly.sqlite ~/Transferly/api/data/transferly.sqlite.bak
./scripts/deploy-ec2.sh
```

---

## Phase 10 — Updating the Application

### 10.1 Pull Latest Code and Redeploy

```bash
cd ~/Transferly
git pull
./scripts/deploy-ec2.sh
```

### 10.2 Rollback if Something Goes Wrong

```bash
# If the new version fails:
cd ~/Transferly
git log --oneline -5
# Find the last working commit
git checkout <last-working-commit-hash>
./scripts/deploy-ec2.sh
```

### 10.3 Restore from Backup

```bash
pm2 stop all
cp ~/backups/transferly_<working-date>.sqlite ~/Transferly/api/data/transferly.sqlite
pm2 restart all
```

---

## Phase 11 — Monitoring & Alerts

### 11.1 Monitor PM2

```bash
pm2 monit
```

### 11.2 Set Up a Simple Uptime Check

Use a free service like **Better Uptime** or **UptimeRobot** to monitor:

```
https://api.your-domain.com/health
```

Configure alerts to notify you if the endpoint goes down.

### 11.3 Disk Space Monitoring

```bash
df -h
```

Add to crontab:

```cron
0 */6 * * * df -h | grep -E '/dev/' | awk '{print $5 " " $1}' | while read output; do
  usage=$(echo $output | awk '{print $1}' | sed 's/%//g')
  partition=$(echo $output | awk '{print $2}')
  if [ $usage -ge 85 ]; then
    echo "Disk space alert: $usage% used on $partition" | mail -s "Transferly Disk Alert" your@email.com
  fi
done
```

---

## Quick Reference Card

| Task | Command |
|------|---------|
| Check all processes | `pm2 status` |
| View API logs | `pm2 logs transferly-api --lines 100` |
| View worker logs | `pm2 logs transferly-api-worker --lines 100` |
| View bot logs | `pm2 logs transferly-bot --lines 100` |
| Restart everything | `pm2 restart all` |
| Stop everything | `pm2 stop all` |
| Start everything | `pm2 start all` |
| Deploy updates | `cd ~/Transferly && git pull && ./scripts/deploy-ec2.sh` |
| Rollback | `cd ~/Transferly && git checkout <commit> && ./scripts/deploy-ec2.sh` |
| Check health | `curl https://api.your-domain.com/health` |
| Check detailed health | `curl https://api.your-domain.com/api/health/detailed` |
| Backup DB | `cp ~/Transferly/api/data/transferly.sqlite ~/backups/` |
| Restart single app | `pm2 restart transferly-api` |
| Reload Nginx | `sudo systemctl reload nginx` |
| Check Nginx logs | `sudo tail -f /var/log/nginx/api-access.log` |
| Renew TLS | `sudo certbot renew` |

---

## Troubleshooting

### API returns 502 Bad Gateway

Nginx cannot reach the API. Check if the API is running:

```bash
pm2 status
curl http://127.0.0.1:3000/health
```

If the API is down, check the logs:

```bash
pm2 logs transferly-api --lines 100 --err
```

### Database migration fails

```bash
cd ~/Transferly/api
node db/migrate.js
```

### PM2 processes not starting on reboot

```bash
pm2 startup systemd -u ubuntu --hp /home/ubuntu
# Run the command PM2 prints
pm2 save
```

### TLS certificate expired or not renewing

```bash
sudo certbot renew
sudo systemctl status certbot.timer
```

### Redis connection error

```bash
redis-cli ping          # should return PONG
sudo systemctl status redis-server
```

### Out of memory

Upgrade to a larger instance (t3.large) or add swap:

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```
