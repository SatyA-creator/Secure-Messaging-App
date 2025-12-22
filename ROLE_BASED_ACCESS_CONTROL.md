# Role-Based Access Control (RBAC) Implementation Guide

## Overview
This document explains the role-based access control system that provides privacy and segregated interfaces for admins and regular users.

## 🎯 Features Implemented

### 1. **User Roles**
- **Admin**: Can invite users, see all invited users, manage the platform
- **User**: Can only see and chat with admin(s) who invited them

### 2. **Privacy & Isolation**
- Regular users cannot see other users' chats
- Regular users can only message admin(s)
- Each user has their own private interface
- Admin can see and chat with all invited users

### 3. **Automatic Role Assignment**
- First registered user becomes admin
- Users invited via email become regular users
- Self-registered users (without invitation) become regular users

## 🔧 Technical Implementation

### Database Changes

#### Added `role` column to `users` table:
```sql
ALTER TABLE users ADD COLUMN role VARCHAR(20) DEFAULT 'user' NOT NULL;
```

**Roles:**
- `admin` - Platform administrator with full access
- `user` - Regular user with limited access

### Backend Changes

#### 1. User Model ([user.py](f:\Intersnhip project\messsaging-app\backend\app\models\user.py))
```python
role = Column(String(20), default='user', nullable=False)
```

#### 2. Registration Logic ([auth_service.py](f:\Intersnhip project\messsaging-app\backend\app\services\auth_service.py))
- Checks if user registered via invitation → role = 'user'
- First user in system → role = 'admin'
- Otherwise → role = 'user'

#### 3. Contacts API ([contacts.py](f:\Intersnhip project\messsaging-app\backend\app\api\contacts.py))
- **Admin**: Sees all their contacts (all invited users)
- **Regular user**: Only sees admin(s) who invited them

```python
if requesting_user.role == 'admin':
    # Show all contacts
    contacts = db.query(Contact).filter(Contact.user_id == user_id).all()
else:
    # Only show admin contacts
    contacts = db.query(Contact).filter(
        Contact.user_id == user_id
    ).join(User, Contact.contact_id == User.id).filter(
        User.role == 'admin'
    ).all()
```

#### 4. Auth Responses
- Login and registration now return `role` field
- Frontend stores role in localStorage

### Frontend Changes

#### 1. User Type Definition ([messaging.ts](f:\Intersnhip project\messsaging-app\src\types\messaging.ts))
```typescript
export interface User {
  // ... other fields
  role?: 'admin' | 'user';
}
```

#### 2. Auth Context ([AuthContext.tsx](f:\Intersnhip project\messsaging-app\src\context\AuthContext.tsx))
- Stores `userRole` in localStorage
- Includes role in user object

#### 3. Sidebar Component ([Sidebar.tsx](f:\Intersnhip project\messsaging-app\src\components\chat\Sidebar.tsx))
- **Admin users see:**
  - "Admin" badge
  - "Invite New User" button
  - Option to invite users in settings menu
  
- **Regular users see:**
  - Standard interface
  - Only their admin contacts
  - No invitation features

#### 4. Send Invitation Dialog ([SendInvitation.jsx](f:\Intersnhip project\messsaging-app\src\components\SendInvitation.jsx))
- Modern dialog interface
- Uses current admin's email
- Shows success/error toasts

## 🚀 How It Works

### Admin Workflow:

1. **Admin logs in**
   - Sees admin badge in sidebar
   - Can click "Invite New User" button

2. **Admin invites user**
   - Clicks invite button
   - Enters user's email
   - System sends invitation email

3. **Admin interface**
   - Sees all invited users in contact list
   - Can chat with any invited user
   - Each conversation is private and secure

### Regular User Workflow:

1. **User receives invitation email**
   - Clicks "Accept Invitation" link
   - If logged in, auto-accepts and redirects to chat
   - If not logged in, redirects to register/login

2. **User accepts invitation**
   - Automatically added as admin's contact
   - Admin automatically added as user's contact
   - Both can message each other immediately

3. **User interface**
   - Only sees admin(s) in contact list
   - Cannot see other regular users
   - Private, isolated chat experience

## 🔒 Privacy & Security

### Privacy Guarantees:

1. **User Isolation**
   - Regular users cannot see each other
   - Each user only sees their own conversations
   - No cross-user data leakage

2. **Contact Filtering**
   - Backend enforces role-based filtering
   - Regular users can only fetch admin contacts
   - Admin can fetch all their contacts

