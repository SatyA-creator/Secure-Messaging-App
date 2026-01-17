# 🔧 Render + Supabase Connection Fix

## Problem
Render cannot connect to Supabase pooler (port 6543) due to IP restrictions and timeout issues.

## Solution
Use Supabase **direct connection** (port 5432) instead of pooler (port 6543).

## Steps to Fix

### 1. Get Direct Connection String from Supabase

1. Go to Supabase Dashboard
2. Click on your project
3. Go to **Settings** → **Database**
4. Scroll to **Connection String**
5. Select **Connection Pooling** tab
6. Copy the **Direct Connection** string (NOT Session pooler)

It should look like:
```
postgresql://postgres.ycnilziiknmahekkpveg:[YOUR-PASSWORD]@aws-1-ap-south-1.pooler.supabase.com:5432/postgres
```

### 2. Update Render Environment Variables

1. Go to Render Dashboard
2. Select your backend service
3. Go to **Environment** tab
4. Update `DATABASE_URL` to:

```bash
# CORRECT - Direct connection (port 5432)
DATABASE_URL=postgresql://postgres.ycnilziiknmahekkpveg:Secure%40123@aws-1-ap-south-1.pooler.supabase.com:5432/postgres

# WRONG - Pooler connection (port 6543) - causes timeout
# DATABASE_URL=postgresql://postgres.ycnilziiknmahekkpveg:Secure%40123@aws-1-ap-south-1.pooler.supabase.com:6543/postgres
```

### 3. Reduce Pool Size for Render Free Tier

Add these environment variables in Render:

```bash
DATABASE_POOL_SIZE=5
DATABASE_MAX_OVERFLOW=10
```

### 4. Alternative: Use Supabase IPv4 Address

If the above doesn't work, whitelist Render's IP or use IPv4 address:

1. Get Supabase database IPv4:
   ```bash
   nslookup aws-1-ap-south-1.pooler.supabase.com
   ```

2. Use IP directly in DATABASE_URL:
   ```bash
   DATABASE_URL=postgresql://postgres.ycnilziiknmahekkpveg:Secure%40123@13.200.110.68:5432/postgres
   ```

### 5. Enable IPv4 in Supabase (Recommended)

1. Go to Supabase Dashboard
2. Settings → Database
3. Enable **IPv4 Add-on** (may require paid plan)
4. This gives you a dedicated IPv4 address

### 6. Redeploy

After updating environment variables:
1. Click **Manual Deploy** in Render
2. Or push a commit to trigger auto-deploy

## Verification

Check Render logs for:
```
✅ Database tables initialized successfully
```

Instead of:
```
❌ connection to server at "aws-1-ap-south-1.pooler.supabase.com" (13.200.110.68), port 6543 failed: timeout expired
```

## Quick Fix Summary

**Change this:**
```
DATABASE_URL=postgresql://...@aws-1-ap-south-1.pooler.supabase.com:6543/postgres
```

**To this:**
```
DATABASE_URL=postgresql://...@aws-1-ap-south-1.pooler.supabase.com:5432/postgres
```

**Key difference:** Port `6543` → `5432`

## Alternative: Use Different Database Host

If Supabase pooler continues to have issues with Render, consider:

1. **Supabase Direct Connection** (port 5432) ✅ Recommended
2. **Railway PostgreSQL** - Better compatibility with Render
3. **Render PostgreSQL** - Native integration
4. **Neon Database** - Serverless PostgreSQL with better pooling

## Testing Connection

Test from Render shell:
```bash
# In Render shell
python -c "import psycopg2; conn = psycopg2.connect('YOUR_DATABASE_URL'); print('✅ Connected')"
```

## Common Errors

### Error: "timeout expired"
- **Cause**: Using pooler port 6543 from Render
- **Fix**: Use direct port 5432

### Error: "no pg_hba.conf entry"
- **Cause**: IP not whitelisted
- **Fix**: Enable IPv4 add-on in Supabase or use connection pooling

### Error: "too many connections"
- **Cause**: Pool size too high
- **Fix**: Reduce DATABASE_POOL_SIZE to 5

## Support

If issues persist:
1. Check Render logs: `https://dashboard.render.com/`
2. Check Supabase logs: `https://supabase.com/dashboard/project/_/logs`
3. Test connection locally with same DATABASE_URL
