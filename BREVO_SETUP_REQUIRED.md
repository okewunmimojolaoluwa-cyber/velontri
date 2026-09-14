# ⚠️ BREVO SETUP REQUIRED - IP Whitelisting

## Issue Detected

Your Brevo API requires IP whitelisting. You need to authorize your server's IP address before emails can be sent.

## Current Status

- ✅ BREVO_API_KEY is configured
- ❌ Current IP (105.113.18.105) is not authorized

## How to Fix

### Step 1: Add Your IP to Brevo

1. **Login to Brevo**: https://app.brevo.com/
2. **Go to Security Settings**: https://app.brevo.com/security/authorised_ips
3. **Click "Add IP Address"**
4. **Add these IPs**:
   - Your current IP: `105.113.18.105`
   - Your production server IP (get from Render/your hosting)
   - Or use `0.0.0.0/0` to allow all IPs (less secure but easier)

### Step 2: Get Production Server IP

If deploying to **Render.com**:
1. Go to your Render dashboard
2. Select your backend service
3. Look for "Outbound IPs" or similar
4. Add all listed IPs to Brevo

If deploying to other platforms:
```bash
# SSH into your server
curl https://api.ipify.org

# Add the returned IP to Brevo
```

### Step 3: Test Again

After adding IPs:
```bash
python test_email_simple.py
```

Should see: ✅ Email sent successfully!

---

## Alternative: Disable IP Whitelisting

If you want to allow emails from any IP (less secure):

1. Go to: https://app.brevo.com/security/authorised_ips
2. Add IP range: `0.0.0.0/0`
3. Save

⚠️ **Security Note**: This allows API access from anywhere. Only use for testing.

---

## Verification

After setup, verify:

1. ✅ Test email sends without 401 error
2. ✅ Email arrives in Gmail inbox
3. ✅ Email has correct branding
4. ✅ Action button works

---

## Production Deployment

Once IP whitelisting is configured:

1. **Deploy backend**:
   ```bash
   git push origin main
   ```

2. **Add production IPs** to Brevo (if different from test)

3. **Test in production**:
   - Follow a user
   - Create a listing
   - Send a message
   - Check Gmail for emails

---

## Troubleshooting

### Still Getting 401 Error?

- Check IP is exactly as shown in error message
- Wait 2-3 minutes after adding IP
- Try refreshing API key if needed

### Emails Going to Spam?

- Verify domain in Brevo
- Add SPF record to DNS
- Add DKIM record to DNS
- Ask users to whitelist your email

### Need Help?

Check Brevo documentation: https://help.brevo.com/

---

**Status**: ⚠️ ACTION REQUIRED  
**Next Step**: Add IPs to Brevo authorized list  
**Then**: Run `python test_email_simple.py` again
