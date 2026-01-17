# Vercel Environment Variables Setup

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

## Verification

After setting the environment variables and redeploying:

1. Open browser console on your Vercel app
2. Check the login URL should be: `https://secure-messaging-app-backend.onrender.com/api/v1/auth/login`
3. It should NOT have double `/api/v1/api/v1/...`

## Common Issues

### CORS Errors
If you see CORS errors, verify that your Render backend has:
- `FRONTEND_URL=https://secure-messaging-app-omega.vercel.app` in environment variables
- The CORS_ORIGINS list in `backend/app/config.py` includes your Vercel URL

### Login Not Working
1. Check browser console for the actual URL being called
2. Verify backend is running: https://secure-messaging-app-backend.onrender.com/health
3. Check Render logs for any errors
4. Ensure Supabase database is accessible from Render
