# Phase 2 Implementation - Migration Instructions

## Overview
All code changes for Post-Quantum cryptography readiness have been implemented. Now you need to apply the database migration to update your schema.

---

## ⚠️ IMPORTANT: Pre-Migration Checklist

Before running the migration, ensure:

1. **Backup your database** (if in production)
2. **Close all active connections** to the database
3. **Stop the backend server** if running
4. **Commit your current code** to version control

---

## Step-by-Step Migration Process

### Step 1: Activate Virtual Environment

```powershell
# From project root
& "f:\Intersnhip project\messsaging-app\.venv-1\Scripts\Activate.ps1"
```

### Step 2: Navigate to Backend Directory

```powershell
cd backend
```

### Step 3: Check Current Migration Status

```powershell
& "f:\Intersnhip project\messsaging-app\.venv-1\Scripts\python.exe" -m alembic current
```

This shows your current migration state.

### Step 4: Review Pending Migrations

```powershell
& "f:\Intersnhip project\messsaging-app\.venv-1\Scripts\python.exe" -m alembic heads
```

You should see the new migration: `b56533ee5f8d` (Add crypto agility fields)

### Step 5: Apply the Migration

```powershell
& "f:\Intersnhip project\messsaging-app\.venv-1\Scripts\python.exe" -m alembic upgrade head
```

**Expected output:**
```
INFO  [alembic.runtime.migration] Running upgrade 438b2179bf8b -> b56533ee5f8d, Add crypto agility fields for PQ readiness
```

### Step 6: Verify Migration Success

```powershell
& "f:\Intersnhip project\messsaging-app\.venv-1\Scripts\python.exe" -m alembic current
```

Should show: `b56533ee5f8d (head)`

---

## What the Migration Does

### 1. **Messages Table Changes:**
   - Adds `crypto_version` column (default: "v1")
   - Adds `encryption_algorithm` column (default: "ECDH-AES256-GCM")
   - Adds `kdf_algorithm` column (default: "HKDF-SHA256")
   - Adds `signatures` column (JSON array, nullable)

### 2. **Users Table Changes:**
   - Creates new `public_keys` column (JSON array)
   - Migrates existing `public_key` data to new format:
     ```json
     [{
       "key_id": "legacy-key-<user_id>",
       "algorithm": "SECP256R1",
       "key_data": "<base64_encoded_key>",
       "created_at": "<timestamp>",
       "status": "active"
     }]
     ```
   - Drops old `public_key` column

---

## After Migration

### 1. **Verify Data Integrity**

Connect to your database and run:

```sql
-- Check messages have crypto metadata
SELECT id, crypto_version, encryption_algorithm, kdf_algorithm 
FROM messages 
LIMIT 5;

-- Check users have public_keys array
SELECT id, username, jsonb_array_length(public_keys) as key_count
FROM users 
LIMIT 5;
```

### 2. **Start Backend Server**

```powershell
cd backend
uvicorn app.main:app --reload
```

### 3. **Test the Application**

- Register a new user
- Send a message
- Verify export/import works
- Check that old messages are still readable

---

## If Something Goes Wrong

### Rollback the Migration

```powershell
& "f:\Intersnhip project\messsaging-app\.venv-1\Scripts\python.exe" -m alembic downgrade -1
```

This will:
- Remove crypto metadata columns from messages
- Restore `public_key` column in users table
- Convert `public_keys` back to `public_key`

### Common Issues

**Issue:** `sqlalchemy.exc.ProgrammingError: column "public_keys" does not exist`
- **Solution:** Run the upgrade migration again

**Issue:** `Multiple heads are present`
- **Solution:** Run the merge migration first (already done)

**Issue:** `Can't locate revision identified by 'b56533ee5f8d'`
- **Solution:** Make sure you're in the backend directory

---

## Validation Checklist

After migration, verify:

- [ ] Backend starts without errors
- [ ] Can register new users
- [ ] Can send messages
- [ ] Can retrieve conversation history
- [ ] Export to Markdown includes crypto metadata
- [ ] Import from Markdown preserves crypto metadata
- [ ] No database errors in logs

---

## Next: Start Phase 3

Once migration is complete and validated, you can begin Phase 3 (actual Post-Quantum implementation) with confidence that:

✅ All existing data is preserved  
✅ No breaking changes occurred  
✅ System is ready for hybrid cryptography  
✅ Messages carry algorithm metadata  
✅ Keys are versioned and rotatable  

**You're ready to proceed! 🚀**
