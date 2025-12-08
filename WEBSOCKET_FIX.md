# WebSocket Configuration Fix Summary

## Issues Found and Fixed

### 1. **Wrong WebSocket URL**
- **Before**: `ws://localhost:8000/ws?token=${token}`
- **After**: `ws://127.0.0.1:8001/ws/${userId}`

### 2. **Incorrect URL Format**
- **Before**: Using query parameter format `/ws?token=...`
- **After**: Using path parameter format `/ws/{user_id}` (matches backend)

### 3. **Wrong Authentication Approach**
- **Before**: Using dummy token in URL
- **After**: Using actual user ID from authenticated user

## Files Modified

### 1. `src/lib/websocket.ts`
```typescript
// Changed connect method signature
public connect(userId: string): Promise<void>  // was: token: string

// Updated WebSocket URL
const wsUrl = `ws://127.0.0.1:8001/ws/${userId}`;  // was: ws://localhost:8000/ws?token=${token}

// Updated reconnect to use userId
private handleReconnect(userId: string)  // was: token: string
```

### 2. `src/context/ChatContext.tsx`
```typescript
// Removed dummy token, using real user ID
wsRef.current.connect(user.id)  // was: connect('demo-token-' + user.id)
```

## Backend WebSocket Configuration (Already Correct)

### Endpoint: `/ws/{user_id}`
```python
@app.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str):
    await manager.connect(websocket, user_id)
    # Send connection confirmation
    await websocket.send_json({
        "type": "connection_established",
        "user_id": user_id,
        "timestamp": ...
    })
```

### Message Types Supported:
1. **new_message** - Send message to recipient
   ```json
   {
     "type": "new_message",
     "payload": {
       "recipient_id": "user-123",
       "content": "Hello!"
     }
   }
   ```

2. **typing** - Typing indicator
   ```json
   {
     "type": "typing",
     "payload": {
       "recipient_id": "user-123",
       "is_typing": true
     }
   }
   ```

3. **contact_added** - Notify new contact
   ```json
   {
     "type": "contact_added",
     "payload": {
       "contact_id": "user-123"
     }
   }
   ```

## Testing

### Method 1: HTML Test Page
1. Open `backend/websocket_test.html` in browser
2. Enter a user ID (e.g., "test-user-123")
3. Click "Connect"
4. You should see "✅ WebSocket connected successfully!"
5. Try sending a test message

### Method 2: Browser Console
```javascript
// In browser console:
const ws = new WebSocket('ws://127.0.0.1:8001/ws/my-user-id');
ws.onopen = () => console.log('Connected!');
ws.onmessage = (e) => console.log('Message:', e.data);
ws.send(JSON.stringify({
  type: 'new_message',
  payload: { recipient_id: 'other-user', content: 'Hello!' }
}));
```

### Method 3: In React App
Once you login, the WebSocket will automatically connect using your user ID. Check the browser console for:
- "Connected to WebSocket" - connection successful
- Any error messages if connection fails

## Next Steps

1. **Test in the React app**:
   - Login with a user account
   - Open browser DevTools console
   - Look for "Connected to WebSocket" message

2. **Test messaging between two users**:
   - Open two browser windows
   - Login with different users in each
   - Send a message from one to the other
   - Check if the message is received in real-time

3. **Monitor backend logs**:
   - Check the terminal running `python main.py`
   - Look for WebSocket connection logs:
     - "User {user_id} connected to WebSocket"
     - "WebSocket message from {user_id}: {message_type}"
     - "Message forwarded from {sender} to {recipient}"

## Common Issues

1. **Connection Refused**: Make sure backend is running on port 8001
2. **401 Unauthorized**: User must be logged in with valid user ID
3. **No messages received**: Both sender and recipient must be connected to WebSocket

## Configuration Summary

- **Backend URL**: http://127.0.0.1:8001
- **WebSocket URL**: ws://127.0.0.1:8001/ws/{user_id}
- **CORS**: Enabled for all origins in development
- **Frontend**: Automatically connects on user login
