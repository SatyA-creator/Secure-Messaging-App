# LOCAL-FIRST MESSAGING IMPLEMENTATION GUIDE

## PHASE 1: LOCAL STORAGE LAYER (2 weeks)

### Files to Create:

#### 1. src/lib/localStore.ts (NEW)
**Purpose:** IndexedDB wrapper for local message storage

```typescript
// Create database schema
interface LocalMessage {
  id: string;
  conversationId: string;
  from: string;
  to: string;
  timestamp: string;
  content: string;
  signature?: string;
  synced: boolean;
}

// Methods needed:
- saveMessage(msg: LocalMessage)
- getConversation(conversationId: string)
- getAllConversations()
- markAsSynced(messageId: string)
```

**Implementation Steps:**
1. Install Dexie.js: `npm install dexie`
2. Create IndexedDB schema
3. Implement CRUD operations
4. Add message versioning

---

#### 2. src/lib/markdownSerializer.ts (NEW)
**Purpose:** Convert messages to/from Markdown format

```typescript
// Convert message object to Markdown block
function messageToMarkdown(msg: Message): string {
  return `---
id: ${msg.id}
from: ${msg.from}
to: ${msg.to}
timestamp: ${msg.timestamp}
sig: ${msg.signature || 'UNSIGNED'}
---

${msg.content}

${msg.attachments ? attachmentsToMarkdown(msg.attachments) : ''}
`;
}

// Parse Markdown back to message object
function markdownToMessage(md: string): Message
```

**Steps:**
1. Install: `npm install gray-matter` (for frontmatter parsing)
2. Implement message→MD conversion
3. Implement MD→message parsing
4. Handle attachments as references

---

#### 3. Modify: src/context/ChatContext.tsx
**Changes:**
- Before: Stores messages in React state, fetches from API
- After: Stores in IndexedDB, React state is just a view

```typescript
// ADD: Local storage hook
const localStore = useLocalStore();

// MODIFY: sendMessage function
const sendMessage = async (recipientId: string, content: string) => {
  // 1. Save to IndexedDB FIRST
  const msg = await localStore.saveMessage({
    conversationId: recipientId,
    content,
    from: user.id,
    to: recipientId,
    synced: false
  });
  
  // 2. Update UI optimistically
  setMessages(prev => [...prev, msg]);
  
  // 3. Send to server as relay (non-blocking)
  wsRef.current.send('relay_message', msg);
};

// ADD: Load from local on mount
useEffect(() => {
  const loadLocal = async () => {
    const localMsgs = await localStore.getConversation(selectedContactId);
    setMessages(localMsgs);
  };
  loadLocal();
}, [selectedContactId]);
```

---

### Testing Phase 1:
- ✅ Messages persist in browser (survive refresh)
- ✅ Work offline (save locally, sync later)
- ✅ Markdown export works

---

## PHASE 2: CRYPTO LAYER (2-3 weeks)

### Files to Create:

#### 4. src/lib/crypto/postQuantum.ts (NEW)
**Purpose:** Kyber + Dilithium implementation

**Challenge:** Browser crypto APIs don't support post-quantum yet!

**Solutions:**
1. Use WebAssembly library: `pqc-kyber`, `dilithium-crystals`
2. OR use libsodium (classical crypto first, PQ later)

```typescript
// Key generation
async function generateKeyPair() {
  // Kyber for encryption
  const kyberKeys = await kyber.generateKeyPair();
  
  // Dilithium for signatures
  const dilithiumKeys = await dilithium.generateKeyPair();
  
  return { kyberKeys, dilithiumKeys };
}

// Encrypt message
async function encryptMessage(plaintext: string, recipientPublicKey: string)

// Sign message
async function signMessage(content: string, privateKey: string)
```

**Steps:**
1. Research: Choose WebAssembly PQ library
2. Implement key generation
3. Implement encryption/decryption
4. Implement signing/verification
5. Store keys in browser's crypto storage

---

#### 5. Modify: src/context/AuthContext.tsx
**Add key management:**

```typescript
// Generate keys on registration
const register = async (email: string, password: string) => {
  // Existing registration...
  
  // NEW: Generate PQ keys
  const { kyberKeys, dilithiumKeys } = await generateKeyPair();
  
  // Store public keys on server (for discovery)
  await api.post('/users/keys', {
    kyber_public: kyberKeys.public,
    dilithium_public: dilithiumKeys.public
  });
  
  // Store private keys locally (encrypted with device key)
  await secureStore.saveKeys(kyberKeys.private, dilithiumKeys.private);
};
```

---

## PHASE 3: SERVER AS RELAY (1 week)

### Files to Modify:

#### 6. backend/app/routes/ws.py
**Transform from storage to relay:**

```python
@router.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str):
    # REMOVE: Database saves
    # db_message = Message(...)
    # db.add(db_message)
    
    # KEEP: Only relay
    await manager.send_personal_message(recipient_id, {
        "type": "relay_message",
        "payload": encrypted_blob,  # Don't decrypt server-side
        "from": sender_id,
        "ttl": 3600  # Delete after 1 hour
    })
```

