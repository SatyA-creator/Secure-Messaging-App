# Render Deployment - Supabase Connection Fix

## Problem
```
Connection timed out to aws-1-ap-south-1.pooler.supabase.com:6543
```

Render cannot connect to Supabase database due to IP restrictions.

## Solutions (Choose ONE)

### ✅ Solution 1: Enable IPv4 in Supabase (RECOMMENDED)

1. **Go to Supabase Dashboard**
   - Navigate to your project: https://supabase.com/dashboard/project/YOUR_PROJECT_ID

2. **Enable IPv4 Add-on**
   - Go to **Settings** → **Add-ons**
   - Find **"IPv4 Address"** add-on
   - Click **Enable** (This may require upgrading to paid plan)
   - This gives your database a dedicated IPv4 address that Render can connect to

3. **Update Database URL in Render**
   - After enabling IPv4, get the **Direct Connection String** (not pooler)
   - Go to Render Dashboard → Your Service → Environment
   - Update `DATABASE_URL` with the **direct connection string** (port 5432, not 6543)
   - Example: `postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres`

### ✅ Solution 2: Use Supabase Direct Connection (No Add-on Required)

1. **Get Direct Connection String from Supabase**
   - Go to **Settings** → **Database**
   - Under **Connection String**, select **URI** tab
   - Copy the **Direct Connection** string (NOT Session pooling)
   - It should look like: `postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres`

2. **Update Render Environment Variables**
   - Go to Render Dashboard → Your Service → Environment
   - Update `DATABASE_URL` with the direct connection string
   - **Important**: Make sure it uses port **5432** (direct) not **6543** (pooler)

3. **Add Connection Pooling Settings**
   - In Render, add these environment variables:
   ```
   DATABASE_POOL_SIZE=5
   DATABASE_MAX_OVERFLOW=10
   ```

### ✅ Solution 3: Whitelist Render IPs in Supabase (Free Tier Compatible)

1. **Get Render's Outbound IPs**
   - Contact Render support or check their documentation
   - Render services have specific outbound IP ranges

2. **Add IPs to Supabase**
   - Go to **Settings** → **Database** → **Connection pooling**
   - Under **Restrictions**, add Render's IP addresses
   - Or disable IP restrictions (LESS SECURE)

### ✅ Solution 4: Use Supabase REST API Instead (Alternative)

If direct database connection continues to fail, use Supabase's REST API:

1. **Get Supabase API Credentials**
   - Go to **Settings** → **API**
   - Copy `URL` and `anon` key

2. **Update Backend to Use Supabase Client**
   - Install: `pip install supabase`
   - Use Supabase Python client instead of direct PostgreSQL connection

## What I've Already Fixed

✅ **Updated `backend/app/database.py`** with:
- Connection timeout settings
- Keepalive parameters for stable connections
- Pool pre-ping to verify connections
- Connection recycling after 1 hour

## Verify the Fix

After implementing a solution, check Render logs:

```bash
# Should see this instead of timeout error:
INFO:     Database tables initialized
INFO:     Application startup complete
```

## Current Database Configuration

- **Pooler URL** (port 6543): For serverless/edge functions with many connections
- **Direct URL** (port 5432): For traditional servers like Render ✅ USE THIS

## Next Steps

1. Choose and implement one of the solutions above
2. Update `DATABASE_URL` in Render environment variables
3. Redeploy your Render service
4. Check logs to verify connection success

## Recommended Configuration for Render

```env
DATABASE_URL=postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres
DATABASE_POOL_SIZE=5
DATABASE_MAX_OVERFLOW=10
```

## Important Notes

- **Port 6543** = Session Pooler (for serverless, has IP restrictions)
- **Port 5432** = Direct Connection (for traditional servers like Render) ✅
- **IPv4 Add-on** = Required for some hosting providers, may require paid plan
- **Connection Pooling** = Important for Render to maintain stable connections
