# 🎯 Run Migration on Supabase PostgreSQL

## Your Database Setup

You're using **Supabase PostgreSQL**, not Render's database. This is actually easier!

**Your Database:**
- Host: `aws-0-eu-west-1.pooler.supabase.com`
- Database: `postgres`
- Port: `5432`

---

## ✅ EASIEST METHOD: Use Supabase Dashboard

### Step 1: Go to Supabase

1. Open your browser
2. Go to: **https://supabase.com/dashboard**
3. Log in with your Supabase account

### Step 2: Find Your Project

1. You should see your projects listed
2. Look for the project with:
   - Connection string containing: `nppxqvgetyetnsiphehm`
   - Or just look for your Velontri project

3. **Click on the project** to open it

### Step 3: Open SQL Editor

1. On the left sidebar, click **"SQL Editor"** (looks like </> icon)
2. You'll see a SQL query editor

### Step 4: Run the Migration

1. Open the file: `user_follows_migration.sql` (should be open in Notepad)

2. **Copy ALL the SQL** from that file:
   - Press `Ctrl+A` (select all)
   - Press `Ctrl+C` (copy)

3. Go back to Supabase SQL Editor

4. **Paste the SQL** into the editor:
   - Click in the query area
   - Press `Ctrl+V` (paste)

5. **Click "Run"** button (usually in bottom right or top right)

6. Wait a few seconds

### Step 5: Verify Success

You should see success messages like:
```
Success. No rows returned
```

Or individual messages for each command executed.

**If you see errors:**
- Check if they say "already exists" - that's OK!
- Other errors - see troubleshooting below

---

## 🔧 ALTERNATIVE METHOD: Using a PostgreSQL Client

If you prefer using a database client like **pgAdmin**, **DBeaver**, or **TablePlus**:

### Connection Details:
```
Host:     aws-0-eu-west-1.pooler.supabase.com
Port:     5432
Database: postgres
Username: postgres.nppxqvgetyetnsiphehm
Password: Okewunmi123
SSL:      Required
```

### Steps:
1. Open your PostgreSQL client
2. Create a new connection with the details above
3. Connect to the database
4. Open `user_follows_migration.sql` 
5. Execute the SQL script

---

## ✅ Quick Test After Migration

In Supabase SQL Editor, run this query:

```sql
SELECT * FROM user_follows LIMIT 1;
```

**Expected result:**
```
No rows returned
```

This means the table exists but is empty (correct for a new table).

---

## 🐛 Troubleshooting

### Can't find Supabase project
- Check your email for Supabase sign-up confirmation
- The project might be under a different account
- Try going directly to: https://supabase.com/dashboard/projects

### "already exists" errors
- ✅ These are OK! Safe to ignore
- The migration is idempotent (can run multiple times)

### Connection timeout
- Your IP might not be whitelisted
- Go to Supabase project → Settings → Database → Connection pooling
- Check "Allow connections from anywhere" (not recommended for production but OK for now)

### Permission denied
- Make sure you're using the correct username and password
- The username includes the project reference: `postgres.nppxqvgetyetnsiphehm`

---

## 🎯 What's Next?

Once the migration succeeds:

1. **Push your code:**
   ```bash
   git add .
   git commit -m "feat: implement followers/following system"
   git push origin main
   ```

2. **Wait for Render to redeploy** (5-10 minutes)

3. **Test the feature:**
   - Visit: https://velontri.pxxl.click/users/search
   - Search and follow a user
   - Check: https://velontri.pxxl.click/dashboard/following
   - Check: https://velontri.pxxl.click/dashboard/followers

---

## 📸 Visual Guide - Supabase Dashboard

### What Supabase Looks Like:

1. **Dashboard Home:**
   ```
   ┌─────────────────────────────────────────┐
   │  Supabase                        [You]  │
   ├─────────────────────────────────────────┤
   │  Your Projects:                         │
   │                                         │
   │  📊 velontri-project                    │
   │     Active • PostgreSQL 15              │
   │     [Open] ← CLICK HERE                 │
   └─────────────────────────────────────────┘
   ```

2. **Project Page:**
   ```
   ┌─────────────────────────────────────────┐
   │  velontri-project                       │
   ├──────┬──────────────────────────────────┤
   │ Home │                                  │
   │ 🗄️ Table │                                  │
   │ </> SQL Editor │ ← CLICK HERE               │
   │ 🔐 Auth │                                  │
   │ 📊 Storage │                                │
   │ ⚙️ Settings │                               │
   └──────┴──────────────────────────────────┘
   ```

3. **SQL Editor:**
   ```
   ┌─────────────────────────────────────────┐
   │  SQL Editor                    [Run]    │
   ├─────────────────────────────────────────┤
   │                                         │
   │  -- Paste your SQL here                │
   │  CREATE TABLE IF NOT EXISTS...          │
   │                                         │
   │  ↑ PASTE ALL SQL HERE                   │
   │                                         │
   └─────────────────────────────────────────┘
   ```

---

## 💡 Pro Tip

Supabase also has a **Table Editor** where you can visually see your tables after the migration runs. After running the SQL:

1. Click **"Table Editor"** in left sidebar
2. Look for `user_follows` in the table list
3. You should see it there (empty at first)

---

## 🎉 Done!

That's it! The migration is much simpler with Supabase because you have direct access to the SQL editor in their dashboard.

**Summary:**
1. Go to https://supabase.com/dashboard
2. Open your project
3. Click "SQL Editor"
4. Paste `user_follows_migration.sql` 
5. Click "Run"
6. Deploy your code!
