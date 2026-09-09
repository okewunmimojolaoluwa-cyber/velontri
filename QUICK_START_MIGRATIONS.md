# ⚡ Quick Start: Run These SQL Scripts Now

## What You Need To Do

Your features are **coded and deployed** but won't work until you run 2 SQL scripts on Supabase.

**Time**: 5 minutes  
**Difficulty**: Copy & Paste

---

## 📋 Step-by-Step Instructions

### 1. Open Supabase (1 min)

1. Go to: **https://supabase.com/dashboard**
2. Log in
3. Click your **Velontri project**
4. Click **"SQL Editor"** in left sidebar (looks like `</>` icon)

---

### 2. Run Script #1: Followers/Following (2 min)

**Click "New query" button, then copy and paste this entire script:**

```sql
-- Followers/Following System Migration
CREATE TABLE IF NOT EXISTS user_follows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    following_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_follows_pair UNIQUE (follower_id, following_id),
    CONSTRAINT ck_user_follows_no_self CHECK (follower_id != following_id)
);

CREATE INDEX IF NOT EXISTS ix_user_follows_follower ON user_follows(follower_id);
CREATE INDEX IF NOT EXISTS ix_user_follows_following ON user_follows(following_id);
CREATE INDEX IF NOT EXISTS ix_user_follows_created_at ON user_follows(created_at DESC);

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='followers_count') THEN
        ALTER TABLE users ADD COLUMN followers_count INTEGER NOT NULL DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='following_count') THEN
        ALTER TABLE users ADD COLUMN following_count INTEGER NOT NULL DEFAULT 0;
    END IF;
END $$;

CREATE OR REPLACE FUNCTION update_follow_counts() RETURNS TRIGGER AS $$
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

DROP TRIGGER IF EXISTS trg_update_follow_counts ON user_follows;
CREATE TRIGGER trg_update_follow_counts AFTER INSERT OR DELETE ON user_follows FOR EACH ROW EXECUTE FUNCTION update_follow_counts();
```

**Click "RUN"** button (usually bottom-right)

✅ **Expected**: See "Success. No rows returned" or multiple success messages

---

### 3. Run Script #2: Messaging System (2 min)

**Click "New query" again, then copy and paste this script:**

```sql
-- Messaging System Migration
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

CREATE TABLE IF NOT EXISTS queued_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_queued_messages_recipient ON queued_messages(recipient_id);
CREATE INDEX IF NOT EXISTS idx_queued_messages_created ON queued_messages(created_at);
```

**Click "RUN"** button

✅ **Expected**: Success messages for all tables

---

### 4. Verify It Worked (30 seconds)

**Run this verification query:**

```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('user_follows', 'threads', 'messages', 'queued_messages')
ORDER BY table_name;
```

**Expected Output**: Should show all 4 tables:
```
messages
queued_messages
threads
user_follows
```

✅ **If you see all 4 tables, you're done with database migrations!**

---

## ✉️ Email Configuration (Optional but Recommended)

Your emails currently won't send because you're using a Gmail address with Brevo, which requires verification.

### Quick Fix:

1. Go to: **https://app.brevo.com/account/senders**
2. Find a **verified sender email** (look for ✅ green checkmark)
3. Go to: **https://dashboard.render.com**
4. Click your **backend service**
5. Click **"Environment"** tab
6. Find `EMAIL_FROM` variable
7. Change it to your **verified Brevo sender email**
8. Click **"Save Changes"**

Backend will automatically redeploy (takes 2-3 minutes).

---

## 🧪 Test Your Features

### Test Follow Button:
1. Go to: https://velontri.pxxl.click
2. Click any listing
3. Click **"Follow"** button on seller
4. Should change to **"Following"** ✅

### Test Followers Page:
1. Go to: https://velontri.pxxl.click/dashboard/followers
2. Should see list of your followers (or empty if no one follows you yet)

### Test Following Page:
1. Go to: https://velontri.pxxl.click/dashboard/following
2. Should see users you follow

### Test Messages:
1. Go to: https://velontri.pxxl.click/dashboard/messages
2. Page should load without errors

---

## ❌ Troubleshooting

**Follow button doesn't work?**
- Check browser console (F12 → Console) for errors
- Try logging out and logging back in
- Make sure migration #1 ran successfully

**Messages page errors?**
- Make sure migration #2 ran successfully
- Check browser console for specific error

**Still having issues?**
- Check the detailed guide: `URGENT_ACTION_REQUIRED.md`
- Check backend logs: https://dashboard.render.com → Your service → Logs

---

## ✅ Done!

Once you've completed these steps:
- ✅ Follow/unfollow will work
- ✅ Follower counts will update automatically  
- ✅ Messaging system will be operational
- ✅ Followers/Following pages will show real data

**Next steps**: Monitor your logs for any errors and test the features with real users!

