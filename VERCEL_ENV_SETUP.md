# Vercel Environment Variables Setup

## ⚠️ CRITICAL: Backend CORS Configuration Required

**Before deploying to Vercel, you MUST update your Render backend environment variables:**

1. Go to Render Dashboard → Your Backend Service → Environment
2. Add/Update these variables:
   ```bash
   CORS_ORIGINS=https://secure-messaging-app-omega.vercel.app,https://*.vercel.app
   ENVIRONMENT=production
   ```
3. **Redeploy** your backend on Render
4. **Then** proceed with Vercel setup below

---

## Required Environment Variables for Vercel

Set these in your Vercel Dashboard → Project Settings → Environment Variables

### Production Environment

```
VITE_API_URL=https://secure-messaging-app-backend.onrender.com/api/v1
VITE_WS_URL=wss://secure-messaging-app-backend.onrender.com
```

## How to Set Them

1. Go to https://vercel.com/dashboard
2. Select your project: `secure-messaging-app`
3. Go to **Settings** → **Environment Variables**
4. Add each variable:
   - **Key**: `VITE_API_URL`
   - **Value**: `https://secure-messaging-app-backend.onrender.com/api/v1`
   - **Environments**: Production, Preview, Development (check all)
   
   - **Key**: `VITE_WS_URL`
   - **Value**: `wss://secure-messaging-app-backend.onrender.com`
   - **Environments**: Production, Preview, Development (check all)

5. **Redeploy** your application after setting the variables

## Verification Steps

### 1. Test Backend Accessibility

```bash
# Check if backend is running
curl https://secure-messaging-app-backend.onrender.com/health

# Expected response:
{"status":"healthy","environment":"production","database":"connected"}
```

### 2. Test CORS from Browser Console

On your Vercel app, open browser console and run:
```javascript
fetch('https://secure-messaging-app-backend.onrender.com/health')
  .then(r => r.json())
  .then(console.log)
  .catch(console.error)
```

If this works, CORS is configured correctly.

### 3. Check Login URL

After setting the environment variables and redeploying:

1. Open browser console on your Vercel app
2. The login URL should be: `https://secure-messaging-app-backend.onrender.com/api/v1/auth/login`
3. It should NOT have double `/api/v1/api/v1/...`

## Common Issues & Solutions

### "Failed to fetch" Error
**Cause**: Backend CORS not allowing your Vercel domain

**Solution**:
1. Check Render backend logs for CORS-related messages
2. Verify `CORS_ORIGINS` environment variable in Render includes your Vercel URL
3. Ensure backend code has been redeployed after updating CORS
4. Check if origin shows in backend logs: `📥 Incoming request from origin: https://...`

### CORS Errors
If you see CORS errors, verify that your Render backend has:
- `CORS_ORIGINS=https://secure-messaging-app-omega.vercel.app,https://*.vercel.app`
- `ENVIRONMENT=production`
- Backend has been **redeployed** after adding these variables

### Backend Sleeping (Render Free Tier)
**Symptom**: First request takes 30+ seconds or times out

**Solution**: 
- Render free tier backends sleep after inactivity
- First request wakes it up (takes ~30 seconds)
- Consider upgrading Render plan or using a keep-alive service

### Login Not Working
1. Check browser console for the actual URL being called
2. Verify backend is running: https://secure-messaging-app-backend.onrender.com/health
3. Check Render logs for any errors
4. Ensure Supabase database is accessible from Render

## Deployment Checklist

- [ ] Backend CORS_ORIGINS updated in Render
- [ ] Backend redeployed on Render
- [ ] Backend health check passes
- [ ] VITE_API_URL set in Vercel (with `/api/v1`)
- [ ] VITE_WS_URL set in Vercel (without `/api/v1`)
- [ ] Vercel app redeployed
- [ ] CORS test passes from browser console
- [ ] Login works on Vercel app
