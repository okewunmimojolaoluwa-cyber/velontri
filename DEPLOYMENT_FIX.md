# Fix: Frontend Showing "0 Active Listings"

## Problem Summary

**Symptom**: The homepage at `https://velontri.pxxl.click` shows "0 Active Listings" even though the API returns 6 listings.

**Root Cause**: The frontend was built with the wrong API URL (localhost instead of production).

## Why This Happened

Next.js environment variables prefixed with `NEXT_PUBLIC_` are **baked into the build at build time**, not runtime. When the frontend was built, it used:
- `NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1` (from `.env.local`)

Instead of:
- `NEXT_PUBLIC_API_URL=https://velontri.onrender.com/api/v1` (production)

This means the deployed frontend is trying to fetch listings from `localhost` (which doesn't exist on the user's browser), instead of the production API.

## Solution

### Quick Fix (For Immediate Resolution)

1. **Update `pxxl.toml`** (Already done ✓):
   ```toml
   [env]
   NEXT_PUBLIC_API_URL = "https://velontri.onrender.com/api/v1"
   NEXT_PUBLIC_SITE_URL = "https://velontri.pxxl.click"
   ```

2. **Rebuild and Deploy**:
   ```powershell
   # Windows PowerShell
   .\deploy.ps1
   
   # Or manually:
   cd frontend
   Remove-Item -Recurse -Force .next
   npm run build
   cd ..
   git add .
   git commit -m "fix: rebuild frontend with production API URL"
   git push origin main
   ```

3. **Wait for pxxl auto-deployment** (usually 2-3 minutes)

4. **Verify**:
   ```powershell
   .\verify-deployment.ps1
   ```

### Understanding the Files

**Files Created**:
1. **`frontend/.env.production`** - Production environment variables (used during build)
2. **`pxxl.toml`** - Updated with `[env]` section for pxxl deployment
3. **`FRONTEND_DEPLOY.md`** - Complete deployment guide
4. **`deploy.ps1`** - Automated deployment script
5. **`verify-deployment.ps1`** - Verification script

## Verification Steps

After deployment, check these:

### 1. Browser DevTools
1. Open `https://velontri.pxxl.click`
2. Press F12 (DevTools)
3. Go to **Network** tab
4. Refresh page
5. Filter by "listings"
6. Click on the listings request
7. **Expected**: Request URL should be `https://velontri.onrender.com/api/v1/listings`
8. **Expected**: Response should show `"total": 6`

### 2. Console Check
In the browser console, type:
```javascript
// Check API URL
console.log(window.location.href)
// Should show: https://velontri.pxxl.click

// The built API URL is not accessible directly, but you can see it in Network requests
```

### 3. API Direct Test
```powershell
# Test API directly
curl https://velontri.onrender.com/api/v1/listings?page=1&page_size=12

# Should return JSON with:
# "data": [...6 listings...],
# "meta": { "total": 6, ... }
```

## Why This Solution Works

1. **`pxxl.toml` [env] section**: Sets environment variables **before** the build
2. **`.env.production`**: Next.js automatically loads this during production builds
3. **Clean build**: Removes cached `.next` folder to force fresh build
4. **Push to Git**: Triggers pxxl auto-deployment with correct config

## Common Issues

### Issue 1: Still showing localhost URLs
**Cause**: Build cache not cleared
**Fix**: 
```powershell
cd frontend
Remove-Item -Recurse -Force .next
npm run build
```

### Issue 2: Environment variables not updating
**Cause**: pxxl might be caching the build
**Fix**: 
1. Check pxxl dashboard for build logs
2. Ensure `pxxl.toml` has the `[env]` section
3. Try force-pushing:
   ```bash
   git commit --allow-empty -m "trigger rebuild"
   git push origin main
   ```

### Issue 3: CORS errors
**Cause**: Backend not allowing frontend domain
**Fix**: Already configured in `backend/shared/middleware.py`. The backend allows:
- `https://velontri.pxxl.click`
- `https://velontri.onrender.com`
- And others via regex pattern

### Issue 4: 404 on API requests
**Cause**: API URL typo or backend is down
**Fix**: 
1. Check backend health: `https://velontri.onrender.com/health`
2. Verify API URL in `pxxl.toml` matches exactly
3. Check Render backend logs for errors

## Backend Status

✅ **Backend is working correctly**:
- Deployed at: `https://velontri.onrender.com`
- Health check: `https://velontri.onrender.com/health`
- API docs: `https://velontri.onrender.com/docs`
- Listings endpoint returns 6 items: `https://velontri.onrender.com/api/v1/listings`

## Frontend Status

⚠️ **Frontend needs rebuild** (this fix addresses it):
- Deployed at: `https://velontri.pxxl.click`
- Currently built with wrong API URL
- After deploying this fix, will fetch from production API

## Timeline to Fix

1. **Immediate** (0 min): Update `pxxl.toml` ✓ (Already done)
2. **2 min**: Run `.\deploy.ps1` to build and push
3. **3 min**: pxxl auto-deploys from Git
4. **5 min**: Frontend live with correct API URL
5. **Verify**: Run `.\verify-deployment.ps1`

## Prevention for Future

To avoid this in the future:

1. **Always use environment-specific builds**:
   - Local dev: Use `.env.local`
   - Production: Use `.env.production` or `pxxl.toml [env]`

2. **Never commit `.env.local`** with production URLs

3. **Verify after deployment**:
   ```powershell
   .\verify-deployment.ps1
   ```

4. **Check DevTools Network tab** to confirm API URL

## Support

If the issue persists after following this guide:

1. **Check build logs** in pxxl dashboard
2. **Verify environment variables** are set in `pxxl.toml`
3. **Clear browser cache** (Ctrl+Shift+Delete)
4. **Hard refresh** (Ctrl+Shift+R)
5. **Check backend logs** in Render dashboard

## Next Steps

Run the deployment script now:
```powershell
.\deploy.ps1
```

This will:
✓ Clean the build cache
✓ Set production environment
✓ Build the frontend
✓ Commit and push to Git
✓ Trigger pxxl auto-deployment

After deployment (3-5 minutes), visit `https://velontri.pxxl.click` and you should see the 6 listings!
