╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║  🚨 URGENT: Frontend Showing "0 Active Listings"             ║
║                                                               ║
║  PROBLEM: Frontend built with wrong API URL (localhost)      ║
║  SOLUTION: Rebuild with production API URL                   ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝

QUICK FIX (3 Steps):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1️⃣  RUN THE DEPLOYMENT SCRIPT
   Open PowerShell in this directory and run:
   
   .\deploy.ps1
   
   This will:
   • Clean the build cache
   • Set production environment variables
   • Build the frontend with correct API URL
   • Commit and push to Git

2️⃣  WAIT FOR AUTO-DEPLOYMENT (3-5 minutes)
   pxxl.click will automatically deploy from Git

3️⃣  VERIFY IT WORKS
   Open PowerShell and run:
   
   .\verify-deployment.ps1
   
   Then visit: https://velontri.pxxl.click
   You should now see all 6 listings!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

WHAT CHANGED:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✓ Updated pxxl.toml with production environment variables
✓ Created .env.production for Next.js
✓ Created deployment scripts for easy future deploys

FILES CREATED:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📄 DEPLOYMENT_FIX.md          - Complete explanation of the issue
📄 FRONTEND_DEPLOY.md          - Full deployment guide
📄 frontend/.env.production    - Production environment config
📄 deploy.ps1                  - Automated deployment script
📄 verify-deployment.ps1       - Verification script
📄 pxxl.toml (updated)         - Added [env] section

MANUAL ALTERNATIVE:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

If you prefer to deploy manually:

cd frontend
Remove-Item -Recurse -Force .next
$env:NEXT_PUBLIC_API_URL="https://velontri.onrender.com/api/v1"
npm run build
cd ..
git add .
git commit -m "fix: rebuild with production API URL"
git push origin main

VERIFICATION:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

After deployment, open browser DevTools:
1. Go to https://velontri.pxxl.click
2. Press F12 → Network tab
3. Look for requests to: velontri.onrender.com/api/v1/listings
4. Should see 6 listings in the response

BACKEND STATUS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Backend is working perfectly!
   API: https://velontri.onrender.com/api/v1
   Health: https://velontri.onrender.com/health
   Returns 6 listings correctly

NEED HELP?
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Read: DEPLOYMENT_FIX.md for detailed explanation
Read: FRONTEND_DEPLOY.md for deployment options

╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║  Ready to fix? Run: .\deploy.ps1                             ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