**Key changes:**
- ❌ Remove all `db.add()` for messages
- ❌ Remove message storage
- ✅ Keep relay functionality
- ✅ Add TTL (auto-delete after delivery)

---

#### 7. backend/app/api/messages.py
**Remove or minimize:**

```python
# DELETE: /send endpoint (no longer needed)
# DELETE: /conversation/{id} endpoint

# KEEP: Only for public key exchange
@router.get("/users/{user_id}/public_key")
async def get_public_key(user_id: str):
    user = db.query(User).filter(User.id == user_id).first()
    return {
        "kyber_public": user.kyber_public_key,
        "dilithium_public": user.dilithium_public_key
    }
```

---

## PHASE 4: MARKDOWN PERSISTENCE (1 week)

#### 8. src/lib/conversationStore.ts (NEW)
**Purpose:** Organize messages into Markdown files

```typescript
// Structure in IndexedDB:
/conversations/
  chat-{uuid}/
    meta.json
    2026-01-27.md
    2026-01-28.md

// Export conversation to Markdown
async function exportConversation(conversationId: string) {
  const messages = await localStore.getConversation(conversationId);
  const grouped = groupByDate(messages);
  
  for (const [date, msgs] of grouped) {
    const markdown = msgs.map(messageToMarkdown).join('\n\n---\n\n');
    await saveMarkdownFile(`${date}.md`, markdown);
  }
}

// Import Markdown (for device migration)
async function importMarkdown(markdownFile: string)
```

---

## PHASE 5: SYNC MECHANISM (2 weeks)

#### 9. src/lib/sync.ts (NEW)
**Purpose:** Sync between devices without server storage

```typescript
// Check for unsynced messages
async function syncPendingMessages() {
  const pending = await localStore.getUnsynced();
  
  for (const msg of pending) {
    try {
      await wsRef.current.send('relay_message', msg);
      await localStore.markAsSynced(msg.id);
    } catch (error) {
      // Retry later
    }
  }
}

// Handle incoming messages
function handleIncomingMessage(payload: any) {
  // 1. Verify signature
  const valid = await verifySignature(payload);
  
  // 2. Save locally
  await localStore.saveMessage(payload);
  
  // 3. Update UI
  setMessages(prev => [...prev, payload]);
}
```

---

## FILES SUMMARY

### **NEW FILES (9 files):**
1. `src/lib/localStore.ts` - IndexedDB wrapper
2. `src/lib/markdownSerializer.ts` - MD conversion
3. `src/lib/crypto/postQuantum.ts` - Kyber + Dilithium
4. `src/lib/crypto/keyManager.ts` - Key storage
5. `src/lib/conversationStore.ts` - Folder structure
6. `src/lib/sync.ts` - Sync logic
7. `src/lib/attachments.ts` - Content-addressed storage
8. `src/components/ExportConversation.tsx` - MD export UI
9. `backend/app/services/relay_service.py` - Relay-only logic

### **MODIFIED FILES (5 files):**
1. `src/context/ChatContext.tsx` - Use local storage
2. `src/context/AuthContext.tsx` - Add key generation
3. `backend/app/routes/ws.py` - Remove DB, keep relay
4. `backend/app/api/messages.py` - Minimal endpoints
5. `backend/app/models/user.py` - Add public key fields

### **DELETED/DEPRECATED:**
- `backend/app/models/message.py` - No longer needed
- `backend/app/api/messages.py` - Most endpoints removed
- Database migrations for messages table

---

## DEPENDENCIES TO ADD

```bash
# Frontend
npm install dexie gray-matter @noble/post-quantum

# Backend (minimal changes)
pip install # (no new deps, remove SQLAlchemy message models)
```

---

## TESTING CHECKLIST

- [ ] Messages save locally (survive browser refresh)
- [ ] Work offline (queue for sync)
- [ ] Markdown export produces valid files
- [ ] Signatures verify correctly
- [ ] Encryption/decryption works
- [ ] Multi-device sync works
- [ ] Attachments are content-addressed
- [ ] Server doesn't store messages
- [ ] TTL deletion works

---

## MIGRATION STRATEGY

**Don't rebuild everything at once!**

1. **Keep current system running**
2. **Add local storage as optional feature**
3. **Test with beta users**
4. **Gradual rollout**
5. **Deprecate server storage after validation**

---

## RISKS & CHALLENGES

1. **Browser storage limits** (IndexedDB ~1GB)
2. **No post-quantum libs mature yet** (may need to wait)
3. **Complex sync logic** (conflicts, ordering)
4. **User education** (local-first is unfamiliar)
5. **Backup/restore** (users responsible for data)

---

## MY RECOMMENDATION

**Phase 1 Only:** Start with local storage + Markdown export as a **feature**, not a replacement.

This lets users:
- Export conversations to Markdown
- Keep local backups
- Work offline

**Then gradually** add crypto and relay-only server.

Would you like me to implement Phase 1 (local storage layer) first?
