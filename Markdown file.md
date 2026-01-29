Think of this as local-first messaging with Markdown as the canonical storage format. The goal is simple but subtle: messages live on the user’s device, not in your database, and the server—if it exists at all—never becomes a source of truth.

---

## **1\. Core idea (local-first, not server-first)**

Instead of storing messages in a centralized database:

* Each conversation is a folder

* Each message (or batch of messages) is a Markdown file

* The user’s device is the system of record

* Servers act only as relays, not storage

This is the same philosophy used by Git, Obsidian Sync, and some serious secure messengers.

---

## **2\. On-device data model (Markdown-centric)**

### **Folder layout (per user)**

/QuChat/  
  /conversations/  
    /chat-uuid-123/  
      meta.json  
      2026-01-27.md  
      2026-01-28.md

* meta.json → participants, public keys, settings

* .md files → append-only message logs per day (or per session)

Markdown is human-readable, diffable, and resilient.

---

## **3\. Message format inside Markdown**

Each message is a signed, timestamped block, not free text.

\---  
id: msg-8f31  
from: userA  
to: userB  
timestamp: 2026-01-27T12:04:11Z  
sig: BASE64\_DILITHIUM\_SIGNATURE  
\---

Hello, this is a message.

\!\[attachment\](attachments/sha256-abc123.bin)

Why this matters:

* Tamper-evident

* Auditable

* Verifiable long after delivery

* Easy to encrypt as a whole file or per block

---

## **4\. Encryption model (no central DB needed)**

### **At rest (device)**

* Entire conversation folder encrypted

* OS keystore–derived key

* Optional Kyber-based rekeying for device migration

### **In transit (between users)**

* Session key per message batch

* Kyber → derive symmetric key

* Encrypt Markdown file or message block

* Sign with Dilithium

Servers only see opaque blobs.

---

## **5\. Sync without a centralized database**

This is the tricky, interesting part.

### **Option A — Relay-only server (recommended)**

Server responsibilities:

* Temporary message relay

* No long-term storage

* No indexing

* No search

* TTL-based deletion

Client responsibilities:

* Acknowledge receipt

* Persist locally

* Verify signature

* Append to Markdown log

This avoids becoming a data custodian.

---

### **Option B — Peer-to-peer sync**

* Direct device-to-device sync when online

* Fallback to relay server if offline

* Use message hashes for deduplication

Harder, but philosophically pure.

---

## **6\. Conflict handling (inevitable reality)**

Because storage is local-first:

* Messages are append-only

* Ordering is logical (timestamp \+ hash)

* Conflicts don’t overwrite—both versions persist

This is CRDT-lite without the pain.

---

## **7\. Attachments (no blob DB)**

Attachments are:

* Content-addressed (hash-based)

* Stored locally

* Referenced in Markdown

* Encrypted separately

attachments/  
  sha256-abc123.bin

No database blobs. No surprises.

---

## **8\. Deleting messages (honest constraints)**

You can:

* Delete locally

* Stop re-syncing deleted messages

You cannot:

* Retroactively delete from other devices

The system should be honest about this.

---

## **9\. Why Markdown works unusually well here**

* Text-based → survives corruption

* Diffable → enables verification

* Future-proof → readable in 20 years

* Friendly to encryption and signatures

Markdown is doing quiet, serious work here.

---

## **10\. What you explicitly avoid**

By design, you avoid:

* Centralized message databases

* Server-side indexing

* Provider trust

* Surveillance-by-default architectures

The server becomes infrastructure, not authority.

---

## **Bottom line**

You’re building a local-first, cryptographically verifiable messaging system where Markdown is the durable log and the user’s device is the truth.

That’s not just avoiding centralization—it’s rejecting it at the architectural level.

