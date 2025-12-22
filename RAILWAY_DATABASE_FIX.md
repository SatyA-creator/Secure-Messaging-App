# Railway PostgreSQL Database Fix Guide

## ⚠️ Note: This guide is for Railway's built-in PostgreSQL

**If you're using Supabase for your database, see [SUPABASE_DATABASE_FIX.md](SUPABASE_DATABASE_FIX.md) instead.**

## Error: "column contacts.contact_id does not exist"

This error occurs when the production database schema doesn't match the Contact model.

## 🔧 Quick Fix for Railway

### Option 1: Run Migration via Railway CLI

1. **Connect to Railway database:**
```bash
# Install Railway CLI if not already installed
npm i -g @railway/cli

# Login to Railway
railway login

# Link to your project
railway link

# Open database shell
railway run psql $DATABASE_URL
```

2. **Run the fix SQL:**
```sql
-- Copy and paste this entire block

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
    END IF;
END $$;

-- Verify
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'contacts' ORDER BY ordinal_position;
```

### Option 2: Run Alembic Migration in Railway

1. **Update your Railway service:**

Add this to your Railway service environment variables:
```
RUN_MIGRATIONS=true
```

2. **Update your Dockerfile or start command:**

If using Dockerfile, add before starting the app:
```dockerfile
# Run migrations
RUN alembic upgrade head
```

If using start command in `railway.toml` or Railway dashboard:
```bash
alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

3. **Redeploy the service** - Railway will run migrations automatically

### Option 3: Direct Database Connection (TablePlus/pgAdmin)

1. Get your Railway database connection string from Railway dashboard
2. Connect using your preferred PostgreSQL client
3. Run the SQL from `backend/fix_contacts_schema.sql`

## 🚀 After Fixing

1. **Restart your Railway backend service**
2. **Test the invitation flow:**
   - Send an invitation
   - Accept the invitation
   - Check if contacts are created

## 📋 Verify Fix

Check if the columns exist:
```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'contacts'
ORDER BY ordinal_position;
```

Expected output:
```
column_name  | data_type                  | is_nullable
-------------+----------------------------+-------------
id           | uuid                       | NO
user_id      | uuid                       | NO
contact_id   | uuid                       | YES
nickname     | character varying          | YES
created_at   | timestamp without time zone| YES
```

## 🔍 Understanding the Issue

The production database had an outdated schema where the `contacts` table was missing the `contact_id` column. This happens when:

1. Database was created before the Contact model was finalized
2. Migrations weren't run in production
3. Schema drift between local and production

## ⚠️ Prevention

To prevent this in future:

1. **Always run migrations in production:**
   ```bash
   railway run alembic upgrade head
   ```

2. **Add migration command to deployment:**
   - Update start command to run migrations first
   - Use Railway's build/deploy hooks

3. **Version control your migrations:**
   - Commit all Alembic migration files
   - Keep migrations in sync across environments

## 🆘 If Still Having Issues

1. **Check Railway logs:**
   ```bash
   railway logs
   ```

2. **Verify database connection:**
   ```bash
   railway run python -c "from app.database import engine; print(engine.url)"
   ```

3. **Check Alembic version:**
   ```bash
   railway run alembic current
   ```

4. **Run migration manually:**
   ```bash
   railway run alembic upgrade head
   ```

## 📝 Related Files

- Migration: `backend/migrations/versions/fix_contacts_table_schema.py`
- SQL Script: `backend/fix_contacts_schema.sql`
- Model: `backend/app/models/contact.py`

---

**After applying this fix, your invitation acceptance should work correctly!** ✅
