# Testing Guide - Message Persistence & Real-Time Features

## Prerequisites
1. Backend running on port 8001
2. Frontend running (Vite dev server)
3. Database initialized with migrations
4. Redis server running (for WebSocket manager)

## Test Scenarios

### ✅ Test 1: Message Persistence Across Sessions
**Purpose**: Verify messages are saved to database and persist across logouts

**Steps**:
1. Login as Admin user
2. Select a contact from the contact list
3. Send 3-5 messages to that contact
4. Verify messages appear immediately in the chat window
5. Click the back button to return to contact list
6. Select the same contact again
7. **Expected**: All messages should still be visible
8. Logout from the application
9. Login again as the same Admin user
10. Select the same contact
11. **Expected**: All previous messages should still be visible

**Success Criteria**:
- ✅ Messages persist when clicking back
- ✅ Messages persist after logout/login
- ✅ Messages show correct timestamps
- ✅ Message status icons display correctly

---

### ✅ Test 2: Real-Time Message Delivery
**Purpose**: Verify messages display immediately for both sender and recipient

**Steps**:
1. Open two browser windows/tabs
2. Login as Admin in Window 1
3. Login as Regular User in Window 2
4. In Window 1 (Admin): Send a message to Regular User
5. **Expected**: Message appears immediately in Window 1 chat
6. **Expected**: Message appears immediately in Window 2 (recipient's chat)
7. In Window 2 (Regular User): Send a reply
8. **Expected**: Reply appears immediately in both windows

**Success Criteria**:
- ✅ Messages appear instantly for sender (optimistic update)
- ✅ Messages appear instantly for recipient (WebSocket push)
- ✅ No duplicate messages displayed
- ✅ Message status changes: sending → sent → delivered

---

### ✅ Test 3: Message Persistence During Page Refresh
**Purpose**: Verify messages survive page refreshes

**Steps**:
1. Login and send several messages to a contact
2. While viewing the chat with messages
3. Press F5 or Ctrl+R to refresh the page
4. Wait for page to reload and re-authenticate
5. Navigate back to the same contact
6. **Expected**: All messages should be loaded from database

**Success Criteria**:
- ✅ All messages reload correctly
- ✅ Message order preserved (chronological)
- ✅ Read status preserved
- ✅ Timestamps accurate

---

### ✅ Test 4: New User Visibility in Admin Dashboard
**Purpose**: Verify new users appear in admin dashboard immediately

**Setup**:
1. Login as Admin
2. Open "Manage Users" dialog
3. Note the current user count

**Steps**:
1. Keep Admin session open with "Manage Users" dialog visible
2. In a different browser/incognito window:
   - Go to registration page
   - Use an invitation link (or have Admin send one)
   - Complete registration
   - Accept the invitation
3. Switch back to Admin window
4. **Expected**: New user appears in the list immediately (no manual refresh needed)
5. **Expected**: User shows "is_contact: false" if not added as contact yet

**Success Criteria**:
- ✅ New user appears instantly in admin dashboard
- ✅ User list updates without manual refresh
- ✅ User details (email, username) display correctly
- ✅ "Add Contact" button available for new user

---

### ✅ Test 5: Contact Addition Real-Time Update
**Purpose**: Verify contact list updates when invitation is accepted

**Steps**:
1. Login as Admin
2. View the contact list sidebar
3. Send invitation to a new email address
4. In another browser/incognito:
   - Access the invitation link from email
   - Complete registration
   - Accept invitation
5. Switch back to Admin window
6. **Expected**: New contact appears in sidebar immediately

**Success Criteria**:
- ✅ Contact appears in sidebar without refresh
- ✅ Contact shows correct name/email
- ✅ Contact is clickable and opens chat window
- ✅ Empty conversation initialized for new contact

---

### ✅ Test 6: Offline Message Delivery
**Purpose**: Verify messages sent while recipient is offline are delivered on next login

**Steps**:
1. Login as Admin (Window 1)
2. Login as User B (Window 2)
3. In Window 2: Logout (User B goes offline)
4. In Window 1 (Admin): Send 3 messages to User B
5. **Expected**: Messages show "sent" status (not "delivered")
6. In Window 2: Login as User B again
7. **Expected**: All 3 messages appear immediately upon login

**Success Criteria**:
- ✅ Messages saved to database even when recipient offline
- ✅ Messages delivered when recipient comes online
- ✅ Status updates from "sent" to "delivered"
- ✅ Correct chronological order

---

### ✅ Test 7: Concurrent Multi-User Messaging
**Purpose**: Stress test real-time messaging with multiple users

**Steps**:
1. Open 3 browser windows
2. Login as Admin (Window 1)
3. Login as User A (Window 2)
4. Login as User B (Window 3)
5. All three users send messages rapidly to each other
6. **Expected**: All messages appear in correct conversations
7. **Expected**: No messages lost or duplicated
8. Refresh all three windows
9. **Expected**: All messages still present

**Success Criteria**:
- ✅ No message loss
- ✅ No duplicate messages
- ✅ Messages in correct conversations
- ✅ All persist after refresh

---

### ✅ Test 8: WebSocket Connection Recovery
**Purpose**: Test reconnection and message delivery after connection loss

**Steps**:
1. Login and start chatting
2. Open browser DevTools → Network tab
3. Simulate network disconnect (throttle to Offline)
4. Try sending a message
5. **Expected**: Error message or "failed" status
6. Restore network connection
7. **Expected**: WebSocket reconnects automatically
8. Send another message
9. **Expected**: Message sends successfully

**Success Criteria**:
- ✅ Error shown when WebSocket disconnected
- ✅ Auto-reconnection works
- ✅ Messages can be sent after reconnection
- ✅ No data loss

---

## Common Issues & Solutions

### Issue: Messages not appearing
**Check**:
- Backend running? Check terminal for WebSocket logs
- WebSocket connected? Check browser console for "✅ Connected to WebSocket"
- Database accessible? Check backend logs for database errors

### Issue: Duplicate messages
**Check**:
- Browser console for "⚠️ Message already exists" warnings
- Clear browser cache and reload

### Issue: New users not appearing
**Check**:
- Admin WebSocket connection active
- Backend logs show "📢 Notified inviter" message
- ManageUsers dialog is open during registration

### Issue: Messages disappear after logout
**Check**:
- Backend database connection
- Message table has entries: `SELECT * FROM messages;`
- API endpoint `/messages/conversation/{id}` returns data

---

## Debugging Tips

### Backend Logs to Watch
```bash
# Start backend with verbose logging
cd backend
python main.py
```

Look for:
- `✅ User {id} connected to WebSocket`
- `💾 Message {id} saved to database`
- `📨 Message forwarded from {sender} to {recipient}`
- `📢 Notified inviter {id} about new user`

### Browser Console Logs
Open DevTools Console and watch for:
- `🔌 Connecting to WebSocket for user...`
- `✅ WebSocket connected with authentication`
- `📨 WebSocket message received: { type: 'new_message', ... }`
- `📤 Sending WebSocket message: message`

### Database Verification
```sql
-- Check messages are being saved
SELECT id, sender_id, recipient_id, created_at 
FROM messages 
ORDER BY created_at DESC 
LIMIT 10;

-- Check contacts exist
SELECT user_id, contact_id 
FROM contacts;

-- Check users
SELECT id, email, username, role 
FROM users;
```

---

## Performance Benchmarks

### Expected Performance
- Message send to delivery: < 100ms
- Contact list refresh: < 200ms
- Conversation load (100 messages): < 500ms
- New user notification: < 50ms

### WebSocket Metrics
- Connection establishment: < 1s
- Reconnection attempts: Up to 5 times
- Ping/pong interval: 30s

---

## Test Completion Checklist

- [ ] All messages persist across sessions ✅
- [ ] Messages display immediately for both users ✅
- [ ] Page refresh doesn't lose messages ✅
- [ ] New users visible in admin dashboard instantly ✅
- [ ] Contact list updates in real-time ✅
- [ ] Offline messages delivered on login ✅
- [ ] No duplicate messages ✅
- [ ] WebSocket reconnects automatically ✅

---

## Next Steps After Testing

1. **If all tests pass**: Ready for production deployment
2. **If issues found**: Check MESSAGE_PERSISTENCE_FIXES.md for implementation details
3. **Performance issues**: Enable Redis caching for message history
4. **Scaling**: Consider implementing message pagination for large conversations

## Support

For issues or questions:
1. Check browser console for errors
2. Check backend logs for exceptions
3. Verify database connectivity
4. Review MESSAGE_PERSISTENCE_FIXES.md for architecture details
