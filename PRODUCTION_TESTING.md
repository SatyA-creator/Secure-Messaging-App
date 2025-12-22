# 🧪 PRODUCTION TESTING CHECKLIST

Quick reference for testing your deployed messaging app on Vercel and Railway.

---

## 🔗 PRODUCTION URLS

- **Frontend (Vercel)**: https://secure-messaging-app-omega.vercel.app
- **Backend (Railway)**: https://secure-messaging-app-production.up.railway.app
- **Database**: Supabase PostgreSQL

---

## ✅ PRE-TESTING VERIFICATION

Before testing, ensure:

- [ ] ✅ Supabase migration completed (PRODUCTION_DEPLOYMENT.sql)
- [ ] ✅ Railway backend deployed with latest code
- [ ] ✅ Vercel frontend deployed with latest code
- [ ] ✅ Environment variables set correctly (check .env.production)
- [ ] ✅ Railway backend logs show no errors
- [ ] ✅ Vercel build completed successfully

---

## 📋 TEST SCENARIOS

### TEST 1: Backend Health Check ⚡

**Purpose**: Verify backend is running

**Steps**:
1. Open browser or terminal
2. Visit: https://secure-messaging-app-production.up.railway.app/health
3. **Expected**: `{"status": "healthy"}`

**If fails**: 
- Check Railway deployment status
- Check Railway logs for errors
- Verify DATABASE_URL is set correctly

---

### TEST 2: Frontend Loads 🌐

**Purpose**: Verify frontend deployment

**Steps**:
1. Open browser
2. Visit: https://secure-messaging-app-omega.vercel.app
3. **Expected**: App loads with login/register page
4. Open browser console (F12)
5. **Expected**: No error messages

**If fails**:
- Check Vercel deployment status
- Check browser console for errors
- Verify VITE_API_URL is set correctly

---

### TEST 3: Admin Registration 👤

**Purpose**: Create first admin user

**Steps**:
1. Visit: https://secure-messaging-app-omega.vercel.app
2. Click: "Register" tab
3. Fill form:
   - Email: `admin@quantchat.com`
   - Username: `admin`
   - Password: `Admin@123`
4. Click: "Register"
5. **Expected**: 
   - Redirected to chat page
   - See admin badge in sidebar
   - See "Invite New User" button
   - See "Manage Users" button
   - Connection status shows "🟢 Connected"

**If fails**:
- Check browser console for errors
- Check Railway logs for database errors
- Verify Supabase migration completed
- Verify DATABASE_URL uses pooler (port 6543)

---

### TEST 4: Admin Login (Persistent Session) 🔐

**Purpose**: Test login and session persistence

**Steps**:
1. Logout if currently logged in
2. Click: "Login" tab
3. Enter credentials:
   - Email: `admin@quantchat.com`
   - Password: `Admin@123`
4. Click: "Login"
5. **Expected**: Redirected to chat page with admin UI
6. Refresh page (F5)
7. **Expected**: Still logged in (no redirect to login)
8. Close browser completely
9. Reopen browser and visit app
10. **Expected**: Still logged in

**If fails**:
- Check browser localStorage (F12 → Application → Local Storage)
- Should see: authToken, userId, userEmail, userRole
- Check JWT expiration time (1440 minutes = 24 hours)

---

### TEST 5: Send Email Invitation 📧

**Purpose**: Test invitation email sending

**Steps**:
1. Login as admin
2. Click: "Invite New User" button
3. Enter email: `user1@test.com` (use real email you can check)
4. Click: "Send Invitation"
5. **Expected**: Success message appears
6. Check email inbox (including spam folder)
7. **Expected**: 
   - Email from `noreply@quantchat.live`
   - Subject: "You've been invited..."
   - Professional HTML template
   - Contains invitation link

**If fails**:
- Check Railway logs for email errors
- Verify RESEND_API_KEY is set
- Verify VERIFIED_DOMAIN is set to `quantchat.live`
- Check Resend dashboard for delivery status
- Check spam folder

---

### TEST 6: Accept Invitation & Register 🎫

**Purpose**: Test invitation acceptance flow

