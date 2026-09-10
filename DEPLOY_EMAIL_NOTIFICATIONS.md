# 🚀 Deploy Email Notifications - Quick Guide

## What Changed

Every notification on the web now sends a beautiful HTML email to users' Gmail automatically.

## Pre-Deployment Checklist

### 1. Verify Environment Variables

Check that `backend/.env` has:
```env
BREVO_API_KEY=xkeysib-your-actual-key-here
EMAIL_FROM=noreply@velontri.com
EMAIL_FROM_NAME=Velontri
```

### 2. Test Locally (Optional but Recommended)

```bash
# Test email notifications
python test_email_notifications.py
```

Expected output:
- ✅ BREVO_API_KEY configured
- ✅ 5/5 tests passed
- 📧 Check your Gmail for test emails

### 3. Verify Changes

```bash
git status
git log -1 --stat
```

Should show:
- `backend/shared/email_notifications.py` (new file)
- Updated: marketplace, subscription, social, verification, analytics services
- Test script and documentation

## Deployment Steps

### Option A: Git Push (Recommended)

```bash
# Push to main branch
git push origin main

# Or push to production branch
git push origin production
```

Your CI/CD will automatically:
1. Pull latest code
2. Restart backend services
3. Apply changes

### Option B: Manual Render Deploy

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Find your **velontri** service
3. Click **Manual Deploy** → **Deploy latest commit**
4. Wait for deployment to complete (~2-3 minutes)

### Option C: Manual Server Deploy

```bash
# SSH into server
ssh user@yourserver.com

# Pull latest code
cd /path/to/velontri
git pull origin main

# Restart services
sudo systemctl restart velontri-marketplace
sudo systemctl restart velontri-subscription
sudo systemctl restart velontri-user
sudo systemctl restart velontri-analytics
```

## Post-Deployment Verification

### 1. Check Services Are Running

```bash
# On Render
# Check logs in Render dashboard for each service

# On manual server
sudo systemctl status velontri-marketplace
sudo systemctl status velontri-subscription
```

### 2. Test Email Notifications

#### Method 1: Via Web App
1. Login with your test account
2. Trigger a notification (e.g., follow someone)
3. Check your Gmail for email

#### Method 2: Via API
```bash
# Follow a user (triggers notification + email)
curl -X POST https://velontri.onrender.com/api/v1/users/USER_ID/follow \
  -H "Authorization: Bearer YOUR_TOKEN"

# Create a listing (notifies followers)
# Check Gmail of followers
```

### 3. Monitor Brevo Dashboard

1. Login to [Brevo](https://app.brevo.com/)
2. Go to **Statistics** → **Email**
3. Check for:
   - Recent email sends
   - Delivery rate >95%
   - No bounces

### 4. Check Backend Logs

```bash
# Search for email notification logs
grep "email_notification" /path/to/logs/*.log

# Should see entries like:
# "email_notification_sent" - Success
# "email_notification_failed" - Need to investigate
```

## Rollback Plan (If Needed)

If emails are causing issues:

### Option 1: Disable Email Temporarily

Edit `backend/shared/email_notifications.py`:

```python
# At the top of send_notification_email()
if not BREVO_API_KEY:
    logger.warning("email_notification_skipped", reason="BREVO_API_KEY not configured")
    return False, "Email temporarily disabled"  # Add this line to disable
```

### Option 2: Revert Commit

```bash
# Revert to previous commit
git revert HEAD
git push origin main
```

### Option 3: Remove Brevo API Key

```bash
# Temporarily remove from .env
# BREVO_API_KEY=

# System will gracefully skip emails
```

**Note**: Notifications will still work on web even if emails fail!

## Common Issues

### Issue: "BREVO_API_KEY not configured"

**Solution**: Add key to `.env` and restart services

### Issue: Emails going to spam

**Solution**: 
1. Verify domain in Brevo
2. Add SPF/DKIM DNS records
3. Ask users to whitelist noreply@velontri.com

### Issue: "Email send timeout"

**Solution**: Normal - emails are sent async with 10s timeout. Doesn't block users.

### Issue: High email volume hitting rate limits

**Solution**: Upgrade Brevo plan or batch notifications

## Success Criteria

✅ All backend services restarted successfully  
✅ No errors in logs related to email notifications  
✅ Test notification triggers email  
✅ Email arrives in Gmail (not spam)  
✅ Email has correct branding and formatting  
✅ Action button in email works  
✅ Brevo dashboard shows successful sends  

## Monitoring

### First 24 Hours

- Check Brevo stats every few hours
- Monitor error logs for email failures
- Verify delivery rate stays >95%
- Watch for spam complaints

### Ongoing

- Weekly check of Brevo usage
- Monthly review of email templates
- Quarterly audit of notification types

## Need Help?

1. Check `EMAIL_NOTIFICATION_SYSTEM.md` for detailed docs
2. Run `python test_email_notifications.py` to diagnose
3. Check Brevo logs for delivery issues
4. Review backend logs for exceptions

---

**Deployed By**: _______  
**Date**: _______  
**Result**: ✅ Success / ⚠️ Issues / ❌ Rollback
