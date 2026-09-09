# 🚨 URGENT: Database Migrations & Fixes Required

## Current Status

Your code is **fully deployed** to production, but several features **won't work** until you run database migrations. This is a **5-minute task** that must be done on Supabase dashboard.

---

## ✅ What's Working Now

1. ✅ Navbar shows real user name and profile photo
2. ✅ User profile pages display correctly  
3. ✅ Listing pages render properly
4. ✅ Backend APIs are ready and deployed
5. ✅ All frontend components are in place

---

## ❌ What's NOT Working (Needs Migration)

### 1. Follow/Unfollow Feature
**Status**: 🔴 BLOCKED - Database table missing

**Symptoms**:
- Follow button appears but doesn't work
- Clicking follow does nothing or shows error
- Follower counts show 0

**Why**: The `user_follows` table doesn't exist in your database yet

**Impact**: Users cannot follow each other

---

### 2. In-App Messaging
**Status**: 🟡 UNKNOWN - Tables may be missing

**Symptoms**:
- Messages page loads but may not send/receive
- Inbox might be empty even with messages
- Real-time messaging doesn't work

**Why**: `threads` and `messages` tables may not exist

**Impact**: Users cannot message each other

---

### 3. Email Notifications
**Status**: 🟠 CONFIGURATION ISSUE

**Symptoms**:
- Users don't receive notification emails
- Welcome emails not arriving
- Order notifications missing

**Why**: Gmail address (`okewunmimojolaoluwa@gmail.com`) cannot be used with Brevo without verification

**Impact**: Users miss important updates

---

## 🎯 IMMEDIATE ACTION REQUIRED

### Step 1: Run Database Migrations (10 minutes)

#### A. Go to Supabase Dashboard
1. Open: https://supabase.com/dashboard
2. Log in with your account
3. Click on your **Velontri project**

#### B. Open SQL Editor
1. Click **"SQL Editor"** in left sidebar (icon: `</>`)
2. Click **"New query"** button

#### C. Migration 1: Create Followers/Following System

**Copy and paste this entire SQL script:**

```sql
-- ============================================================================
-- Velontri Followers/Following System - Database Migration
-- ============================================================================

-- Create the main user_follows table
CREATE TABLE IF NOT EXISTS user_follows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    following_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_follows_pair UNIQUE (follower_id, following_id),
    CONSTRAINT ck_user_follows_no_self CHECK (follower_id != following_id)
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS ix_user_follows_follower ON user_follows(follower_id);
CREATE INDEX IF NOT EXISTS ix_user_follows_following ON user_follows(following_id);
CREATE INDEX IF NOT EXISTS ix_user_follows_created_at ON user_follows(created_at DESC);

-- Add count columns to users table
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='users' AND column_name='followers_count'
    ) THEN
        ALTER TABLE users ADD COLUMN followers_count INTEGER NOT NULL DEFAULT 0;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='users' AND column_name='following_count'
    ) THEN
        ALTER TABLE users ADD COLUMN following_count INTEGER NOT NULL DEFAULT 0;
    END IF;
END $$;

-- Create trigger function to auto-update counts
CREATE OR REPLACE FUNCTION update_follow_counts()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        UPDATE users SET followers_count = followers_count + 1 WHERE id = NEW.following_id;
        UPDATE users SET following_count = following_count + 1 WHERE id = NEW.follower_id;
        RETURN NEW;
    ELSIF (TG_OP = 'DELETE') THEN
        UPDATE users SET followers_count = GREATEST(followers_count - 1, 0) WHERE id = OLD.following_id;
        UPDATE users SET following_count = GREATEST(following_count - 1, 0) WHERE id = OLD.follower_id;
        RETURN OLD;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
DROP TRIGGER IF EXISTS trg_update_follow_counts ON user_follows;
CREATE TRIGGER trg_update_follow_counts
AFTER INSERT OR DELETE ON user_follows
FOR EACH ROW EXECUTE FUNCTION update_follow_counts();
```

**Click "RUN" button** (bottom-right)

**Expected Output**: You should see "Success. No rows returned" or similar success messages.

---

#### D. Migration 2: Create Messaging System

**In a NEW query, copy and paste this SQL:**

