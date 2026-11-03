# ✅ Verification Email Notifications - Fixed

## Issue
Unverified sellers were NOT receiving daily email reminders to complete their verification, even though the worker was configured.

## Root Cause
The `velontri-verification-reminder` worker in `render.yaml` was missing the **BREVO_API_KEY** environment variable, which is required to send emails via Brevo API.

## Solution

### Code Changes (Commit 814eaa7)

Updated `render.yaml` to add required environment variables to the worker:

```yaml
- type: worker
  name: velontri-verification-reminder
  runtime: python
  region: oregon
  plan: free
  rootDir: backend
  buildCommand: pip install -r requirements.txt
  startCommand: python scripts/verification_reminder_worker.py
  pythonVersion: "3.11.9"
  
  envVars:
    - key: ENVIRONMENT
      value: production
    - key: LOG_LEVEL
      value: INFO
    - key: PYTHONPATH
      value: "/opt/render/project/src/backend:/opt/render/project/src/backend/scripts"
    - key: DATABASE_URL
      value: "postgresql+asyncpg://..."
    - key: BREVO_API_KEY          # ← ADDED
      sync: false                  # ← ADDED
    - key: EMAIL_FROM              # ← ADDED
      value: "okewunmimojolaoluwa@gmail.com"
    - key: EMAIL_FROM_NAME         # ← ADDED
      value: "Velontri"
```

## What You Need to Do on Render Dashboard

### Step 1: Go to Render Dashboard
1. Login to https://dashboard.render.com
2. Navigate to your services list
3. Find and click on `velontri-verification-reminder` worker

### Step 2: Add BREVO_API_KEY Environment Variable
1. Go to **Environment** tab
2. Click **Add Environment Variable**
3. Add the following:
   - **Key**: `BREVO_API_KEY`
   - **Value**: `[Copy from backend/.env file]`
   
   **Note:** Get the BREVO_API_KEY from your `backend/.env` file. It starts with `xkeysib-`
   
4. Click **Save Changes**

### Step 3: Redeploy the Worker
The worker should automatically redeploy after adding the environment variable. If not:
1. Click **Manual Deploy** → **Deploy latest commit**
2. Wait for deployment to complete

### Step 4: Verify Worker is Running
1. Go to **Logs** tab
2. You should see:
   ```
   Verification reminder worker started
   Will send reminders daily at 10:00 AM WAT
   Next reminder run scheduled for YYYY-MM-DD 10:00 WAT
   ```

## How It Works

### Daily Schedule
- Worker runs **24/7** in the background
- Sends reminders at **10:00 AM WAT (West Africa Time)** every day
- Automatically handles timezone conversion (UTC+1)

### Who Gets Emails?
Sends emails to sellers who:
- ✅ Have `seller_verification_status` IN ('not_verified', 'pending', 'rejected')
- ✅ Have a valid email address
- ✅ Haven't received a reminder in the last 23 hours

### What Emails Are Sent?

#### Not Verified Sellers
- **Subject**: "Velontri: Complete Your Seller Verification"
- **Message**: "Get verified to build trust with buyers! Verified sellers get 3× more inquiries..."
- **CTA**: Button linking to verification page

#### Pending Verification
- **Subject**: "Velontri: Verification Under Review"
- **Message**: "Your verification is being reviewed. This usually takes 24-48 hours..."
- **CTA**: Button to check status

#### Rejected Verification
- **Subject**: "Velontri: Resubmit Your Verification"
- **Message**: "Your previous verification was rejected. Please review the feedback..."
- **CTA**: Button to resubmit

### Database Updates
After each reminder:
1. ✅ Creates notification in `notifications` table (visible on web)
2. ✅ Sends HTML email via Brevo API
3. ✅ Updates `last_verification_reminder` timestamp in `users` table
4. ✅ Logs success/failure

## Monitoring

### Check Email Delivery (Brevo Dashboard)
1. Login to https://app.brevo.com
2. Go to **Statistics** → **Email**
3. View:
   - Emails sent today
   - Delivery rate
   - Open rate
   - Bounce rate

### Check Worker Logs (Render Dashboard)
1. Go to worker service
2. Click **Logs** tab
3. Look for:
   ```
   Starting verification reminder batch...
   Sent email reminder to user@example.com (status: not_verified)
   Completed: sent 42 reminders
   ```

