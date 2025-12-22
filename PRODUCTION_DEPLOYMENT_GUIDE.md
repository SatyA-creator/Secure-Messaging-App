# 🚀 PRODUCTION DEPLOYMENT GUIDE

Complete step-by-step guide to deploy your secure messaging app to production.

---

## 📋 PRE-DEPLOYMENT CHECKLIST

### ✅ Required Accounts & Services
- [x] **Vercel Account** - Frontend hosting
- [x] **Railway Account** - Backend hosting  
- [x] **Supabase Account** - PostgreSQL database
- [x] **Resend Account** - Email service (verified domain: quantchat.live)
- [x] **GitHub Repository** - Code repository

### ✅ Configuration Files Ready
- [x] `PRODUCTION_DEPLOYMENT.sql` - Database migration script
- [x] `.env.production` - Environment variables reference
- [x] Frontend configured for production URLs
- [x] Backend CORS configured for Vercel

---

## 🗄️ STEP 1: DATABASE SETUP (Supabase)

### 1.1 Run Database Migration

1. **Login to Supabase Dashboard**
   - Go to: https://supabase.com/dashboard
   - Select your project: `ycnilziiknmahekkpveg`

2. **Open SQL Editor**
   - Navigate to: SQL Editor (left sidebar)
   - Click: "New Query"

3. **Execute Migration Script**
   - Open file: `PRODUCTION_DEPLOYMENT.sql`
   - Copy all SQL content
   - Paste into Supabase SQL Editor
   - Click: "Run" button (or Ctrl+Enter)

4. **Verify Results**
   ```
   ✅ Check for success messages:
   - "Added role column to users table"
   - "Set first user as admin" (if users exist)
   - "Added contact_id column to contacts table"
   - "Dropped old contact_user_id column"
   ```

5. **Verify Schema**
   ```sql
   -- Run this to confirm schema:
   SELECT column_name, data_type 
   FROM information_schema.columns 
   WHERE table_name = 'users' OR table_name = 'contacts'
   ORDER BY table_name, ordinal_position;
   ```

### 1.2 Expected Schema

**users table:**
- id (uuid)
- email (varchar)
- username (varchar)
- password_hash (varchar)
- **role (varchar) ← NEW**
- created_at (timestamp)
- last_seen (timestamp)

**contacts table:**
- id (uuid)
- user_id (uuid)
- **contact_id (uuid) ← FIXED**
- nickname (varchar)
- created_at (timestamp)

---

## 🖥️ STEP 2: BACKEND DEPLOYMENT (Railway)

### 2.1 Set Environment Variables

1. **Login to Railway Dashboard**
   - Go to: https://railway.app
   - Select project: `secure-messaging-app-production`

2. **Configure Environment Variables**
   - Click: "Variables" tab
   - Add/Update these variables:

   ```env
   # Server
   SERVER_HOST=0.0.0.0
   SERVER_PORT=8000
   DEBUG=false
   ENVIRONMENT=production

   # Database (Supabase)
   DATABASE_URL=postgresql://postgres.ycnilziiknmahekkpveg:Secure%40123@aws-1-ap-south-1.pooler.supabase.com:6543/postgres

   # JWT
   JWT_SECRET_KEY=your-super-secret-256-bit-key-change-this
   ACCESS_TOKEN_EXPIRE_MINUTES=1440

   # Email (Resend)
   RESEND_API_KEY=re_YOUR_ACTUAL_API_KEY
   VERIFIED_DOMAIN=quantchat.live

   # Frontend
   FRONTEND_URL=https://secure-messaging-app-omega.vercel.app
   ```

3. **Important Variables to Check:**
   - ✅ `DATABASE_URL` - Must use Supabase pooler URL (port 6543)
   - ✅ `RESEND_API_KEY` - Get from https://resend.com/api-keys
   - ✅ `VERIFIED_DOMAIN` - Must match your verified domain
   - ✅ `FRONTEND_URL` - Must match your Vercel deployment

### 2.2 Deploy Backend

**Option A: Git Push (Recommended)**
```bash
# Commit all changes
git add .
git commit -m "Add admin dashboard and role-based access control"
git push origin main
```

Railway will automatically detect the push and redeploy.

**Option B: Manual Deploy**
1. Go to Railway Dashboard
2. Click: "Deployments" tab
3. Click: "Deploy" button
4. Select: "Redeploy"

### 2.3 Verify Deployment

1. **Check Deployment Logs**
   - Railway Dashboard → Deployments → Latest deployment
   - Look for: "Application startup complete"
   - Check for errors in logs

2. **Test Health Endpoint**
   ```bash
   curl https://secure-messaging-app-production.up.railway.app/health
   ```
   Expected response: `{"status": "healthy"}`

3. **Test API Endpoint**
   ```bash
   curl https://secure-messaging-app-production.up.railway.app/api/v1/auth/login
   ```
   Should not return 404 error

---

## 🌐 STEP 3: FRONTEND DEPLOYMENT (Vercel)

### 3.1 Set Environment Variables

1. **Login to Vercel Dashboard**
   - Go to: https://vercel.com/dashboard
   - Select project: `secure-messaging-app-omega`

2. **Configure Environment Variables**
   - Click: Settings → Environment Variables
   - Add these variables for **Production** environment:

   ```env
   VITE_API_URL=https://secure-messaging-app-production.up.railway.app/api/v1
   VITE_WS_URL=wss://secure-messaging-app-production.up.railway.app
   ```

