# Render Deployment - Supabase IPv4 Connection Fix

## Root Cause
**Supabase Direct Connection is IPv6 only**, but **Render requires IPv4**!

```
❌ Direct Connection (port 5432) = IPv6 only → Won't work with Render
✅ Session Pooler (port 6543) = IPv4 compatible → Use this!
```

## ✅ SOLUTION: Use Session Pooler with Correct Settings

### Step 1: Get Session Pooler Connection String

1. **In Supabase Dashboard** (where you took the screenshot):
   - Click **"Pooler settings"** button
   - OR change Method dropdown from "Direct connection" to **"Session pooling"**
   - Copy the **Transaction pooling** or **Session pooling** connection string
   - It should look like: 
     ```
     postgresql://postgres.ycn1lziiknmahekkvgeg:[PASSWORD]@aws-1-ap-south-1.pooler.supabase.com:6543/postgres
     ```

### Step 2: Configure Pooler Mode

In Supabase:
- Go to **Database** → **Pooler Configuration**
- Set mode to **"Transaction"** (recommended for FastAPI/SQLAlchemy)
- Save changes

### Step 3: Update Render Environment Variables

In Render Dashboard:
```env
DATABASE_URL=postgresql://postgres.ycn1lziiknmahekkvgeg:[YOUR-PASSWORD]@aws-1-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true
DATABASE_POOL_SIZE=5
DATABASE_MAX_OVERFLOW=10
```

**Important**: Add `?pgbouncer=true` at the end of the connection string!

### Step 4: Update Backend Database Configuration

The connection was timing out because we need specific settings for PgBouncer (Supabase's pooler):

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
