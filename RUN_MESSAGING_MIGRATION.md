# 🚀 Quick Guide: Run Messaging Migration

## ⚠️ IMPORTANT - READ FIRST

The messaging fix code is deployed, but **you must run the migration script** to consolidate existing duplicate threads in your database.

---

## Prerequisites

1. ✅ Code changes deployed (commit 889d1f1)
2. ⚠️ Database migration NOT yet run
3. 📦 Required: Python with asyncio, sqlalchemy, asyncpg

---

## Step-by-Step Instructions

### 1. Backup Your Database (CRITICAL)

```bash
# PostgreSQL backup
pg_dump -h your_host -U your_user -d velontri > backup_$(date +%Y%m%d_%H%M%S).sql

# Or using Supabase dashboard: Project Settings → Database → Backups
```

### 2. Get Your Production Database URL

```bash
# Find in your .env or production environment
# Format: postgresql+asyncpg://user:password@host:port/database

# For Supabase, format is:
# postgresql+asyncpg://postgres.PROJECT_REF:PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres
```

### 3. Run the Migration Script

```bash
# Navigate to backend directory
cd backend

# Set database URL (replace with your actual URL)
export DATABASE_URL="postgresql+asyncpg://postgres:password@host:port/velontri"

# Run migration
python scripts/consolidate_duplicate_threads.py

# Press Enter when prompted to continue
```

### 4. Expected Output

```
================================================================================
THREAD CONSOLIDATION MIGRATION
================================================================================

This script will:
  1. Find all duplicate threads (same users, different listings)
  2. Keep the oldest thread for each user pair
  3. Migrate all messages to the kept thread
  4. Delete duplicate threads
  5. Update database constraint to prevent future duplicates

Press Ctrl+C now to cancel, or Enter to continue...

================================================================================
STEP 1: Find duplicate threads
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

================================================================================
STEP 2: Update database constraint
================================================================================

→ Dropping old constraint 'uq_thread_participants'...
  ✓ Old constraint dropped

→ Creating new constraint 'uq_thread_participants' on (participant_a, participant_b)...
  ✓ New constraint created successfully!

================================================================================
FINAL VERIFICATION
================================================================================

✓ SUCCESS! All user pairs now have exactly ONE thread

Final counts:
  • Total threads: 150
  • Total messages: 1,245
================================================================================

✓ Migration complete!
```

### 5. Verify Success

```bash
# Check for remaining duplicates (should return 0 rows)
psql $DATABASE_URL -c "
SELECT participant_a, participant_b, COUNT(*) as count
FROM threads
GROUP BY participant_a, participant_b
HAVING COUNT(*) > 1;
"

# Should show: (0 rows)
```

---

## What If Something Goes Wrong?

### Restore from Backup

```bash
# PostgreSQL restore
psql $DATABASE_URL < backup_YYYYMMDD_HHMMSS.sql

# Or using Supabase: Project Settings → Database → Backups → Restore
```

### Common Issues

#### Issue: "Cannot connect to database"
**Fix**: Check your DATABASE_URL is correct and database is accessible

#### Issue: "Permission denied"
**Fix**: Ensure your database user has ALTER TABLE permissions

#### Issue: "Constraint already exists"
**Fix**: The migration is idempotent - it checks and handles this. Safe to continue.

#### Issue: Script hangs or takes too long
**Fix**: 
- Check how many duplicate threads exist first
- Large datasets may take several minutes
- Monitor database logs for progress

---

## After Migration - Verify in Production

### Test Scenarios

1. **Test New Messages**:
   - User A messages User B about Listing 1
   - User A messages User B about Listing 2
   - ✅ Verify: Both in SAME conversation

2. **Test Existing Threads**:
   - Open any conversation
   - ✅ Verify: All historical messages visible
   - ✅ Verify: No duplicate conversations

3. **Test Input Focus**:
   - Open a conversation
   - Start typing in textarea
   - ✅ Verify: Focus stays in textarea, no interruption

### SQL Verification Queries

```sql
-- Count total threads
SELECT COUNT(*) FROM threads;

-- Check for duplicates (should be 0)
SELECT participant_a, participant_b, COUNT(*) 
FROM threads 
GROUP BY participant_a, participant_b 
HAVING COUNT(*) > 1;

-- View thread distribution
SELECT 
  participant_a,
  participant_b,
  COUNT(m.id) as message_count,
  MAX(m.created_at) as last_message_at
FROM threads t
LEFT JOIN messages m ON m.thread_id = t.id
GROUP BY t.id, t.participant_a, t.participant_b
ORDER BY last_message_at DESC
LIMIT 20;
```

---

## Rollback Plan (If Needed)

If you need to rollback the changes:

1. **Restore database from backup**
2. **Revert code changes**:
   ```bash
   git revert 889d1f1
   git revert d927317
   git push origin main
   ```

3. **Redeploy old code**

---

## Timeline

- ✅ **Code Deployed**: September 18, 2026 (commits d927317, 889d1f1)
- ⚠️ **Migration Pending**: Run at your convenience (safe, preserves all data)
- 🎯 **Recommended**: Run migration within 24-48 hours to clean up duplicates

---

## Need Help?

### Before Running Migration
- Read `MESSAGING_ONE_CONVERSATION_FIX.md` for technical details
- Review `backend/scripts/consolidate_duplicate_threads.py` script
- Ensure database backup exists

### During Migration
- Monitor script output
- Check database logs
- Keep terminal open until completion

### After Migration
- Test messaging feature thoroughly
- Verify no errors in production logs
- Check user feedback

---

## Quick Commands Summary

```bash
# 1. Backup database
pg_dump -h host -U user -d velontri > backup.sql

# 2. Set database URL
export DATABASE_URL="postgresql+asyncpg://user:pass@host:port/velontri"

# 3. Run migration
cd backend
python scripts/consolidate_duplicate_threads.py

# 4. Verify success
psql $DATABASE_URL -c "SELECT COUNT(*) FROM threads;"
psql $DATABASE_URL -c "SELECT COUNT(*) FROM messages;"

# 5. Test in browser
# Open messaging feature and verify ONE conversation per user pair
```

---

**Status**: ⚠️ **ACTION REQUIRED** - Run migration script  
**Priority**: Medium (run within 24-48 hours)  
**Risk**: Low (migration is safe, tested, and preserves all data)  
**Impact**: High (cleaner database, better UX, no more duplicate threads)

---

**Questions?** Review the detailed documentation in `MESSAGING_ONE_CONVERSATION_FIX.md`
