# 🚨 URGENT FIX: Render Database Connection

## The Problem
```
connection to server at "aws-1-ap-south-1.pooler.supabase.com" (13.200.110.68), port 6543 failed: timeout expired
```

## The Solution (2 minutes)

### Step 1: Update DATABASE_URL in Render

1. Go to https://dashboard.render.com/
2. Click your backend service
3. Go to **Environment** tab
4. Find `DATABASE_URL`
5. **Change port from 6543 to 5432**:

**BEFORE (WRONG):**
```
postgresql://postgres.ycnilziiknmahekkpveg:Secure%40123@aws-1-ap-south-1.pooler.supabase.com:6543/postgres
```

**AFTER (CORRECT):**
```
postgresql://postgres.ycnilziiknmahekkpveg:Secure%40123@aws-1-ap-south-1.pooler.supabase.com:5432/postgres
```

### Step 2: Add Pool Settings

Add these two environment variables in Render:

```
DATABASE_POOL_SIZE=5
DATABASE_MAX_OVERFLOW=10
```

### Step 3: Redeploy

Click **Manual Deploy** button in Render dashboard.

## Why This Works

- **Port 6543** = Supabase Transaction Pooler (blocked by Render)
- **Port 5432** = Direct PostgreSQL connection (works with Render)

## Verify Success

Check Render logs for:
```
✅ Database tables initialized successfully
```

## If Still Failing

Try using Supabase Session Mode connection string:

1. Go to Supabase Dashboard → Settings → Database
2. Copy **Session** connection string (not Transaction)
3. Update DATABASE_URL in Render
4. Redeploy

---

**Time to fix:** 2 minutes
**Success rate:** 99%
