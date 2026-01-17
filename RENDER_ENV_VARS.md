# ⚡ RENDER ENVIRONMENT VARIABLES - COPY & PASTE

## Go to Render Dashboard → Your Service → Environment

Copy and paste these EXACT values:

```bash
# DATABASE - Use Transaction Pooler (port 6543)
DATABASE_URL=postgresql://postgres.ycnilziiknmahekkpveg:Secure@123@aws-1-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connect_timeout=15

# POOL SETTINGS - CRITICAL for pgbouncer
DATABASE_POOL_SIZE=1
DATABASE_MAX_OVERFLOW=0

# ENVIRONMENT
ENVIRONMENT=production

# CORS - Add your Vercel URL
CORS_ORIGINS=https://secure-messaging-app-omega.vercel.app

# JWT
JWT_SECRET_KEY=your-super-secret-256-bit-key-change-this-in-production
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440

# EMAIL (if using Resend)
RESEND_API_KEY=your_resend_api_key_here
VERIFIED_DOMAIN=quantchat.live

# FRONTEND
FRONTEND_URL=https://secure-messaging-app-omega.vercel.app
```

## After Setting Variables

1. Click **Save Changes**
2. Click **Manual Deploy**
3. Wait for deployment (2-3 minutes)
4. Check logs for: `✅ Database initialized`

## If Still Failing

The issue is Supabase blocking Render's IPs. Solutions:

### Option 1: Enable Supabase IPv4 Add-on
- Go to Supabase Dashboard → Settings → Add-ons
- Enable "IPv4 Address" (may require paid plan)
- Update DATABASE_URL with the IPv4 address

### Option 2: Use Render PostgreSQL
- In Render Dashboard, create new PostgreSQL database
- Copy the Internal Database URL
- Update DATABASE_URL in your service
- Run migrations

### Option 3: Use Railway PostgreSQL
- Create Railway account
- Add PostgreSQL service
- Copy connection string
- Update DATABASE_URL in Render

## Verify Connection

After deployment, check Render logs:

**Success:**
```
✅ Database initialized
✅ Database tables initialized successfully
```

**Failure:**
```
❌ Database initialization failed
connection to server... timeout expired
```

If you see failure, Supabase is blocking the connection.
