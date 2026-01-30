# Phase 3 Quick Start Guide

## Starting the Relay Server

### 1. Backend Setup

```powershell
# Navigate to backend directory
cd "f:\Intersnhip project\messsaging-app\backend"

# Activate virtual environment
& "f:\Intersnhip project\messsaging-app\.venv-1\Scripts\Activate.ps1"

# Start the server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8001
```

**Expected startup logs:**
```
🚀 Application starting...
✅ Database initialized
✅ Email queue initialized
🚀 Email queue worker started
📬 Relay service started (TTL-based auto-cleanup enabled)
```

### 2. Verify Relay Service

Open browser to: `http://localhost:8001/docs`

**New endpoints available:**
- `POST /api/v1/relay/send` - Send relay message
- `POST /api/v1/relay/acknowledge` - ACK message  
- `GET /api/v1/relay/pending` - Fetch pending messages
- `GET /api/v1/relay/stats` - Relay statistics
- `POST /api/v1/relay/cleanup` - Manual cleanup

### 3. Frontend Setup

```bash
# Navigate to project root
cd "f:\Intersnhip project\messsaging-app"

# Install dependencies (if needed)
npm install

# Start frontend
npm run dev
```

Frontend will automatically:
- Connect to relay service via WebSocket
- Fetch pending messages on connect
- ACK messages after saving to IndexedDB

---

## Testing the Relay System

### Test 1: Check Relay Stats

```bash
# Login first to get token
curl -X POST http://localhost:8001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password"}'

# Get stats (use token from login)
curl -X GET http://localhost:8001/api/v1/relay/stats \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Expected response:**
```json
{
  "success": true,
  "stats": {
    "total_messages": 0,
    "deliverable_messages": 0,
    "expired_messages": 0,
    "acknowledged_messages": 0,
    "online_users": 1,
    "unique_recipients": 0
  }
}
```

### Test 2: Send Relay Message

```javascript
// In browser console
const relayClient = await import('/src/lib/relayClient.ts');
const result = await relayClient.relayClient.sendMessage(
  'recipient-user-id',
  'encrypted-content-here',
  'encrypted-session-key-here'
);
console.log(result);
```

**Expected:**
```json
{
  "success": true,
  "message_id": "uuid-here",
  "status": "delivered" // or "queued" if offline
  "expires_at": "2026-02-06T12:00:00Z"
}
```

### Test 3: Check IndexedDB

1. Open DevTools → Application → IndexedDB
2. Find `QuChatDB` → `messages`
3. Verify messages have crypto metadata:
   - `cryptoVersion`
   - `encryptionAlgorithm`
   - `kdfAlgorithm`
   - `signatures` (optional)

---

## Monitoring Relay Queue

### Live Stats Dashboard

```javascript
// Add to your React component
const [stats, setStats] = useState(null);

useEffect(() => {
  const interval = setInterval(async () => {
    const data = await relayClient.getStats();
    setStats(data);
  }, 5000); // Update every 5s
  
  return () => clearInterval(interval);
}, []);
```

### Manual Cleanup

```bash
curl -X POST http://localhost:8001/api/v1/relay/cleanup \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "deleted_count": 5  // Number of expired messages deleted
}
```

---

## Troubleshooting

### Issue: Messages not delivered

**Check:**
1. Is relay service running? `GET /relay/stats`
2. Is recipient online? Check `online_users` count
3. Is message expired? Check `expires_at`

**Solution:**
```python
# Check relay queue
stats = relay_service.get_stats()
print(stats)

# Check specific user's pending messages
pending = relay_service.get_pending_messages('user-id')
print(pending)
```

### Issue: Messages not acknowledged

**Check:**
1. Did client save to IndexedDB successfully?
2. Is network connection stable?
3. Check browser console for errors

**Solution:**
- Client retries ACK automatically on reconnect
- Server tolerates duplicate ACKs (idempotent)

### Issue: Memory usage growing

**Check:**
1. Are expired messages being cleaned up?
2. Is cleanup task running?
3. Check relay stats for expired count

**Solution:**
```python
# Trigger manual cleanup
relay_service.cleanup_expired_messages()

# Or via API
POST /api/v1/relay/cleanup
```

---

## Configuration

### Adjust TTL

Edit `backend/app/services/relay_service.py`:
```python
relay_service = RelayService(
    default_ttl_days=3,  # Change from 7 to 3
    cleanup_interval_seconds=1800  # Run every 30 min
)
```

### Adjust Cleanup Frequency

```python
relay_service = RelayService(
    default_ttl_days=7,
    cleanup_interval_seconds=600  # Run every 10 min
)
```

---

## Next Steps

1. ✅ Test relay message flow
2. ✅ Verify acknowledgments work
3. ✅ Monitor relay queue stats
4. ✅ Test offline message recovery
5. ✅ Check TTL expiry behavior
6. 📝 Plan migration from database storage (if needed)
7. 🚀 Deploy to production

---

## Production Checklist

- [ ] Set appropriate TTL for your use case
- [ ] Configure cleanup interval for your load
- [ ] Set up monitoring for relay stats
- [ ] Plan Redis migration for multi-server setup
- [ ] Document backup strategy for users
- [ ] Test reconnection scenarios
- [ ] Verify ACK failure handling
- [ ] Load test relay queue capacity

**You're ready to use the relay server! 🎉**