### Check Database
```sql
-- Count users who should get reminders
SELECT 
    COUNT(*) as eligible_users,
    seller_verification_status,
    MAX(last_verification_reminder) as last_sent
FROM users
WHERE seller_verification_status IN ('not_verified', 'pending', 'rejected')
    AND email IS NOT NULL
    AND email != ''
    AND (
        last_verification_reminder IS NULL 
        OR last_verification_reminder < NOW() - INTERVAL '23 hours'
    )
GROUP BY seller_verification_status;

-- Check recent reminders
SELECT 
    email,
    seller_verification_status,
    last_verification_reminder
FROM users
WHERE last_verification_reminder IS NOT NULL
ORDER BY last_verification_reminder DESC
LIMIT 20;
```

## Testing

### Test Immediately (Without Waiting for 10 AM)
You can manually trigger the worker to test:

1. **SSH into Render service** (if you have access):
   ```bash
   cd /opt/render/project/src/backend
   python scripts/verification_reminder_worker.py
   ```

2. **Or run locally**:
   ```bash
   cd backend
   python scripts/verification_reminder_worker.py
   ```

3. **Or use test script**:
   ```bash
   python test_verification_reminder.py
   ```

### Expected Test Results
- ✅ Worker connects to database
- ✅ Finds unverified users
- ✅ Creates web notifications
- ✅ Sends emails via Brevo
- ✅ Updates `last_verification_reminder` timestamps
- ✅ Logs all actions

## Troubleshooting

### Problem: Worker not starting
**Check:**
1. Render dashboard → Worker service → **Status** should be "Running"
2. Logs should show "Verification reminder worker started"

**Solution:**
- Redeploy worker from Render dashboard
- Check environment variables are set
- Check Python version is 3.11.9

### Problem: No emails being sent
**Check:**
1. `BREVO_API_KEY` is set in Render environment variables
2. Brevo account is active (not suspended)
3. Daily limit not reached (300 emails/day on free tier)

**Solution:**
```python
# Test Brevo API locally
cd backend
python scripts/test_brevo_email.py
```

### Problem: Emails going to spam
**Solution:**
1. Verify sender domain in Brevo
2. Add SPF record to DNS:
   ```
   v=spf1 include:spf.sendinblue.com ~all
   ```
3. Add DKIM records (provided by Brevo)
4. Ask users to whitelist the sender email

### Problem: Worker keeps crashing
**Check logs for:**
- Database connection errors
- Brevo API errors
- Python dependency issues

**Solution:**
```bash
# Check worker logs
render logs --service velontri-verification-reminder

# Redeploy if needed
render deploy --service velontri-verification-reminder
```

## Performance & Limits

### Brevo Free Tier Limits
- **300 emails/day**
- **Unlimited contacts**
- **Email templates**
- **Real-time statistics**

### Worker Resource Usage
- **Memory**: ~50-100 MB
- **CPU**: Minimal (only active for ~1-5 minutes per day)
- **Network**: ~1-5 KB per email sent

### Rate Limiting
- Sends up to **500 reminders per run** (LIMIT 500 in SQL query)
- If you have more than 500 unverified users, it will send to 500 per day
- Users not reminded today will be reminded tomorrow

## Production Readiness Checklist

Before marking this as "done", verify:

- [ ] **Render Dashboard**: BREVO_API_KEY environment variable is set
- [ ] **Worker Status**: velontri-verification-reminder is "Running"
- [ ] **Worker Logs**: Show "Verification reminder worker started"
- [ ] **Database**: `last_verification_reminder` column exists in `users` table
- [ ] **Brevo Dashboard**: Account is active and verified
- [ ] **Email Delivery**: Test email received successfully
- [ ] **Monitoring**: Set up alerts for worker failures

## Next Steps After Deployment

1. **Wait for 10:00 AM WAT tomorrow** (or manually trigger for testing)
2. **Check Render logs** to see how many reminders were sent
3. **Check Brevo dashboard** to see email delivery rate
4. **Ask a test user** if they received the email
5. **Monitor for 1 week** to ensure it's working consistently

## Files Modified

- `render.yaml` - Added BREVO_API_KEY, EMAIL_FROM, EMAIL_FROM_NAME env vars

## Files Already Implemented (No Changes Needed)

- `backend/scripts/verification_reminder_worker.py` - Worker script
- `backend/shared/email_notifications.py` - Email sending function
- `backend/shared/database.py` - Database connection

## Related Documentation

- `EMAIL_NOTIFICATION_SYSTEM.md` - Complete email system documentation
- `VERIFICATION_REMINDER_FIX_COMPLETE.md` - Previous verification work
- `test_verification_reminder.py` - Test script

---

**Issue**: Unverified sellers not getting daily email reminders  
**Status**: ✅ Fixed - Waiting for Render deployment  
**Commit**: 814eaa7  
**Date**: 2026-11-03  
**Action Required**: Add BREVO_API_KEY to Render dashboard environment variables
