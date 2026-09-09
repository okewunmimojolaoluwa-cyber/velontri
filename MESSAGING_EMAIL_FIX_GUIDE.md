# 🔧 Messaging & Email Notifications Fix Guide

## Issue 1: In-App Messaging

### Current Status
The messaging system is **implemented** with:
- REST API endpoints (`/chat/messages`, `/chat/inbox`)
- WebSocket support for real-time messaging
- Thread management
- Message queuing for offline users

### Why It Might Not Work Perfectly

1. **WebSocket Connection Issues**
   - WebSockets require `wss://` protocol on HTTPS
   - JWT token needs to be passed as query parameter
   - Connection might be blocked by firewall/proxy

2. **Polling-Based Fallback**
   - Frontend uses polling every 4-8 seconds
   - Should work even if WebSocket fails
   - Check browser console for errors

3. **Missing Database Tables**
   - Requires `threads` and `messages` tables
   - Check if migrations ran successfully

### How to Test Messaging

#### Test 1: Check if endpoints work
```bash
# Get inbox (requires auth token)
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://velontri.onrender.com/api/v1/chat/inbox

# Send message
curl -X POST -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"recipient_id":"USER_ID","content":"Test message"}' \
  https://velontri.onrender.com/api/v1/chat/messages
```

#### Test 2: Check browser console
1. Open `/dashboard/messages`
2. Press F12 → Console tab
3. Look for errors related to:
   - Network requests failing
   - WebSocket connection errors
   - API response errors

#### Test 3: Database check
Run this SQL on Supabase:
```sql
-- Check if tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('threads', 'messages', 'queued_messages');

-- Check message count
SELECT COUNT(*) FROM messages;
SELECT COUNT(*) FROM threads;
```

### Fixes for Messaging

#### Fix 1: Ensure tables exist
If tables don't exist, create them:

```sql
-- Create threads table
CREATE TABLE IF NOT EXISTS threads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    participant_a UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    participant_b UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    listing_id UUID REFERENCES listings(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_thread_participants UNIQUE (participant_a, participant_b, listing_id)
);

CREATE INDEX idx_threads_participant_a ON threads(participant_a);
CREATE INDEX idx_threads_participant_b ON threads(participant_b);

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id UUID NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message_type VARCHAR(20) NOT NULL DEFAULT 'text',
    content TEXT,
    media_s3_key VARCHAR(500),
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_messages_thread_id ON messages(thread_id);
CREATE INDEX idx_messages_sender_id ON messages(sender_id);
CREATE INDEX idx_messages_created_at ON messages(created_at DESC);

-- Create queued messages table
CREATE TABLE IF NOT EXISTS queued_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_queued_messages_recipient ON queued_messages(recipient_id);
```

#### Fix 2: Frontend debugging
Add better error handling to messages page. The current implementation is good but could show clearer error messages.

---

## Issue 2: Email Notifications Not Delivering to Gmail

### Current Configuration

Your `.env` has:
- `BREVO_API_KEY` - Professional email service (recommended)
- `GMAIL_USER` & `GMAIL_APP_PASSWORD` - Gmail SMTP (backup)
- `EMAIL_FROM=okewunmimojolaoluwa@gmail.com`

### Why Emails Might Not Be Delivered

#### 1. **Brevo Domain Verification**
- Brevo requires you to verify `@gmail.com` domain
- Gmail doesn't allow third-party verification
- **Solution**: Use Brevo's provided sender domain or your own custom domain

#### 2. **Gmail App Password Issues**
- App passwords can expire or be revoked
- Gmail blocks bulk sending
- Might be caught in spam filters

#### 3. **Missing Email Service Implementation**
- Notification service might not be calling email sender
- Check if `send_email` function exists and works

### How to Check Email Status

#### Check 1: Verify Brevo API Key
```bash
curl -X GET "https://api.brevo.com/v3/account" \
  -H "api-key: YOUR_BREVO_API_KEY"
```

Expected response: Account details (not 401 Unauthorized)

#### Check 2: Check Brevo sender email
1. Go to https://app.brevo.com
2. Navigate to "Senders"
3. Check if `okewunmimojolaoluwa@gmail.com` is verified
4. If not verified, add a Brevo-provided email like `noreply@yourdomain.com`

#### Check 3: Test email sending
Run the existing test script:
```bash
cd backend
python scripts/test_brevo_email.py
```

Check the output for errors.

### Fixes for Email Notifications

#### Fix 1: Use Brevo Transactional Email (Recommended)

Update your email sender configuration:

**Option A: Use Brevo's provided domain**
1. Go to Brevo dashboard
2. Get your verified sender email (usually `noreply@your-brevo-domain.com`)
3. Update `.env`:
```env
EMAIL_FROM=noreply@your-verified-domain.com
EMAIL_FROM_NAME=Velontri
```

**Option B: Add and verify custom domain**
1. Own a domain (e.g., `velontri.com`)
2. Add domain to Brevo
3. Add DNS records Brevo provides
4. Wait for verification
5. Use `noreply@velontri.com`

#### Fix 2: Update Notification Service

Check if notification service actually sends emails. Look for this file:
```
backend/notification-service/app/email_sender.py
```

If it doesn't exist or doesn't work, here's what it should do:

