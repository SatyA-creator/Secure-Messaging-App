# Supabase Database Fix Guide

## Error: "column contacts.contact_id does not exist"

Your Supabase database schema needs to be updated to match the Contact model.

## 🔧 Quick Fix for Supabase

### Option 1: Supabase SQL Editor (Easiest ⭐)

1. **Go to your Supabase Dashboard**
   - Navigate to: https://supabase.com/dashboard/project/YOUR_PROJECT_ID
   - Click on **SQL Editor** in the left sidebar

2. **Create a new query and paste this SQL:**

```sql
-- Fix contacts table schema
-- Add contact_id column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'contacts' AND column_name = 'contact_id'
    ) THEN
        ALTER TABLE contacts ADD COLUMN contact_id UUID;
        ALTER TABLE contacts ADD CONSTRAINT fk_contacts_contact_id 
            FOREIGN KEY (contact_id) REFERENCES users(id) ON DELETE CASCADE;
        RAISE NOTICE 'Added contact_id column';
    ELSE
        RAISE NOTICE 'contact_id column already exists';
    END IF;
END $$;

-- Add nickname column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'contacts' AND column_name = 'nickname'
    ) THEN
        ALTER TABLE contacts ADD COLUMN nickname VARCHAR(255);
        RAISE NOTICE 'Added nickname column';
    ELSE
        RAISE NOTICE 'nickname column already exists';
    END IF;
END $$;

-- Add unique constraint
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'unique_contact_pair'
    ) THEN
        ALTER TABLE contacts ADD CONSTRAINT unique_contact_pair 
            UNIQUE (user_id, contact_id);
        RAISE NOTICE 'Added unique constraint';
    ELSE
        RAISE NOTICE 'unique_contact_pair constraint already exists';
    END IF;
END $$;

-- Add role column to users table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'role'
    ) THEN
        ALTER TABLE users ADD COLUMN role VARCHAR(20) DEFAULT 'user' NOT NULL;
        RAISE NOTICE 'Added role column';
        
        -- Make first user an admin
        UPDATE users SET role = 'admin' 
        WHERE id = (SELECT id FROM users ORDER BY created_at LIMIT 1);
        RAISE NOTICE 'Set first user as admin';
    ELSE
        RAISE NOTICE 'role column already exists';
    END IF;
END $$;

-- Verify the changes
SELECT 'contacts table:' as info;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'contacts'
ORDER BY ordinal_position;

SELECT 'users table - role column:' as info;
SELECT id, email, username, role FROM users LIMIT 5;
```

3. **Click "Run" or press Ctrl+Enter**
4. **Check the results** - You should see success messages

### Option 2: Using psql with Supabase Connection String

1. **Get your Supabase connection string:**
   - Supabase Dashboard → Project Settings → Database
   - Copy the **Connection string** (URI format)
   - It looks like: `postgresql://postgres:[YOUR-PASSWORD]@db.xxx.supabase.co:5432/postgres`

2. **Connect and run the SQL:**

```bash
# Connect to Supabase database
psql "postgresql://postgres:[YOUR-PASSWORD]@db.xxx.supabase.co:5432/postgres"

# Then paste the SQL from Option 1 above
```

### Option 3: Run Migration from Railway (If configured)

If you've set up Alembic with your Supabase DATABASE_URL:

1. **In Railway Dashboard:**
   - Go to your backend service
   - Variables → Add `DATABASE_URL` = Your Supabase connection string

2. **Update your Railway start command:**
```bash
alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

3. **Redeploy** - Railway will run migrations against Supabase

## 🔍 Verify the Fix

After running the SQL, verify in Supabase:

1. **Go to Table Editor in Supabase Dashboard**
2. **Check `contacts` table** - Should have these columns:
   - `id` (uuid)
   - `user_id` (uuid)
   - `contact_id` (uuid) ← **This should now exist**
   - `nickname` (varchar)
   - `created_at` (timestamp)

3. **Check `users` table** - Should have these columns including:
   - `role` (varchar) ← **Should be added**

## ✅ After Fixing

1. **Redeploy your Railway backend** (to pick up new schema)
2. **Clear browser cache/localStorage:**
   ```javascript
   localStorage.clear()
   location.reload()
   ```
3. **Test the invitation flow:**
   - Send invitation
   - Accept invitation
   - Verify contacts are created
   - Check role-based features work

## 🚀 Configure Railway with Supabase

Make sure your Railway backend has the correct DATABASE_URL:

### Railway Environment Variables:

```env
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres

# Other required variables
JWT_SECRET_KEY=your-secret-key
RESEND_API_KEY=your-resend-key
FRONTEND_URL=https://your-frontend.vercel.app
```

### Important Notes:

1. **Connection Pooling**: Supabase uses connection pooling. Use the **Transaction** mode connection string for migrations:
   ```
   postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:6543/postgres
   ```
   Note the port `6543` for pooling.

2. **Direct Connection**: For running migrations, you might need the direct connection (port `5432`):
   ```
   postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
   ```

## 📋 Complete Setup Checklist

- [ ] Run SQL in Supabase SQL Editor (Option 1)
- [ ] Verify columns exist in Supabase Table Editor
- [ ] Update Railway DATABASE_URL to Supabase connection string
- [ ] Redeploy Railway backend
- [ ] Test invitation acceptance
- [ ] Verify role-based access works
- [ ] Check that contacts are created properly

## 🐛 Troubleshooting Supabase + Railway

### Issue: "Too many connections"
**Solution**: Use Supabase's connection pooler (port 6543) in Railway:
```env
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:6543/postgres
```

### Issue: "SSL required"
**Solution**: Add `?sslmode=require` to connection string:
```env
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres?sslmode=require
```

### Issue: Migration fails with "permission denied"
**Solution**: Make sure you're using the `postgres` user credentials from Supabase, not the anon key.

### Issue: Changes not reflected after deployment
**Solution**: 
1. Clear Railway build cache
2. Restart Railway service
3. Clear browser localStorage
4. Hard refresh (Ctrl+Shift+R)

## 📝 Related Files

- SQL Fix: `backend/fix_contacts_schema.sql`
- Migration: `backend/migrations/versions/fix_contacts_table_schema.py`
- Migration: `backend/migrations/versions/add_user_role_column.py`

---

**After applying this fix in Supabase, your Railway deployment will work correctly!** ✅

## 🔗 Quick Links

- [Supabase Dashboard](https://supabase.com/dashboard)
- [Railway Dashboard](https://railway.app/dashboard)
- [Supabase Database Settings](https://supabase.com/dashboard/project/_/settings/database)