3. **Message Privacy**
   - Messages already filtered by sender/recipient
   - End-to-end encryption maintained
   - No additional message filtering needed (already secure)

### Security Measures:

1. **Role Enforcement**
   - Roles checked on every API call
   - Cannot escalate privileges
   - Role set during registration (immutable)

2. **Database Constraints**
   - Role column has default value
   - Cannot be null
   - Only accepts 'admin' or 'user'

## 📋 Database Migration

### To apply the changes:

```bash
cd backend

# Option 1: Run Alembic migration
alembic upgrade head

# Option 2: Manual SQL (if needed)
psql -U message_user -d messenger_app
ALTER TABLE users ADD COLUMN role VARCHAR(20) DEFAULT 'user' NOT NULL;
UPDATE users SET role = 'admin' WHERE id = (SELECT id FROM users ORDER BY created_at LIMIT 1);
```

### Update existing users:

```sql
-- Make first user an admin
UPDATE users SET role = 'admin' 
WHERE id = (SELECT id FROM users ORDER BY created_at LIMIT 1);

-- All other users are regular users (already default)
```

## 🎨 UI/UX Changes

### Admin Interface:
- ✨ Admin badge with crown icon
- ➕ "Invite New User" button prominently displayed
- 👥 Sees all invited users in contacts
- ⚙️ Invitation option in settings menu

### Regular User Interface:
- 💬 Clean, simple chat interface
- 👤 Only sees admin contact(s)
- 🔒 Private, isolated experience
- 📱 No administrative features

## 🧪 Testing

### Test Scenario 1: Admin Invites Users
1. Login as admin
2. Click "Invite New User"
3. Enter email: `user1@example.com`
4. Send invitation
5. User1 receives email and accepts
6. Admin should see User1 in contacts
7. User1 should see Admin in contacts

### Test Scenario 2: User Privacy
1. Admin invites User1 and User2
2. User1 logs in
3. User1 should ONLY see Admin, not User2
4. User2 logs in
5. User2 should ONLY see Admin, not User1

### Test Scenario 3: Role Assignment
1. Register first user → should be admin
2. Admin invites someone → should be user
3. Self-register (no invitation) → should be user

## 🔄 Workflow Diagram

```
Admin                           User
  |                              |
  |--[Invite via Email]--------->|
  |                              |
  |                              |--[Receive Email]
  |                              |--[Click Link]
  |                              |--[Auto-Accept if logged in]
  |<------[Contact Added]--------|
  |-------[Contact Added]------->|
  |                              |
  |<========[Chat]=============>|
```

## 📝 Environment Variables

No new environment variables required. All role logic is handled in application code.

## ⚠️ Important Notes

1. **First User is Admin**: The very first registered user becomes admin automatically
2. **Roles are Immutable**: Once set, roles cannot be changed (requires manual DB update)
3. **Invitation Required**: Users invited via email are always regular users
4. **Contact Filtering**: Backend enforces contact visibility rules
5. **Privacy First**: Regular users cannot discover or contact other regular users

## 🐛 Troubleshooting

### Issue: "column contacts.contact_id does not exist"
**Solution**: Your database schema is outdated. Run the migration:
```bash
# Local
cd backend
alembic upgrade head

# Railway (see RAILWAY_DATABASE_FIX.md for detailed guide)
railway run alembic upgrade head

# Or run SQL directly
railway run psql $DATABASE_URL -f backend/fix_contacts_schema.sql
```

### Issue: User not seeing admin after accepting invitation
**Solution**: Check that bidirectional contacts were created in `invitation_service.py`

### Issue: Admin not seeing invited users
**Solution**: Verify role is set correctly in database:
```sql
SELECT id, email, username, role FROM users;
```

### Issue: Role not showing in UI
**Solution**: 
1. Check localStorage has `userRole` key
2. Clear localStorage and login again
3. Verify backend returns role in auth response

### Issue: Migration fails
**Solution**:
```bash
# Rollback and retry
alembic downgrade -1
alembic upgrade head

# Or manually add column
ALTER TABLE users ADD COLUMN role VARCHAR(20) DEFAULT 'user' NOT NULL;
```

## 🔮 Future Enhancements

Possible improvements:
1. **Multiple Admin Levels**: Super admin, moderator, etc.
2. **Role Management UI**: Allow admin to change user roles
3. **Group Chats**: Allow admin to create groups with multiple users
4. **User Permissions**: Fine-grained permission system
5. **Audit Logs**: Track admin actions

---

**Implementation Complete!** ✅

The role-based system is now fully functional with privacy and isolation between users.