```sql
-- ============================================================================
-- Velontri Messaging System - Database Migration
-- ============================================================================

-- Create threads table (conversation between 2 users)
CREATE TABLE IF NOT EXISTS threads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    participant_a UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    participant_b UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    listing_id UUID REFERENCES listings(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_thread_participants UNIQUE (participant_a, participant_b, listing_id)
);

CREATE INDEX IF NOT EXISTS idx_threads_participant_a ON threads(participant_a);
CREATE INDEX IF NOT EXISTS idx_threads_participant_b ON threads(participant_b);
CREATE INDEX IF NOT EXISTS idx_threads_listing ON threads(listing_id);

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

CREATE INDEX IF NOT EXISTS idx_messages_thread_id ON messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);

-- Create queued messages table (for offline delivery)
CREATE TABLE IF NOT EXISTS queued_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_queued_messages_recipient ON queued_messages(recipient_id);
CREATE INDEX IF NOT EXISTS idx_queued_messages_created ON queued_messages(created_at);
```

**Click "RUN" button**

**Expected Output**: Success messages for each table creation.

---

#### E. Verify Migrations Worked

**Run this verification query:**

```sql
-- Check if all required tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('user_follows', 'threads', 'messages', 'queued_messages')
ORDER BY table_name;
```

**Expected Output**: Should show all 4 tables:
- `messages`
- `queued_messages`
- `threads`
- `user_follows`

---

### Step 2: Fix Email Configuration (5 minutes)

#### A. Get Your Brevo Verified Sender Email

1. Go to: https://app.brevo.com/account/senders
2. Log in with your Brevo account
3. Look for **verified sender emails**
4. Find one that says "✅ Verified"
5. **Copy that email address**

Common options:
- If you see your custom domain: `noreply@yourdomain.com` ✅ **Use this**
- If only default: `noreply@yourdomain.brevo.email` ✅ **Use this**
- If you see `okewunmimojolaoluwa@gmail.com` with ❌ or ⚠️: **Cannot use Gmail**

#### B. Update Environment Variables

**Option 1: Update on Render (Recommended)**
1. Go to: https://dashboard.render.com
2. Find your **backend service** (velontri-backend or gateway)
3. Click **"Environment"** tab
4. Find `EMAIL_FROM` variable
5. Change value to your **verified Brevo sender email** from step A
6. Click **"Save Changes"**
7. Service will auto-redeploy (takes 2-3 minutes)

**Option 2: Update Local .env (For Local Testing)**
1. Open `backend/.env` file
2. Find line: `EMAIL_FROM=okewunmimojolaoluwa@gmail.com`
3. Change to: `EMAIL_FROM=your-verified-brevo-email@domain.com`
4. Save file

#### C. Test Email Sending

After updating, test with:
```bash
cd backend
python scripts/test_brevo_email.py
```

Expected: "Email sent successfully!"

---

## 🧪 Testing After Migrations

### Test 1: Follow System (2 minutes)

1. **Go to**: https://velontri.pxxl.click
2. **Log in** as a user
3. **Browse listings** or search users
4. **Click a listing** → In seller section, click **"Follow"** button
5. **Expected**: 
   - Button changes to "Following" ✅
   - Seller's follower count increases
   - You receive a notification

6. **Go to**: `/dashboard/following`
7. **Expected**: See the user you just followed

8. **Go to**: `/dashboard/followers`  
9. **Expected**: See users who follow you (when others follow you)

**If it works**: ✅ Follow system is live!

**If it doesn't work**: Check browser console (F12) for errors and check the troubleshooting section.

---

### Test 2: Messaging System (3 minutes)

1. **Go to**: https://velontri.pxxl.click/dashboard/messages
2. **Click on any listing**
3. **In seller section**, click **"Contact Seller"** (if you have this button)
4. **Type a message** and send
5. **Expected**:
   - Message appears in your sent messages
   - Message appears in seller's inbox
   - Real-time delivery works

**If you don't have "Contact Seller" button yet**:
- This is a future enhancement
- Direct messaging works via API
- Users can message from order/transaction flows

---

### Test 3: Email Notifications (2 minutes)

1. **Create a new account** with a real email (not the test one)
2. **Check email inbox**
3. **Expected**: Welcome email arrives within 1 minute

4. **Have someone follow you**
5. **Check email inbox**
6. **Expected**: "New Follower" email arrives

**If emails don't arrive**:
- Check spam folder
- Verify Brevo sender is correct
- Check Brevo dashboard logs: https://app.brevo.com/email/campaigns

---

## 🔧 Troubleshooting

### Issue: "relation 'user_follows' does not exist"

**Cause**: Migration Step 1C not run

**Fix**: Go back and run the followers/following SQL script

---

### Issue: "relation 'threads' does not exist"

