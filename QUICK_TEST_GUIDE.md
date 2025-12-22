# 🧪 QUICK TESTING GUIDE - Production App

## 🔗 Your Live App
**Frontend**: https://secure-messaging-app-omega.vercel.app

---

## ✅ TEST 1: Backend is Running (30 seconds)

Open this URL in browser:
```
https://secure-messaging-app-production.up.railway.app/health
```

**✅ SUCCESS**: You see `{"status":"healthy"}`  
**❌ FAIL**: Check Railway deployment logs

---

## ✅ TEST 2: Register Admin Account (2 minutes)

1. Visit: https://secure-messaging-app-omega.vercel.app
2. Click **"Register"** tab
3. Fill form:
   - Email: `admin@quantchat.com`
   - Username: `admin`
   - Password: `Admin@123`
4. Click **"Register"**

### What to Look For:
- ✅ Redirects to chat page
- ✅ See **"Admin"** badge next to username in sidebar
- ✅ See **"Invite New User"** button at bottom
- ✅ See **"Manage Users"** button below invite
- ✅ Connection status shows **"🟢 Connected"**
- ✅ No errors in browser console (F12)

**❌ If Failed**: 
- Check browser console (F12) for errors
- Check Railway logs
- Verify Supabase migration ran successfully

---

## ✅ TEST 3: Send Email Invitation (2 minutes)

1. Still logged in as admin
2. Click **"Invite New User"** button
3. Enter your real email: `your-email@gmail.com`
4. Click **"Send Invitation"**
5. Check your email inbox + spam folder

### What to Look For:
- ✅ Success message in app
- ✅ Email arrives from `noreply@quantchat.live`
- ✅ Subject: "You've been invited to join our secure messaging platform"
- ✅ Professional HTML template (not plain text)
- ✅ Contains invitation link

**❌ If Failed**:
- Check spam folder first
- Check Railway environment variables (RESEND_API_KEY, VERIFIED_DOMAIN)
- Check Railway logs for email errors

---

## ✅ TEST 4: Accept Invitation & Register User (3 minutes)

1. Open invitation email
2. Click the invitation link
3. Should redirect to app with email pre-filled
4. Fill form:
   - Username: `testuser`
   - Password: `Test@123`
5. Click **"Register"**

### What to Look For:
- ✅ Registration successful
- ✅ Redirects to chat page
- ✅ See admin in contact list (left sidebar)
- ✅ **NO** admin badge (regular user)
- ✅ **NO** invite buttons (regular user cannot invite)
- ✅ Connection shows **"🟢 Connected"**

**❌ If Failed**:
- Check browser console
- Verify token in URL is valid
- Check Railway logs

---

## ✅ TEST 5: Test Real-Time Messaging (5 minutes)

### Setup: Open 2 Browser Windows
- **Window 1**: Normal browser → Login as admin
- **Window 2**: Incognito/Private → Login as testuser

### Steps:
1. **Window 1 (Admin)**:
   - Click on "testuser" in contact list
   - Type: "Hello from admin"
   - Press Enter

2. **Window 2 (Testuser)**:
   - Should see admin message appear **instantly** (no refresh)
   - Type: "Hello admin!"
   - Press Enter

3. **Window 1 (Admin)**:
   - Should see reply appear **instantly**

### What to Look For:
- ✅ Messages appear in real-time (no page refresh)
- ✅ Both windows stay connected
- ✅ Messages appear in correct order
- ✅ Timestamps are correct
- ✅ No console errors

**❌ If Failed**:
- Check WebSocket connection status
- Verify Railway backend is running
- Check browser console for WS errors

---

## ✅ TEST 6: Admin User Management (3 minutes)

1. Login as admin (Window 1)
2. Click **"Manage Users"** button
3. Dialog opens showing all users

### What to Look For:
- ✅ Shows admin user
- ✅ Shows testuser
- ✅ testuser has **"Contact"** badge (already added)

### Test Remove Contact:
1. Click **"Remove"** button next to testuser
2. Badge disappears
3. Check sidebar → testuser disappears from contact list

