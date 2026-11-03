# 🚀 Render Dashboard Setup - Quick Instructions

## What You Need To Do RIGHT NOW

The verification email system is fixed in code, but you need to add one environment variable on Render to make it work.

---

## Step-by-Step Instructions

### 1. Login to Render
Go to: https://dashboard.render.com

### 2. Find the Worker Service
- Look for: **velontri-verification-reminder**
- It's a **Worker** service (not a Web Service)
- Click on it

### 3. Go to Environment Tab
- Click **Environment** in the left sidebar

### 4. Add BREVO_API_KEY
Click **Add Environment Variable** button and enter:

```
Key:   BREVO_API_KEY
Value: [Get from backend/.env file - starts with xkeysib-...]
```

**Note:** Copy the BREVO_API_KEY value from your `backend/.env` file. It should start with `xkeysib-`

Click **Save Changes**

### 5. Wait for Automatic Redeploy
- Render will automatically redeploy the worker
- Wait 2-3 minutes for deployment to complete
- Status should show "Live" or "Running"

### 6. Check Logs
- Click **Logs** tab
- You should see:
  ```
  Verification reminder worker started
  Will send reminders daily at 10:00 AM WAT
  Next reminder run scheduled for YYYY-MM-DD 10:00 WAT
  Sleeping for X.X hours...
  ```

### 7. ✅ Done!
If you see those logs, the worker is running correctly and will send emails daily at 10 AM WAT.

---

## Quick Verification Checklist

After adding the environment variable, check:

- [ ] Worker status shows "Live" or "Running" (not "Failed")
- [ ] Logs show "Verification reminder worker started"
- [ ] Logs show "Next reminder run scheduled for..."
- [ ] No error messages in logs

---

## If Something Goes Wrong

### Worker shows "Failed" status
1. Click **Manual Deploy** → **Deploy latest commit**
2. Wait for deployment to complete
3. Check logs for error messages

### No logs showing
1. Refresh the page
2. Click **Events** tab to see deployment history
3. Make sure the latest deployment succeeded

### Still not working?
1. Check that BREVO_API_KEY was copied correctly (no extra spaces)
2. Check that DATABASE_URL is set correctly
3. Contact support or check GitHub issues

---

## When Will Emails Be Sent?

- **First run**: Next day at 10:00 AM WAT (West Africa Time)
- **Schedule**: Every day at 10:00 AM WAT automatically
- **Recipients**: All unverified sellers who haven't received a reminder in 23 hours

---

## How to Test Right Now (Optional)

If you want to test immediately without waiting for 10 AM:

1. Go to worker **Logs** tab
2. Look for "Shell" button (if available)
3. Run:
   ```bash
   cd /opt/render/project/src/backend
   python -c "import asyncio; from scripts.verification_reminder_worker import send_verification_reminders; asyncio.run(send_verification_reminders())"
   ```
4. Check logs for "Sent X reminders"

---

**IMPORTANT**: The BREVO_API_KEY must be added for emails to work. Without it, the worker will run but won't send any emails!