**Cause**: Migration Step 1D not run

**Fix**: Go back and run the messaging system SQL script

---

### Issue: Follow button does nothing

**Possible Causes**:
1. Migration not run → Check Supabase
2. Network error → Check browser console (F12 → Console)
3. Not logged in → Log out and log back in
4. JWT token expired → Clear cookies and log in again

**Debug**:
```javascript
// Open browser console (F12) and run:
fetch('https://velontri.onrender.com/api/v1/users/me', {
  headers: {
    'Authorization': 'Bearer ' + document.cookie.match(/token=([^;]+)/)[1]
  }
}).then(r => r.json()).then(console.log)
```

Should return your user data. If not, re-login.

---

### Issue: Emails still not sending

**Check 1**: Verify Brevo API key is correct
```bash
curl -X GET "https://api.brevo.com/v3/account" \
  -H "api-key: YOUR_BREVO_API_KEY_HERE"
```

Should return account details (not 401 error)

**Check 2**: Verify sender email in Brevo
- https://app.brevo.com/account/senders
- Must have green checkmark ✅

**Check 3**: Check Brevo logs
- https://app.brevo.com/email/campaigns
- Look for recent emails
- Check delivery status

---

### Issue: Messages not appearing in inbox

**Check 1**: Verify tables exist
```sql
SELECT COUNT(*) FROM threads;
SELECT COUNT(*) FROM messages;
```

Should return counts (even if 0)

**Check 2**: Check browser console for API errors
- F12 → Console tab
- Look for 404 or 500 errors

**Check 3**: Try sending via REST API directly
```javascript
// In browser console:
fetch('https://velontri.onrender.com/api/v1/chat/messages', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + document.cookie.match(/token=([^;]+)/)[1],
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    recipient_id: 'USER_ID_HERE',
    content: 'Test message'
  })
}).then(r => r.json()).then(console.log)
```

---

## 📊 Migration Checklist

Use this checklist to track your progress:

### Database Migrations
- [ ] Opened Supabase dashboard
- [ ] Ran followers/following migration (Step 1C)
- [ ] Ran messaging system migration (Step 1D)
- [ ] Verified all 4 tables exist (Step 1E)

### Email Configuration
- [ ] Found verified Brevo sender email
- [ ] Updated EMAIL_FROM on Render
- [ ] Backend service redeployed
- [ ] Tested email sending

### Testing
- [ ] Tested follow button works
- [ ] Checked followers/following pages
- [ ] Tested messaging (if available)
- [ ] Verified email notifications arrive

### Production Verification
- [ ] No errors in browser console
- [ ] No errors in Render logs
- [ ] Users can follow each other
- [ ] Emails arrive in inbox (not spam)

---

## 🎉 Success Criteria

Your system is **fully operational** when:

✅ Users can follow/unfollow each other  
✅ Follower counts update in real-time  
✅ Dashboard shows correct followers/following lists  
✅ Messages can be sent and received  
✅ Email notifications arrive within 1 minute  
✅ No errors in browser console  
✅ No errors in Render backend logs  

---

## 📞 Need Help?

### Check Logs

**Backend Logs**:
1. Go to: https://dashboard.render.com
2. Click your backend service
3. Click **"Logs"** tab
4. Look for errors related to database or email

**Browser Console**:
1. Press F12
2. Go to **Console** tab
3. Look for red errors
4. Look for failed API calls

**Supabase Logs**:
1. Go to: https://supabase.com/dashboard
2. Click your project
3. Click **"Logs"** → **"Postgres Logs"**
4. Check for errors

---

## 🚀 After Migrations Are Complete

Once you've completed all migrations and testing:

1. ✅ **Monitor for 24 hours**
   - Check Render logs for errors
   - Check Brevo dashboard for email delivery rates
   - Monitor user feedback

2. ✅ **Update User Guides**
   - Document how to follow users
   - Document how to send messages
   - Add screenshots if helpful

3. ✅ **Consider Enhancements**
   - Add "From Sellers You Follow" feed
   - Add follow button to more locations
   - Add email preferences to user settings
   - Add push notifications (future)

---

## 📝 Summary

**Current State**: Code deployed, features blocked by database  
**Time Required**: 15 minutes total  
**Difficulty**: Easy (copy-paste SQL)  
**Impact**: Unlocks social features for all users  

**Priority**: 🔴 HIGH - Features are visible but broken until migrations run

---

**Document Version**: 1.0  
**Last Updated**: December 2024  
**Status**: Action Required

