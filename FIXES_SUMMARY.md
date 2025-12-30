# User Management Fixes Summary

## Issues Fixed

### Issue 1: New users not seeing admin contact after registration via invitation
**Problem**: When a user registered via invitation link and logged in, the admin contact didn't appear in their contacts list.

**Root Cause**: After invitation acceptance, the frontend wasn't properly reloading to fetch the newly created contact relationship.

**Solution**: 
- Modified [LoginForm.tsx](src/components/auth/LoginForm.tsx) to force a full page reload after invitation acceptance
- This ensures the ChatContext fetches contacts from the database when the page reloads
- Changed from `navigate('/')` to `window.location.href = '/'` to trigger a complete page refresh

### Issue 2: Removed users reappearing in Manage Users after re-registration
**Problem**: When admin removed a user, the user was deleted from the database. If the user re-registered with the same email, they appeared in Manage Users again.

**Root Cause**: Complete user deletion made the email available for re-registration, creating a new user account with the same email.

**Solution Implemented**:
1. **Created `DeletedUser` Model** ([backend/app/models/deleted_user.py](backend/app/models/deleted_user.py))
   - New table to track deleted user emails
   - Prevents re-registration of previously removed emails
   - Stores: email, username, deleted_at timestamp, deleted_by_admin_id

2. **Updated Admin Remove Endpoint** ([backend/app/api/admin.py](backend/app/api/admin.py))
   - When admin removes a user, their email is added to `deleted_users` table
   - User and all related data (messages, contacts, invitations) are still deleted
   - Added logging for tracking removal operations

3. **Updated Registration Endpoint** ([backend/app/api/auth.py](backend/app/api/auth.py))
   - Checks `deleted_users` table before allowing registration
   - Returns HTTP 403 error if email was previously deleted
   - Error message: "This email was previously removed by an administrator and cannot be re-registered"

## Files Modified

### Backend
1. **backend/app/models/deleted_user.py** (NEW)
   - Model for tracking deleted user emails

2. **backend/app/models/__init__.py**
   - Added import for `DeletedUser` model

3. **backend/app/api/admin.py**
   - Added `DeletedUser` import
   - Updated `remove_contact_manually` endpoint to track deleted emails
   - Added logging for deletion operations

4. **backend/app/api/auth.py**
   - Added check for deleted emails in `register` endpoint
   - Returns 403 error if email was previously deleted

### Frontend
5. **src/components/auth/LoginForm.tsx**
   - Changed invitation acceptance navigation from `navigate('/')` to `window.location.href = '/'`
   - Forces full page reload to fetch new contact relationships
   - Updated success message to indicate redirection

## Database Changes

### New Table: `deleted_users`
```sql
CREATE TABLE deleted_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) NOT NULL,
    deleted_at TIMESTAMP DEFAULT NOW() NOT NULL,
    deleted_by_admin_id UUID
);

CREATE INDEX idx_deleted_users_email ON deleted_users(email);
```

## How It Works Now

### User Removal Flow
1. Admin opens "Manage Users" dialog
2. Admin clicks "Remove" on a user
3. Backend:
   - Adds user's email to `deleted_users` table
   - Deletes all messages (sent/received)
   - Deletes all contacts (bidirectional)
   - Deletes all invitations
   - Deletes the user account
4. Frontend:
   - Refreshes user list
   - Refreshes contacts list
   - User is removed from both lists

### Re-Registration Attempt Flow
1. Deleted user tries to register with same email
2. Backend checks `deleted_users` table
3. If email exists in `deleted_users`:
   - Returns 403 error
   - Message: "This email was previously removed by an administrator and cannot be re-registered"
4. Frontend displays error message to user
5. Registration is blocked

### New User Registration via Invitation Flow
1. Admin sends invitation link
2. New user clicks link and registers/logs in
3. Backend `accept_invitation` creates bidirectional contacts:
   - Contact: Admin → New User
   - Contact: New User → Admin
4. Frontend:
   - Accepts invitation via API
   - Forces full page reload (`window.location.href = '/'`)
5. After reload:
   - ChatContext fetches all contacts from database
   - New user sees admin in contact list
   - Admin sees new user in contact list (if they refresh)

## Testing Recommendations

1. **Test User Removal**:
   - Create a test user
   - Have admin remove them from Manage Users
   - Verify user disappears from both Manage Users and Contacts list
   - Try to log in with removed user's credentials → should fail

2. **Test Re-Registration Prevention**:
   - Use email of previously removed user
   - Try to register with same email
   - Should get 403 error with appropriate message

3. **Test New User via Invitation**:
   - Admin sends invitation to new email
   - New user registers via link
   - After login, verify admin appears in new user's contact list
   - Verify new user can send messages to admin
   - Have admin refresh → new user should appear in their contact list

4. **Test Invitation for Existing User**:
   - Admin sends invitation to existing user (not in contacts)
   - Existing user logs in via invitation link
   - Should accept invitation and create bidirectional contact
   - Both users should see each other in contacts

## Migration Notes

- The `deleted_users` table is created automatically by SQLAlchemy on server startup
- No manual migration required if using SQLAlchemy's `Base.metadata.create_all()`
- For production, consider creating an Alembic migration for better tracking

## Future Enhancements (Optional)

1. **Admin Control Panel for Deleted Users**:
   - View list of deleted users
   - Option to "unblock" an email (remove from deleted_users)
   - Audit trail of who deleted whom and when

2. **Soft Delete Option**:
   - Add `is_deleted` flag to User model
   - Keep user data but mark as deleted
   - Allows for data recovery if needed

3. **Email Notification**:
   - Notify user when their account is removed
   - Explain why they can't re-register

4. **Time-Limited Deletion**:
   - Allow re-registration after X days/months
   - Automatic cleanup of old deleted_users records

## Error Messages

### For Users
- **Re-registration attempt**: "This email was previously removed by an administrator and cannot be re-registered"
- **Contact removal**: "User removed from your contacts"

### For Admins  
- **Successful removal**: "User account and all related data removed successfully"
- **Failed removal**: "Failed to remove user: [error details]"
