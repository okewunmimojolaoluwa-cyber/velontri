# 🎯 Run Database Migration - Complete Step-by-Step Guide

## Overview
You need to run some SQL code on your PostgreSQL database. This guide shows you **exactly** how to do it using the Render Dashboard.

**Time Required:** 5-10 minutes  
**Difficulty:** Easy (just copy and paste!)

---

## 📋 STEP 1: Open the SQL File

1. On your computer, navigate to:
   ```
   C:\Users\USER PC\Desktop\velontri\
   ```

2. Find the file named: **`user_follows_migration.sql`**

3. Right-click on it and select **"Open with" → "Notepad"** (or any text editor)

4. **DO NOT CLOSE THIS FILE** - you'll need it in Step 5

---

## 🌐 STEP 2: Go to Render Dashboard

1. Open your web browser (Chrome, Edge, Firefox, etc.)

2. Type this URL in the address bar:
   ```
   https://dashboard.render.com
   ```

3. Press **Enter**

4. You should see the Render login page
   - If already logged in, you'll see your dashboard
   - If not logged in, enter your email and password

---

## 🐘 STEP 3: Find Your PostgreSQL Database

Once you're on the Render Dashboard, you'll see a list of your services.

**Look for the DATABASE service:**

1. Look for a service with:
   - **Name**: Something like `velontri-postgres`, `postgres-db`, or similar
   - **Type**: "PostgreSQL" (sometimes shown with an elephant icon 🐘)
   - **Status**: Should show "Available" in green

2. **IMPORTANT**: 
   - ✅ Click on the **DATABASE** service (the one with PostgreSQL/elephant icon)
   - ❌ DO NOT click on the backend web service
   - ❌ DO NOT click on the frontend web service

3. **Click on the database service name** to open it

---

## 💻 STEP 4: Open the Database Shell

After clicking on your PostgreSQL database, you'll see the database details page.

**Find and click the "Shell" tab:**

1. At the top of the page, you'll see several tabs:
   ```
   [ Info ]  [ Metrics ]  [ Logs ]  [ Shell ]  [ Settings ]
   ```

2. **Click on the "Shell" tab** (might be the 4th tab)

3. You should now see a black or dark blue terminal window with a prompt that looks like:
   ```
   postgres=#
   ```
   or
   ```
   database_name=#
   ```

4. There should be a text input area where you can type or paste commands

---

## 📝 STEP 5: Copy the SQL Migration

1. Go back to the **`user_follows_migration.sql`** file you opened in Step 1

2. **Select ALL the text** in that file:
   - Press **Ctrl + A** (Windows) or **Cmd + A** (Mac)
   - Or click anywhere in the file, then use your mouse to select everything

3. **Copy the text**:
   - Press **Ctrl + C** (Windows) or **Cmd + C** (Mac)
   - Or right-click and select "Copy"

4. You've now copied the SQL commands to your clipboard

---

## ✨ STEP 6: Paste and Run the Migration

1. Go back to your browser with the Render Shell tab open

2. **Click inside the terminal/shell area** (where you see `postgres=#`)

3. **Paste the SQL code**:
   - Press **Ctrl + V** (Windows) or **Cmd + V** (Mac)
   - Or right-click and select "Paste"

4. You should now see a LOT of SQL code in the terminal

5. **Press the Enter key**

6. The migration will now run! This takes about 5-10 seconds

---

## ✅ STEP 7: Verify Success

After pressing Enter, you should see output like this:

```
CREATE TABLE
CREATE INDEX
CREATE INDEX
CREATE INDEX
DO
DO
CREATE FUNCTION
DROP TRIGGER
CREATE TRIGGER
```

**Success indicators:**
- ✅ You see "CREATE TABLE"
- ✅ You see multiple "CREATE INDEX"
- ✅ You see "CREATE FUNCTION"
- ✅ You see "CREATE TRIGGER"
- ✅ **NO ERROR messages** (no lines starting with "ERROR:")

**If you see errors:**
- See the "Troubleshooting" section below
- Most errors can be ignored if they say "already exists"

---

## 🧪 STEP 8: Test That It Worked (Optional)

Still in the Render Shell, type this command and press Enter:

```sql
SELECT * FROM user_follows LIMIT 1;
```

**Expected result:**
```
 id | follower_id | following_id | created_at
----+-------------+--------------+------------
(0 rows)
```

This means the table exists but is empty (which is correct for a new table).

**If you see an error** like "relation 'user_follows' does not exist", the migration didn't work. See Troubleshooting.

---

## 🎉 DONE! What's Next?

The database migration is complete! Now you can:

1. **Deploy the code** (the frontend and backend are already ready):
   ```bash
   git add .
   git commit -m "feat: implement followers/following system"
   git push origin main
   ```

2. **Test the feature** on your website:
   - Visit: `https://velontri.pxxl.click/users/search`
   - Search for a user
   - Click the "Follow" button
   - Check `/dashboard/following` to see who you follow
   - Check `/dashboard/followers` to see who follows you

---

## 🆘 Troubleshooting

### Problem: Can't find the PostgreSQL database

**Solution:**
- Look for any service with "postgres", "postgresql", or "database" in the name
- It should have a different icon than your web services
- Check the "Type" column - it should say "PostgreSQL"

### Problem: Don't see a "Shell" tab

**Solution:**
- Make sure you clicked on the DATABASE service, not a web service
- Web services don't have Shell tabs for databases
- The database should show "PostgreSQL" somewhere on the page

### Problem: Error says "already exists"

**Solution:**
- This is OK! It means the table was already created
- The migration is safe to run multiple times
- You can proceed to the next step

### Problem: Error says "permission denied"

**Solution:**
- You might not have the right permissions
- Contact your Render account owner
- Or try using the external connection method (see HOW_TO_RUN_MIGRATION.md)

### Problem: Can't paste into the Shell

**Solution:**
- Make sure you clicked inside the shell area first
- Try right-clicking and selecting "Paste"
- Try typing a single character first, then paste
- Some browsers block pasting - try a different browser

### Problem: Terminal shows nothing after pasting

**Solution:**
- The text might be there but not visible
- Just press Enter anyway
- Or try pasting in smaller chunks (copy 20 lines at a time)

### Problem: Lost the SQL file

**Solution:**
- It's at: `C:\Users\USER PC\Desktop\velontri\user_follows_migration.sql`
- You can also regenerate it by running the Python script

---

## 📞 Still Need Help?

If you're stuck:

1. **Check the SQL file** - make sure you copied ALL of it
2. **Try a different browser** - sometimes Chrome/Edge work better
3. **Read the error message carefully** - it often tells you what went wrong
4. **Try the alternative methods** in `HOW_TO_RUN_MIGRATION.md`

---

## 🎓 What You Just Did

You created a new database table called `user_follows` that stores who follows whom on Velontri. You also:

- Created indexes for fast queries
- Added trigger functions to auto-update follower counts
- Added columns to track follower/following counts on user profiles

The frontend code is already written and waiting for this database table. Once you push the code, the followers/following feature will be live!

---

**Next Steps After Migration:**
👉 See `QUICK_START.txt` for deployment instructions
👉 See `FOLLOWERS_FRONTEND_COMPLETE.md` for feature documentation