**Steps**:
1. Open invitation email
2. Click invitation link
3. **Expected**: Redirected to app with email pre-filled
4. Fill registration form:
   - Username: `user1`
   - Password: `User1@123`
5. Click: "Register"
6. **Expected**:
   - Registration successful
   - Redirected to chat page
   - See admin in contact list
   - No admin badge or invite buttons (regular user)

**If fails**:
- Check browser console for errors
- Check Railway logs for invitation errors
- Verify invitation token is valid
- Check Supabase for user creation

---

### TEST 7: User Login ✅

**Purpose**: Test regular user login

**Steps**:
1. Logout if logged in
2. Click: "Login" tab
3. Enter credentials:
   - Email: `user1@test.com`
   - Password: `User1@123`
4. Click: "Login"
5. **Expected**:
   - Redirected to chat page
   - See only admin in contact list
   - NO admin badge
   - NO invite buttons
   - Connection status shows "🟢 Connected"

**If fails**:
- Check credentials match registration
- Check browser console for errors
- Check Railway logs for auth errors

---

### TEST 8: WebSocket Connection 🔌

**Purpose**: Test real-time connection

**Steps**:
1. Login as any user
2. Check connection status in sidebar
3. **Expected**: "🟢 Connected" badge
4. Open browser DevTools (F12) → Network → WS
5. **Expected**: See WebSocket connection to Railway backend
6. Open Railway logs
7. **Expected**: See "WebSocket client connected" messages

**If fails**:
- Check Railway backend is running
- Verify VITE_WS_URL uses wss:// (not ws://)
- Check Railway allows WebSocket connections
- Check firewall/proxy settings

---

### TEST 9: Send & Receive Messages 💬

**Purpose**: Test real-time messaging

**Steps**:
1. Open 2 browser windows (or incognito + normal)
2. Window 1: Login as admin
3. Window 2: Login as user1
4. Window 1: Click on user1 contact
5. Window 1: Type message "Hello from admin"
6. Window 1: Press Enter
7. **Expected**:
   - Message appears in Window 1 immediately
   - Message appears in Window 2 in real-time (no refresh needed)
8. Window 2: Reply "Hello admin"
9. **Expected**:
   - Reply appears in Window 2 immediately
   - Reply appears in Window 1 in real-time

**If fails**:
- Check WebSocket connection status
- Check Railway logs for message errors
- Check browser console for errors
- Verify contacts exist in database

---

### TEST 10: Manage Users (Admin Only) 👥

**Purpose**: Test admin user management

**Steps**:
1. Login as admin
2. Click: "Manage Users" button
3. **Expected**: Dialog shows all registered users
4. Find user1 in list
5. **Expected**: Shows "Contact" badge (already added)
6. Click: "Remove" button
7. **Expected**: Contact removed, badge disappears
8. Check sidebar contact list
9. **Expected**: user1 no longer appears
10. Click: "Add" button
11. **Expected**: Contact added, badge appears
12. Check sidebar
13. **Expected**: user1 appears in contact list again

**If fails**:
- Check browser console for errors
- Check Railway logs for admin API errors
- Verify admin role exists in database
- Check contacts table schema

---

### TEST 11: Regular User Restrictions 🚫

**Purpose**: Verify regular users can't access admin features

**Steps**:
1. Login as user1 (not admin)
2. **Expected**:
   - NO "Invite New User" button
   - NO "Manage Users" button
   - NO admin badge
   - Only see admin in contact list
3. Try accessing admin API directly:
   ```bash
   curl -X GET \
     https://secure-messaging-app-production.up.railway.app/api/v1/admin/all-users/USER1_ID \
     -H "Authorization: Bearer USER1_TOKEN"
   ```
4. **Expected**: 403 Forbidden or authentication error

**If fails**:
- Check role-based access control in backend
- Verify user1 has role='user' (not 'admin')
- Check frontend conditional rendering

---

### TEST 12: User Already Exists Scenario 👤

**Purpose**: Test handling of duplicate invitations

**Steps**:
1. Login as admin
2. Click: "Invite New User"
3. Enter email: `user1@test.com` (already registered)
4. Click: "Send Invitation"
5. **Expected**: Error message "User already exists"
6. Click: "Manage Users"
7. Find user1
8. **Expected**: Can add as contact manually

