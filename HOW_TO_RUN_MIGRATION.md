# How to Run the Followers/Following Migration

The migration creates the `user_follows` table and supporting infrastructure needed for the followers/following feature.

## ⚠️ IMPORTANT: Migration Must Run Before Testing

The frontend code is complete, but **will not work** until this migration runs on your database!

## 🎯 Quick Start (Recommended)

### Option 1: Run on Render Dashboard (Production)

**This is the easiest and recommended option for production:**

1. Go to https://dashboard.render.com
2. Click on your **PostgreSQL database** (not the backend service)
3. Click on the **"Shell"** tab at the top
4. Open the file `user_follows_migration.sql` in this directory
5. **Copy ALL the SQL** from that file
6. **Paste** into the Render Shell
7. Press **Enter** to execute
8. You should see success messages

### Option 2: Using PowerShell Script

Run this from the project root:

```powershell
.\run-migration.ps1
```

This will guide you through the options and show you the database URL.

### Option 3: Using psql (if installed)

```bash
# From project root
psql "your-database-url-here" -f user_follows_migration.sql
```

Get your database URL from `backend/.env` (the `DATABASE_URL` value).

### Option 4: Using pgAdmin or DBeaver

1. Open your PostgreSQL client
2. Connect to your database
3. Open `user_follows_migration.sql`
4. Execute it

## 📋 What the Migration Does

✅ Creates `user_follows` table with:
- Unique constraint (prevents duplicate follows)
- Check constraint (prevents self-follows)
- Cascading deletes (cleans up on user deletion)
- 3 indexes for fast queries

✅ Adds to `users` table:
- `followers_count` column
- `following_count` column

✅ Creates trigger function that:
- Auto-updates counts when someone follows/unfollows
- Uses `GREATEST()` to prevent negative counts

## ✅ Verify Migration Success

Run these queries to verify:

```sql
-- Check that table exists
SELECT * FROM user_follows LIMIT 1;

-- Check that columns were added
SELECT id, email, followers_count, following_count 
FROM users LIMIT 5;

-- Check that trigger exists
SELECT tgname FROM pg_trigger WHERE tgname = 'trg_update_follow_counts';
```

## 🧪 Test the Feature

After migration runs:

1. **Backend**: Deploy or restart your backend
   - The social router is already integrated
   - API endpoints: `/api/v1/users/{id}/follow`, etc.

2. **Frontend**: Deploy or restart your frontend
   - Navigate to `/dashboard/following`
   - Navigate to `/dashboard/followers`
   - Try searching users at `/users/search`

3. **Test Flow**:
   - Create two test accounts
   - Log in as User A
   - Search for User B
   - Click "Follow"
   - Log in as User B
   - Check `/dashboard/followers` - should see User A

## 🐛 Troubleshooting

### "table already exists"
This is fine! The migration uses `CREATE TABLE IF NOT EXISTS`, so it's safe to run multiple times.

### "column already exists"
Also fine! The script checks before adding columns.

### "permission denied"
Make sure you're using the correct database credentials with sufficient permissions.

### "relation 'users' does not exist"
Your database doesn't have the users table. Make sure you're connected to the correct database.

## 📁 Files Created

### Migration Files
- `user_follows_migration.sql` - The actual SQL migration (run this!)
- `run-migration.ps1` - PowerShell helper script
- `run_migration.py` - Python version (requires dependencies)

### Frontend Files (Already Created)
- `frontend/src/lib/api/endpoints/social.ts`
- `frontend/src/components/social/follow-button.tsx`
- `frontend/src/components/social/user-search.tsx`
- `frontend/src/app/dashboard/following/page.tsx` (replaced)
- `frontend/src/app/dashboard/followers/page.tsx` (new)
- `frontend/src/app/users/search/page.tsx` (new)

### Backend Files (Already Created)
- `backend/user-service/app/routers/social.py`
- `backend/scripts/create_user_follows_table.py`
- `frontend/src/types/social.ts`

## 🚀 After Migration

Once the migration runs successfully:

1. ✅ Commit and push your code:
   ```bash
   git add .
   git commit -m "feat: add followers/following system"
   git push
   ```

2. ✅ Verify deployment on Render

3. ✅ Test the feature:
   - Follow/unfollow users
   - Check follower counts update
   - Search for users
   - View followers/following pages

4. ✅ (Optional) Add remaining features:
   - Follow button on listing detail pages
   - "From Sellers You Follow" section on dashboard
   - Notification when followed users publish listings

## 📞 Need Help?

If the migration fails or you get errors:
1. Check the error message carefully
2. Verify you're connected to the correct database
3. Make sure the `users` table exists
4. Check database permissions
5. Try running queries one by one instead of the whole file

The migration is **safe to run multiple times** - it uses `IF NOT EXISTS` checks.
