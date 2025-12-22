# Testing Guide - Admin & User Roles

## 🔑 **Default Admin Credentials (For Testing)**

The **first user** registered in your system automatically becomes the admin. To set up a fixed admin account:

### **Option 1: Create Admin Account First**

1. **Register the first user** (this becomes admin):
   - Email: `admin@quantchat.com`
   - Username: `admin`
   - Password: `Admin@123`
   - Full Name: `Admin User`

2. **This account will automatically get `role='admin'`** (first user rule)

### **Option 2: Manually Set Admin in Supabase**

Run this SQL in Supabase to make any user an admin:

```sql
-- Make a specific user an admin
UPDATE users 
SET role = 'admin' 
WHERE email = 'your-email@example.com';

-- Verify
SELECT id, email, username, role FROM users;
```

---

## 🧪 **Complete Testing Workflow**

### **Step 1: Create Admin Account**

1. Open your app: `https://secure-messaging-app-omega.vercel.app`
2. Click "Register" or "Sign Up"
3. **Register with these credentials:**
   ```
   Email: admin@quantchat.com
   Username: admin
   Password: Admin@123
   Full Name: Admin User
   ```
4. **Login with admin account** - You'll see:
   - ✅ "Admin" badge in sidebar
   - ✅ "Invite New User" button
   - ✅ "Manage Users" button

### **Step 2: Invite a Regular User**

**As Admin:**
1. Click "Invite New User" button
2. Enter email: `user1@gmail.com`
3. Send invitation
4. User1 receives email with link

**As User1:**
1. Click invitation link from email
2. Register with invited email
3. Login
4. You'll see **only Admin** in your contacts
5. You can message admin directly

### **Step 3: Test Existing User Flow**

**As Admin:**
1. Register a second user directly (without invitation):
   - Go to register page
   - Email: `user2@gmail.com`
   - Register normally
2. Go back to admin account
3. Click "Manage Users" button
4. You'll see `user2@gmail.com` in the list
5. Click "Add" to add them as contact
6. Now both admin and user2 can chat

### **Step 4: Test Contact Management**

**As Admin:**
1. Click "Manage Users"
2. See all registered users
3. Users marked "Contact" can be removed
4. Users not yet contacts can be added
5. Click "Add" / "Remove" to manage
6. Contacts appear in sidebar immediately

---

## 📋 **Testing Checklist**

### **Admin Features:**
- [ ] Admin badge shows in sidebar
- [ ] "Invite New User" button visible
- [ ] "Manage Users" button visible
- [ ] Can send invitation emails
- [ ] Can see all registered users
- [ ] Can add existing users as contacts
- [ ] Can remove contacts
- [ ] Can chat with all contacts
- [ ] Sees all invited/added users in contact list

### **Regular User Features:**
- [ ] No admin badge (clean interface)
- [ ] No "Invite New User" button
- [ ] No "Manage Users" button
- [ ] Only sees admin in contact list
- [ ] Cannot see other users
- [ ] Can message admin directly
- [ ] Receives messages from admin
- [ ] Private, isolated chat experience

### **Invitation Flow:**
- [ ] Admin sends invitation
- [ ] Email received (check spam folder)
- [ ] Invitation link works
- [ ] User auto-added as contact after accepting
- [ ] Both users can chat immediately

### **Existing User Flow:**
- [ ] User registers without invitation
- [ ] User appears in "Manage Users" list
- [ ] Admin can manually add as contact
- [ ] Contact relationship is bidirectional
- [ ] Chat works between admin and user

---

## 🎯 **Quick Test Scenarios**

### **Scenario 1: New User via Invitation**
```
1. Admin invites user1@gmail.com
2. User1 receives email
3. User1 clicks link and registers
4. ✅ Both see each other in contacts
5. ✅ Can chat immediately
```

### **Scenario 2: Existing User (Already Registered)**
```
1. User2 registers directly
2. Admin tries to invite user2@gmail.com
3. ❌ Shows: "User already registered. Add them directly as a contact."
4. Admin clicks "Manage Users"
5. Admin clicks "Add" next to user2
6. ✅ Both see each other in contacts
7. ✅ Can chat immediately
```

### **Scenario 3: Contact Removal**
```
1. Admin has user1 as contact
2. Admin clicks "Manage Users"
3. Admin clicks "Remove" next to user1
4. ✅ User1 disappears from admin's contacts
5. ✅ Admin disappears from user1's contacts
6. ✅ Cannot chat anymore (until re-added)
```

---

## 🔐 **Production Setup**

### **Change Default Admin Credentials:**

After testing, change the admin password:

**Option 1: Via App (if password change feature exists)**
- Login as admin
- Go to Settings
- Change password

**Option 2: Via Supabase SQL**
```sql
-- Update admin password hash
-- First, hash your new password using bcrypt
-- Then update the database
UPDATE users 
SET password_hash = '$2b$10$YOUR_NEW_HASHED_PASSWORD'
WHERE email = 'admin@quantchat.com';
```

**Option 3: Register → Delete → Re-register**
1. Delete admin account from Supabase
2. Re-register with new credentials
3. First user becomes admin automatically

---

## 📝 **Environment Variables for Testing**

### **Backend (.env):**
```env
# Use Supabase database
DATABASE_URL=postgresql://postgres.xxx:password@xxx.supabase.com:6543/postgres

# Email service
RESEND_API_KEY=re_your_key_here
VERIFIED_DOMAIN=quantchat.live

# Frontend URL
FRONTEND_URL=https://secure-messaging-app-omega.vercel.app
```

### **Frontend (.env.local):**
```env
VITE_API_URL=https://secure-messaging-app-production.up.railway.app/api/v1
VITE_WS_URL=wss://secure-messaging-app-production.up.railway.app
```

---

## 🚀 **Stay Logged In (No Re-login)**

Your app already has **localStorage** persistence:

1. **Login once as admin**
2. **Browser remembers your session** (via authToken)
3. **Refresh page** → Still logged in
4. **Only logout when you click "Sign Out"**

To test multiple accounts:
- **Option 1:** Use different browsers (Chrome for admin, Firefox for user1)
- **Option 2:** Use incognito/private windows
- **Option 3:** Use browser profiles

---

## 🎉 **Summary**

**Fixed Admin Account:**
- Email: `admin@quantchat.com`
- Password: `Admin@123`
- Role: `admin`

**Test Users:**
- Invite: `user1@gmail.com`, `user2@gmail.com`, etc.
- Or register directly and add via "Manage Users"

**Admin Can:**
- ✅ Invite new users
- ✅ See all registered users
- ✅ Add/remove contacts manually
- ✅ Chat with all contacts

**Regular Users Can:**
- ✅ See only admin
- ✅ Message admin
- ❌ Cannot see other users
- ❌ Cannot invite anyone

**No More Re-login Needed!** Your session persists in localStorage until you logout. 🚀
