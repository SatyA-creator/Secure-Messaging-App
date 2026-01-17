# 🔍 Login Issue Diagnostic Guide

## Problem: Login Loading Indefinitely on Vercel

### Quick Diagnosis Steps

#### 1. Open Browser Console (F12)
Look for errors in the Console tab. Common errors:

**CORS Error:**
```
Access to fetch at 'https://...' from origin 'https://...' has been blocked by CORS policy
```
→ **Fix**: Update Render backend CORS settings (see below)

**Network Error:**
```
Failed to fetch
TypeError: Failed to fetch
```
→ **Fix**: Backend is down or unreachable

**Timeout Error:**
```
Request timed out
```
→ **Fix**: Backend is sleeping (Render free tier) or database connection issue

#### 2. Check Network Tab
1. Open Network tab in DevTools
2. Try to login
3. Look for the request to `/auth/login`
4. Check:
   - **Status**: Should be 200 (success) or 401 (wrong credentials)
   - **Response**: Should have JSON with `access_token`
   - **Time**: Should complete in < 5 seconds

#### 3. Test Backend Directly
Open a new tab and visit:
```
https://secure-messaging-app-backend.onrender.com/health
```

**Expected Response:**
```json
{
  "status": "healthy",
  "environment": "production",
  "database": "connected"
}
```

**If you get an error or timeout:**
- Backend is down or sleeping
- Go to Render dashboard and check logs
- May need to wait 30-60 seconds for backend to wake up

## Common Fixes

### Fix 1: Update Render Environment Variables

1. Go to https://dashboard.render.com/
2. Select your backend service
3. Go to **Environment** tab
4. Add/Update these variables:

```bash
# CRITICAL: Add your Vercel URL
CORS_ORIGINS=https://secure-messaging-app-omega.vercel.app
ENVIRONMENT=production

# Database (use port 5432, not 6543)
DATABASE_URL=postgresql://postgres.ycnilziiknmahekkpveg:Secure%40123@aws-1-ap-south-1.pooler.supabase.com:5432/postgres
DATABASE_POOL_SIZE=5
DATABASE_MAX_OVERFLOW=10
```

5. Click **Save Changes**
6. Click **Manual Deploy** to redeploy

### Fix 2: Verify Vercel Environment Variables

1. Go to https://vercel.com/dashboard
2. Select your project
3. Go to **Settings** → **Environment Variables**
4. Verify these exist:

```bash
VITE_API_URL=https://secure-messaging-app-backend.onrender.com/api/v1
VITE_WS_URL=wss://secure-messaging-app-backend.onrender.com
```

5. If missing or wrong, add/update them
6. **Redeploy** your Vercel app

### Fix 3: Test API from Browser Console

On your Vercel app, open console and run:

```javascript
// Test 1: Check if backend is reachable
fetch('https://secure-messaging-app-backend.onrender.com/health')
  .then(r => r.json())
  .then(d => console.log('✅ Backend reachable:', d))
  .catch(e => console.error('❌ Backend error:', e));

// Test 2: Check environment variables
console.log('API URL:', import.meta.env.VITE_API_URL);
console.log('WS URL:', import.meta.env.VITE_WS_URL);

// Test 3: Try login (replace with your credentials)
fetch('https://secure-messaging-app-backend.onrender.com/api/v1/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'your@email.com', password: 'yourpassword' })
})
  .then(r => r.json())
  .then(d => console.log('✅ Login response:', d))
  .catch(e => console.error('❌ Login error:', e));
```

### Fix 4: Handle Render Free Tier Sleep

Render free tier backends sleep after 15 minutes of inactivity. First request takes 30-60 seconds to wake up.

**Solutions:**
1. **Wait**: First login may take 30-60 seconds
2. **Keep-alive service**: Use a service like UptimeRobot to ping your backend every 5 minutes
3. **Upgrade**: Upgrade to Render paid plan ($7/month)

### Fix 5: Check Render Logs

1. Go to Render dashboard
2. Click your backend service
3. Go to **Logs** tab
4. Look for errors when you try to login

**Common log errors:**

**Database timeout:**
```
connection to server at "..." failed: timeout expired
```
→ Fix: Change DATABASE_URL port from 6543 to 5432

**CORS blocked:**
```
Origin not allowed
```
→ Fix: Add your Vercel URL to CORS_ORIGINS

**No logs appearing:**
→ Backend is sleeping, wait 30-60 seconds

## Step-by-Step Troubleshooting

### Step 1: Verify Backend is Running
```bash
curl https://secure-messaging-app-backend.onrender.com/health
```

**If this fails:**
- Backend is down
- Check Render dashboard
- Check Render logs
- May need to redeploy

### Step 2: Test Login API Directly
```bash
curl -X POST https://secure-messaging-app-backend.onrender.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"your@email.com","password":"yourpassword"}'
```

**Expected response:**
```json
{
  "access_token": "eyJ...",
  "token_type": "bearer",
  "user": {...}
}
```

**If this works but Vercel doesn't:**
- CORS issue
- Check browser console for CORS errors
- Update CORS_ORIGINS in Render

### Step 3: Check Frontend Environment
On Vercel app, open console:
```javascript
console.log('Environment:', {
  API_URL: import.meta.env.VITE_API_URL,
  WS_URL: import.meta.env.VITE_WS_URL,
  MODE: import.meta.env.MODE,
  PROD: import.meta.env.PROD
});
```

**Should show:**
```javascript
{
  API_URL: "https://secure-messaging-app-backend.onrender.com/api/v1",
  WS_URL: "wss://secure-messaging-app-backend.onrender.com",
  MODE: "production",
  PROD: true
}
```

**If undefined:**
- Environment variables not set in Vercel
- Need to redeploy after setting them

## Quick Fix Checklist

- [ ] Backend health check passes
- [ ] Render CORS_ORIGINS includes Vercel URL
- [ ] Render DATABASE_URL uses port 5432
- [ ] Vercel VITE_API_URL is set correctly
- [ ] Vercel VITE_WS_URL is set correctly
- [ ] Both services redeployed after changes
- [ ] Browser console shows no CORS errors
- [ ] Network tab shows request completing
- [ ] Waited 60 seconds for backend to wake up

## Still Not Working?

### Check These:

1. **Render Service Status**
   - Is it "Live" in dashboard?
   - Any recent deploy failures?
   - Check "Events" tab for issues

2. **Supabase Database**
   - Is database accessible?
   - Check Supabase dashboard
   - Verify connection string

3. **Browser Cache**
   - Clear browser cache
   - Try incognito/private mode
   - Try different browser

4. **Credentials**
   - Are you using correct email/password?
   - Try registering a new account first
   - Check if user exists in database

## Emergency Fallback

If nothing works, you can temporarily test with demo users:

The frontend has fallback demo users:
- Email: `alice@secure.chat`
- Password: `demo123`

This will work even if backend is down (for testing only).

## Get Help

If still stuck, provide these details:
1. Browser console errors (screenshot)
2. Network tab for /auth/login request (screenshot)
3. Render backend logs (last 50 lines)
4. Vercel deployment URL
5. What you see when visiting backend /health endpoint
