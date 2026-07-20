# Velontri Backend — Deploy to Render

## Prerequisites
- A [Render](https://render.com) account (free tier works for testing)
- The code pushed to a GitHub/GitLab repository

## Step 1 — Push to GitHub

```bash
git add .
git commit -m "feat: render deployment config"
git push origin main
```

## Step 2 — Create a New Web Service on Render

1. Go to [dashboard.render.com](https://dashboard.render.com)
2. Click **New** → **Web Service**
3. Connect your GitHub repo
4. Configure:
   - **Name:** `velontri-backend`
   - **Root Directory:** `backend`
   - **Environment:** `Python 3`
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `bash start.sh`
   - **Plan:** Free (or Starter for persistent disk)

## Step 3 — Set Environment Variables

In the Render dashboard → your service → **Environment** tab, add:

| Key | Value | Notes |
|-----|-------|-------|
| `GMAIL_USER` | `your@gmail.com` | For OTP emails |
| `GMAIL_APP_PASSWORD` | `xxxx xxxx xxxx xxxx` | Gmail App Password |
| `PAYSTACK_SECRET_KEY` | `sk_test_...` | From Paystack dashboard |
| `PAYSTACK_WEBHOOK_URL` | `https://your-app.onrender.com/api/v1/subscriptions/paystack/webhook` | Your Render URL |
| `GOOGLE_CLIENT_ID` | `...` | Optional: Google OAuth |
| `ALLOWED_ORIGINS` | `https://your-frontend.vercel.app` | Your frontend URL |
| `ACCESS_TOKEN_TTL_SECONDS` | `28800` | 8 hours |
| `TOTP_ENCRYPTION_KEY` | *(generate below)* | Required |

### Generate TOTP key
```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

## Step 4 — Persistent Disk (Recommended for Production)

On the free tier, SQLite data **resets on every deploy**. To persist data:

1. Upgrade to the **Starter** plan ($7/month)
2. Add a disk in Render → your service → **Disks** tab:
   - **Name:** `velontri-data`
   - **Mount Path:** `/data`
   - **Size:** 1 GB
3. Add env var: `SQLITE_DB_PATH=/data/velontri.db`

## Step 5 — Update Frontend API URL

In your frontend's environment (Vercel dashboard or `.env.local`):
```
NEXT_PUBLIC_API_URL=https://velontri-backend.onrender.com/api/v1
```

## Step 6 — Seed Admin User After Deploy

After the first deploy, run this in Render's **Shell** tab:

```bash
cd /opt/render/project/src/backend
python scripts/seed_demo_users.py
```

## Health Check

Your API will be available at:
```
https://velontri-backend.onrender.com/health
https://velontri-backend.onrender.com/docs
https://velontri-backend.onrender.com/api/v1
```

## Notes

- **Free tier cold starts:** Render spins down idle services after 15 minutes. First request may take 30-60 seconds to warm up. Upgrade to Starter ($7/mo) to avoid this.
- **SQLite on free tier:** All data is lost on each deploy or restart. Use the persistent disk add-on for production.
- **Logs:** View real-time logs in Render dashboard → your service → **Logs** tab.
