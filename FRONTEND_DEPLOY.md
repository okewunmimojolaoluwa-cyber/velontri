# Velontri Frontend — Deployment Guide

## Problem: Frontend showing "0 Active Listings"

The frontend at `https://velontri.pxxl.click` is showing 0 listings even though the API returns 6 listings. This happens because:

1. **Build-time environment variables**: Next.js bakes `NEXT_PUBLIC_*` variables into the build at build time
2. **Cached builds**: The deployed frontend was built with the wrong API URL (likely `localhost`)
3. **Solution**: Rebuild and redeploy with production environment variables

## Quick Fix (For PXXL/Render Deployment)

### Step 1: Set Environment Variables

If deploying on **pxxl.click** or **Render**, set these environment variables in your deployment dashboard:

```bash
NEXT_PUBLIC_API_URL=https://velontri.onrender.com/api/v1
NEXT_PUBLIC_SITE_URL=https://velontri.pxxl.click
NEXT_PUBLIC_GOOGLE_CLIENT_ID=99339393476-c77uoti2pa2thldagm4fkrmslhg1ggnr.apps.googleusercontent.com
NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=pk_test_51d83fe69d0b2dc3483cb85f3599be0a1ac22a5d
```

### Step 2: Clear Build Cache & Redeploy

**Important**: You must clear the build cache and rebuild:

```bash
# On your deployment platform (Render/Vercel/pxxl):
# 1. Trigger a manual redeploy
# 2. Enable "Clear build cache" option
# OR locally build and push:

cd frontend
rm -rf .next
npm run build
# Then commit and push to trigger deployment
```

### Step 3: Verify After Deployment

Visit `https://velontri.pxxl.click` and check:
- Browser DevTools → Network tab
- Look for requests to `https://velontri.onrender.com/api/v1/listings`
- Should see 6 listings in the response

## Deployment Platforms

### Option 1: Deploy to Vercel (Recommended)

1. **Push to GitHub**:
   ```bash
   git add .
   git commit -m "feat: add production environment config"
   git push origin main
   ```

2. **Import on Vercel**:
   - Go to [vercel.com/new](https://vercel.com/new)
   - Import your repository
   - Root Directory: `frontend`
   - Framework: Next.js (auto-detected)

3. **Set Environment Variables** (Vercel Dashboard → Project → Settings → Environment Variables):
   ```
   NEXT_PUBLIC_API_URL=https://velontri.onrender.com/api/v1
   NEXT_PUBLIC_SITE_URL=https://velontri.pxxl.click
   NEXT_PUBLIC_GOOGLE_CLIENT_ID=99339393476-c77uoti2pa2thldagm4fkrmslhg1ggnr.apps.googleusercontent.com
   NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=pk_test_51d83fe69d0b2dc3483cb85f3599be0a1ac22a5d
   ```

4. **Deploy**: Vercel will auto-deploy on every push to main

5. **Custom Domain** (Optional):
   - Vercel Dashboard → Project → Settings → Domains
   - Add `velontri.pxxl.click`
   - Update DNS CNAME: `velontri.pxxl.click` → `cname.vercel-dns.com`

### Option 2: Deploy to Render Static Site

1. **Create Static Site**:
   - Go to [dashboard.render.com](https://dashboard.render.com)
   - New → Static Site
   - Connect your repository
   - Root Directory: `frontend`
   - Build Command: `npm install && npm run build`
   - Publish Directory: `.next`

2. **Set Environment Variables**:
   ```
   NEXT_PUBLIC_API_URL=https://velontri.onrender.com/api/v1
   NEXT_PUBLIC_SITE_URL=https://velontri.pxxl.click
   NEXT_PUBLIC_GOOGLE_CLIENT_ID=99339393476-c77uoti2pa2thldagm4fkrmslhg1ggnr.apps.googleusercontent.com
   NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=pk_test_51d83fe69d0b2dc3483cb85f3599be0a1ac22a5d
   ```

3. **Deploy**: Render will build and deploy

### Option 3: Current PXXL Deployment

If you're already deployed on `pxxl.click` through a different service:

1. **Locate your deployment dashboard**
2. **Set environment variables** (see above)
3. **Clear build cache** (critical!)
4. **Trigger manual redeploy**

## Verification Checklist

After deployment, verify these:

### 1. API URL is Correct
Open browser DevTools → Console:
```javascript
console.log(process.env.NEXT_PUBLIC_API_URL)
// Should show: https://velontri.onrender.com/api/v1
```

### 2. API is Reachable
```bash
curl https://velontri.onrender.com/api/v1/listings?page=1&page_size=12
# Should return JSON with 6 listings
```

### 3. CORS is Configured
Check backend CORS includes your frontend:
```bash
# Backend should allow: https://velontri.pxxl.click
# This is already configured in backend/shared/middleware.py
```

### 4. Frontend Makes Requests
- Visit `https://velontri.pxxl.click`
- Open DevTools → Network
- Should see: `GET https://velontri.onrender.com/api/v1/listings?page=1&page_size=12`
- Response should show `"total": 6`

## Common Issues

### Issue: Still showing localhost URLs
**Cause**: Build cache not cleared
**Fix**: Clear `.next` folder and rebuild:
```bash
cd frontend
rm -rf .next
npm run build
```

### Issue: CORS errors in browser
**Cause**: Backend doesn't allow frontend domain
**Fix**: Already configured in `backend/shared/middleware.py`. If needed, add to `ALLOWED_ORIGINS` env var on backend Render service

### Issue: 404 on API requests
**Cause**: Wrong API URL
**Fix**: Double-check environment variables are set correctly in deployment dashboard

### Issue: Environment variables not updating
**Cause**: Next.js bakes variables at build time
**Fix**: You MUST rebuild after changing `NEXT_PUBLIC_*` variables. Restarting alone won't work.

## Manual Build & Test Locally

To test the production build locally:

```bash
cd frontend

# Set production env
export NEXT_PUBLIC_API_URL=https://velontri.onrender.com/api/v1
export NEXT_PUBLIC_SITE_URL=https://velontri.pxxl.click

# Build
npm run build

# Start production server
npm start

# Visit http://localhost:3000
# Should now fetch from production API
```

## Next Steps

1. **Deploy frontend** using one of the options above
2. **Set environment variables** in deployment dashboard
3. **Clear build cache** and redeploy
4. **Verify** at `https://velontri.pxxl.click`
5. **Update backend CORS** if using a different domain

## Support

If issues persist:
1. Check browser DevTools → Console for errors
2. Check browser DevTools → Network → Filter "listings"
3. Verify API URL in console: `window.location` vs `NEXT_PUBLIC_API_URL`
4. Check backend logs on Render dashboard