### Test Add Contact Back:
1. Click **"Add"** button next to testuser
2. Badge appears again
3. Check sidebar → testuser appears in contact list

**✅ SUCCESS**: Contacts update instantly without page refresh

---

## ✅ TEST 7: Session Persistence (1 minute)

1. While logged in as admin
2. Press **F5** to refresh page
3. Should stay logged in (no redirect to login)
4. Close browser completely
5. Reopen browser
6. Visit app again
7. Should **still** be logged in

### What to Look For:
- ✅ No login screen after refresh
- ✅ Still logged in after closing browser
- ✅ Token persists in localStorage

**To Verify**: Press F12 → Application → Local Storage → Check for:
- `authToken`
- `userId`
- `userEmail`
- `userRole`

---

## ✅ TEST 8: Regular User Restrictions (2 minutes)

1. Login as testuser (not admin)
2. Check sidebar

### What to Look For:
- ✅ **NO** "Admin" badge
- ✅ **NO** "Invite New User" button
- ✅ **NO** "Manage Users" button
- ✅ Only see admin in contact list (no other users)
- ✅ Can send/receive messages with admin

**✅ SUCCESS**: Regular users are properly restricted

---

## ✅ TEST 9: Database Schema Verification (1 minute)

1. Login to Supabase: https://supabase.com/dashboard
2. Open SQL Editor
3. Run this query:

```sql
-- Check users have role column
SELECT id, email, username, role, created_at 
FROM users 
ORDER BY created_at;

-- Check contacts table
SELECT c.id, u1.email as user_email, u2.email as contact_email
FROM contacts c
JOIN users u1 ON c.user_id = u1.id
JOIN users u2 ON c.contact_id = u2.id;
```

### What to Look For:
- ✅ Users table has `role` column
- ✅ First user has `role = 'admin'`
- ✅ Contacts table uses `contact_id` (not contact_user_id)
- ✅ Bidirectional contacts exist

---

## ✅ TEST 10: Multi-Device Login (2 minutes)

1. Login as admin on desktop browser
2. Login as admin on mobile/tablet (or another browser)
3. Send message from desktop
4. Should appear on mobile instantly
5. Send reply from mobile
6. Should appear on desktop instantly

### What to Look For:
- ✅ Both sessions active simultaneously
- ✅ Messages sync in real-time
- ✅ No authentication conflicts

---

## 🎯 SUCCESS CRITERIA

Your deployment is **100% successful** if:

- [x] Backend health check returns healthy
- [x] Admin registration works
- [x] Email invitations arrive (check spam)
- [x] Users can register via invitation
- [x] Real-time messaging works both ways
- [x] Admin can manage users (add/remove contacts)
- [x] Regular users can't access admin features
- [x] WebSocket stays connected
- [x] Session persists across refreshes
- [x] No console errors in browser
- [x] No errors in Railway logs

---

## 🐛 IF SOMETHING FAILS

### Backend Issues
1. Check Railway deployment logs
2. Verify environment variables set
3. Test health endpoint

### Frontend Issues
1. Check browser console (F12)
2. Verify API URLs in Vercel environment variables
3. Check Network tab for failed requests

### Database Issues
1. Re-run `PRODUCTION_DEPLOYMENT.sql` in Supabase
2. Verify schema with SQL queries
3. Check connection string uses pooler (port 6543)

### WebSocket Issues
1. Check Railway is running
2. Verify wss:// (not ws://)
3. Check Railway logs for WebSocket errors

### Email Issues
1. Check spam folder
2. Verify RESEND_API_KEY in Railway
3. Check Resend dashboard for delivery status

---

## 📊 Quick Verification Commands

```bash
# Test backend health
curl https://secure-messaging-app-production.up.railway.app/health

# Test API endpoint
curl https://secure-messaging-app-production.up.railway.app/api/v1/auth/login
```

---

## ✅ TESTING COMPLETE!

Once all tests pass, your app is fully functional and ready for real users! 🚀

**Your Live App**: https://secure-messaging-app-omega.vercel.app