3. **Save Changes**
   - Click: "Save" for each variable
   - Variables will be applied on next deployment

### 3.2 Deploy Frontend

**Option A: Git Push (Recommended)**
```bash
# Same commit from Step 2.2
git push origin main
```

Vercel will automatically detect the push and redeploy.

**Option B: Manual Deploy**
1. Go to Vercel Dashboard
2. Click: "Deployments" tab
3. Click: "Redeploy" on latest deployment
4. Check: "Use existing Build Cache" (optional)
5. Click: "Redeploy"

### 3.3 Verify Deployment

1. **Check Build Logs**
   - Vercel Dashboard → Deployments → Latest deployment
   - Look for: "Build Completed"
   - Check for errors in build logs

2. **Visit Frontend**
   - Open: https://secure-messaging-app-omega.vercel.app
   - Should load without errors
   - Check browser console for errors

---

## 🧪 STEP 4: PRODUCTION TESTING

### 4.1 Create Admin Account

1. **Visit App**
   - Go to: https://secure-messaging-app-omega.vercel.app

2. **Register First User (Admin)**
   - Click: "Register"
   - Email: `admin@quantchat.com`
   - Username: `admin`
   - Password: `Admin@123`
   - Click: "Register"

3. **Verify Admin Role**
   - After login, you should see:
     - ✅ Admin badge in sidebar
     - ✅ "Invite New User" button
     - ✅ "Manage Users" button

### 4.2 Test Admin Features

**Test 1: Send Invitation**
1. Click: "Invite New User" button
2. Enter email: `user1@test.com`
3. Click: "Send Invitation"
4. Check email inbox for invitation

**Test 2: Manage Users**
1. Click: "Manage Users" button
2. Should show all registered users
3. Test adding/removing contacts

**Test 3: WebSocket Connection**
1. Check sidebar for connection status
2. Should show: "🟢 Connected"
3. If offline, check Railway logs

**Test 4: Messaging**
1. Register a second user from invitation link
2. Login as second user
3. Should see admin in contact list
4. Send message to admin
5. Login as admin
6. Should receive message in real-time

### 4.3 Common Issues & Fixes

**Issue: "Network Error" when logging in**
- ✅ Check Railway backend is running
- ✅ Verify DATABASE_URL in Railway variables
- ✅ Check CORS configuration allows Vercel URL

**Issue: "Failed to connect to websocket"**
- ✅ Check Railway deployment logs
- ✅ Verify Railway uses wss:// (not ws://)
- ✅ Check Railway allows WebSocket connections

**Issue: "Email not received"**
- ✅ Check spam folder
- ✅ Verify RESEND_API_KEY in Railway
- ✅ Verify VERIFIED_DOMAIN matches Resend domain
- ✅ Check Railway logs for email errors

**Issue: "column does not exist" errors**
- ✅ Re-run PRODUCTION_DEPLOYMENT.sql in Supabase
- ✅ Check Supabase connection string uses pooler (port 6543)
- ✅ Verify schema with SQL query

**Issue: "User already exists" when registering**
- ✅ Database already has users - this is normal
- ✅ Use different email or login with existing user
- ✅ Admin can manage existing users via "Manage Users"

---

## 📊 STEP 5: MONITORING

### Railway Backend Monitoring

1. **Check Logs**
   - Railway Dashboard → Deployments → Logs
   - Monitor for errors and warnings

2. **Monitor CPU/Memory**
   - Railway Dashboard → Metrics
   - Check resource usage

3. **Database Connections**
   - Supabase Dashboard → Database → Connections
   - Monitor active connections (should be < pool size)

### Vercel Frontend Monitoring

1. **Check Analytics**
   - Vercel Dashboard → Analytics
   - Monitor page views and errors

2. **Check Build Logs**
   - Vercel Dashboard → Deployments
   - Look for build warnings

---

## 🎯 DEPLOYMENT COMPLETE!

Your app is now live at:
- 🌐 **Frontend**: https://secure-messaging-app-omega.vercel.app
- 🔧 **Backend**: https://secure-messaging-app-production.up.railway.app
- 🗄️ **Database**: Supabase (pooler.supabase.com:6543)

### Default Admin Credentials
- **Email**: admin@quantchat.com
- **Password**: Admin@123

### Next Steps
1. ✅ Test all features in production
2. ✅ Invite real users via admin dashboard
3. ✅ Monitor logs for errors
4. ✅ Set up custom domain (optional)
5. ✅ Configure SSL certificates (optional)

---

## 🆘 NEED HELP?

**Backend Issues:**
- Check Railway deployment logs
- Verify environment variables
- Test API endpoints with curl

**Frontend Issues:**
- Check Vercel build logs
- Check browser console for errors
- Verify API URLs in environment variables

**Database Issues:**
- Re-run PRODUCTION_DEPLOYMENT.sql
- Check Supabase dashboard for connection errors
- Verify DATABASE_URL uses pooler (port 6543)

**Email Issues:**
- Check Resend dashboard for delivery status
- Verify domain is verified in Resend
- Check spam folder for test emails

---

## 📝 NOTES

- **First user registered becomes admin automatically**
- **All subsequent users have 'user' role by default**
- **Admins can invite and manage all users**
- **Regular users only see admin in their contact list**
- **WebSocket connections maintain real-time messaging**
- **JWT tokens expire after 24 hours (1440 minutes)**
- **Database uses connection pooling (max 60 connections)**

---

Good luck with your deployment! 🚀
