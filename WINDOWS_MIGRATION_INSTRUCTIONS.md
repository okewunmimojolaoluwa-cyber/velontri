# 🪟 Windows Migration Instructions - Thread Consolidation

## Quick Start for Windows Users

You're on Windows, so use this simplified guide instead of the Linux instructions.

---

## Step 1: Navigate to Backend Directory

```powershell
cd C:\Users\USER PC\Desktop\velontri\backend
```

---

## Step 2: Run the Migration Script

```powershell
.\run-thread-migration.ps1
```

---

## Step 3: Confirm When Prompted

The script will ask you to type **YES** to confirm. This is a safety check.

```
Type 'YES' to continue or 'NO' to cancel: YES
```

---

## Expected Output

```
================================================================================
THREAD CONSOLIDATION MIGRATION
================================================================================

Found 5 user pairs with duplicate threads

→ User pair abc123 <-> def456: 3 threads
  ├─ Keeping thread: xyz789 (created 2024-01-01)
  └─ Removing 2 duplicate threads
    → Migrating 12 messages from old-thread-1 to xyz789
    → Migrating 8 messages from old-thread-2 to xyz789

✓ Consolidation complete!
  • Removed 10 duplicate threads
  • Migrated 45 messages

✓ SUCCESS! All user pairs now have exactly ONE thread
```

---

## That's It!

The script automatically:
- ✅ Uses your production database URL from `.env`
- ✅ Consolidates duplicate threads
- ✅ Migrates all messages
- ✅ Updates database constraints
- ✅ Verifies success

---

## Troubleshooting

### Error: "python: command not found"

Install Python from https://www.python.org/downloads/

### Error: "Cannot connect to database"

1. Check your internet connection
2. Verify `.env` file has correct `DATABASE_URL`
3. Ensure Supabase database is accessible

### Error: "Module not found: asyncpg"

Install required packages:
```powershell
cd backend
pip install -r requirements.txt
```

---

## After Migration

Test the messaging feature:
1. Open your app at https://velontri.vercel.app
2. Log in and go to Messages
3. Send a message to another user
4. Verify ONE conversation per user

---

**You're all set!** The migration will ensure every user pair has exactly ONE conversation thread.