```python
import httpx
from typing import Optional

async def send_email_via_brevo(
    to_email: str,
    subject: str,
    html_content: str,
    from_email: str = "noreply@velontri.com",
    from_name: str = "Velontri"
) -> bool:
    """Send email using Brevo API."""
    url = "https://api.brevo.com/v3/smtp/email"
    
    headers = {
        "api-key": BREVO_API_KEY,  # From settings
        "Content-Type": "application/json"
    }
    
    payload = {
        "sender": {"name": from_name, "email": from_email},
        "to": [{"email": to_email}],
        "subject": subject,
        "htmlContent": html_content
    }
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(url, headers=headers, json=payload, timeout=10.0)
            return response.status_code == 201
    except Exception as e:
        logger.error(f"Failed to send email: {e}")
        return False
```

#### Fix 3: Enable Email Notifications

Make sure notifications create email tasks. Check `notification-service/app/routers/notifications.py`:

After creating a notification in the database, it should also:
1. Check user's email preferences
2. Send email if user opted in
3. Log the result

#### Fix 4: Gmail-Specific Issues

If you must use Gmail:

1. **Verify App Password is current**:
   - Go to https://myaccount.google.com/apppasswords
   - Generate new app password
   - Update `.env`

2. **Check Gmail sending limits**:
   - Gmail limits to ~500 emails/day
   - Consider switching to Brevo for production

3. **Check spam folder**:
   - Your test emails might be in spam
   - Check Gmail spam folder

4. **Enable "Less secure app access"** (not recommended):
   - Gmail might block even app passwords
   - Better to use Brevo

---

## Quick Action Plan

### For Messaging (5 mins)
1. Go to Supabase → SQL Editor
2. Run the CREATE TABLE scripts above
3. Test by sending a message from listing page
4. Check `/dashboard/messages`

### For Email (15 mins)
1. **Immediate fix (Brevo)**:
   - Go to https://app.brevo.com/account/details
   - Get verified sender email
   - Update `backend/.env` → `EMAIL_FROM`
   - Restart backend on Render

2. **Test**:
   - Register new account
   - Check if welcome email arrives
   - Check Brevo dashboard → Logs

3. **If still not working**:
   - Check backend logs on Render
   - Look for email sending errors
   - Verify BREVO_API_KEY is correct

---

## Testing Checklist

### Messaging
- [ ] Tables exist in database
- [ ] Can see `/dashboard/messages` page
- [ ] Can send message from listing detail page
- [ ] Message appears in recipient's inbox
- [ ] Auto-refresh works (4-8 seconds)

### Email
- [ ] Brevo API key is valid
- [ ] Sender email is verified in Brevo
- [ ] `EMAIL_FROM` in `.env` matches Brevo sender
- [ ] Test email sends successfully
- [ ] Production emails arrive (not in spam)
- [ ] Notification emails work (new order, listing approved, etc.)

---

## Common Errors & Solutions

### Messaging Errors

**Error**: "Cannot identify recipient"
- **Cause**: Thread not created properly
- **Fix**: Ensure `other_user_id` is correct in thread

**Error**: Messages don't appear
- **Cause**: Polling not working or API failing
- **Fix**: Check browser console, verify API returns data

**Error**: 401 Unauthorized
- **Cause**: JWT token expired or missing
- **Fix**: Log out and log back in

### Email Errors

**Error**: "403 Forbidden" from Brevo
- **Cause**: API key invalid or expired
- **Fix**: Regenerate key in Brevo dashboard

**Error**: "Sender not verified"
- **Cause**: Email in `EMAIL_FROM` not added to Brevo
- **Fix**: Add and verify sender in Brevo

**Error**: "Daily limit exceeded"
- **Cause**: Using Gmail with too many sends
- **Fix**: Switch to Brevo (higher limits)

**Error**: Emails go to spam
- **Cause**: SPF/DKIM not configured
- **Fix**: Use verified Brevo domain with proper DNS

---

## Production Recommendations

### For Messaging:
1. ✅ Keep REST API (works now)
2. ✅ Keep polling (reliable fallback)
3. ⚠️ WebSocket is optional (nice-to-have)
4. ✅ Add read receipts
5. ✅ Add typing indicators (already implemented)

### For Email:
1. ✅ Use Brevo for all transactional emails
2. ✅ Verify custom domain (`@velontri.com`)
3. ✅ Set up SPF, DKIM, DMARC records
4. ❌ Don't use Gmail in production
5. ✅ Monitor Brevo dashboard for delivery rates
6. ✅ Add unsubscribe links (legally required)
7. ✅ Implement email preferences in user settings

---

## Support & Resources

### Brevo
- Dashboard: https://app.brevo.com
- API Docs: https://developers.brevo.com/
- Support: https://help.brevo.com

### Supabase
- Dashboard: https://supabase.com/dashboard
- Docs: https://supabase.com/docs

### Render
- Dashboard: https://dashboard.render.com
- Logs: Click your service → Logs tab

---

## Next Steps

1. **Immediate** (do now):
   - Create messaging tables
   - Fix Brevo sender email
   - Test both systems

2. **Short term** (this week):
   - Add email templates
   - Implement email preferences
   - Monitor delivery rates

3. **Long term** (next month):
   - Add custom domain
   - Implement push notifications
   - Add SMS notifications (optional)

---

**Last Updated**: December 2024  
**Status**: Action required - see Quick Action Plan above