**If succeeds**: This is the expected behavior - no duplicate users allowed

---

### TEST 13: Session Persistence 🔄

**Purpose**: Test long-term session

**Steps**:
1. Login as admin
2. Note current time
3. Leave browser open for 10 minutes
4. Return and try sending message
5. **Expected**: Still works (token valid for 24 hours)
6. Close all browser windows
7. Reopen after 5 minutes
8. Visit app
9. **Expected**: Still logged in

**If fails**:
- Check JWT expiration settings (1440 minutes)
- Check localStorage persistence
- Verify token refresh logic

---

### TEST 14: Multi-Device Login 📱💻

**Purpose**: Test concurrent logins

**Steps**:
1. Login as admin on desktop browser
2. Login as admin on mobile browser (or incognito)
3. **Expected**: Both sessions work simultaneously
4. Send message from desktop
5. **Expected**: Mobile receives in real-time
6. Send message from mobile
7. **Expected**: Desktop receives in real-time

**If fails**:
- Check WebSocket connection limits
- Check JWT token handling
- Verify database connection pool size

---

## 🎯 TESTING SUMMARY

After completing all tests, you should have verified:

- ✅ Backend health and API endpoints
- ✅ Frontend loads without errors
- ✅ Admin account creation (first user)
- ✅ User registration via invitation
- ✅ Login for admin and regular users
- ✅ WebSocket real-time connections
- ✅ Message sending and receiving
- ✅ Admin user management features
- ✅ Role-based access control
- ✅ Session persistence across refreshes
- ✅ Email delivery (check spam)
- ✅ Invitation acceptance flow
- ✅ Multi-device concurrent sessions

---

## 🐛 DEBUGGING TIPS

### Check Railway Logs
```bash
# Railway CLI (if installed)
railway logs

# Or visit Railway Dashboard → Logs
```

### Check Vercel Logs
```bash
# Vercel CLI (if installed)
vercel logs

# Or visit Vercel Dashboard → Deployments → Logs
```

### Check Browser Console
1. Press F12
2. Go to Console tab
3. Look for red errors
4. Check Network tab for failed requests

### Check Database
```sql
-- Login to Supabase SQL Editor and run:

-- Count users by role
SELECT role, COUNT(*) FROM users GROUP BY role;

-- Check contacts
SELECT u1.email as user_email, u2.email as contact_email
FROM contacts c
JOIN users u1 ON c.user_id = u1.id
JOIN users u2 ON c.contact_id = u2.id;

-- Check schema
\d users
\d contacts
```

---

## 📊 MONITORING

### Key Metrics to Watch

**Railway (Backend)**:
- CPU usage < 80%
- Memory usage < 512MB
- Response time < 200ms
- WebSocket connections active
- Database connections < pool size

**Vercel (Frontend)**:
- Build time < 2 minutes
- Page load time < 3 seconds
- No console errors
- WebSocket reconnection working

**Supabase (Database)**:
- Active connections < 60
- Query response time < 100ms
- No connection pool errors

---

## ✅ SUCCESS CRITERIA

Your production deployment is successful when:

1. ✅ Admin can login and stay logged in (no re-login)
2. ✅ Admin can invite users via email
3. ✅ Users receive invitation emails (not in spam)
4. ✅ Users can register and login
5. ✅ Real-time messaging works both ways
6. ✅ Admin can manage all users manually
7. ✅ Regular users only see admin in contacts
8. ✅ WebSocket stays connected
9. ✅ No console errors in browser
10. ✅ No errors in Railway logs

---

## 🆘 QUICK FIXES

**"Network Error"**:
- Restart Railway backend
- Check DATABASE_URL

**"WebSocket disconnected"**:
- Check Railway backend is running
- Verify wss:// URL (not ws://)

**"Email not received"**:
- Check spam folder
- Verify RESEND_API_KEY
- Check Resend dashboard

**"Column does not exist"**:
- Re-run PRODUCTION_DEPLOYMENT.sql
- Verify Supabase schema

---

Happy testing! 🚀

**Quick Test URL**: https://secure-messaging-app-omega.vercel.app
