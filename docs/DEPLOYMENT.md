# Deployment Guide

## Overview
This guide covers deploying the messaging application to production environments.

---

## Prerequisites

### Required Accounts
- **Frontend**: Vercel account
- **Backend**: Render or Railway account
- **Database**: Supabase or Neon PostgreSQL account
- **Email**: Resend account (optional, for invitations)
- **Domain**: Custom domain (optional)

### Required Tools
- Git
- Node.js 18+
- Python 3.9+
- PostgreSQL client (for local testing)

---

## Database Setup (PostgreSQL)

### Option 1: Supabase

1. **Create Project**
   - Go to https://supabase.com
   - Create new project
   - Choose region close to your users
   - Set strong database password

2. **Get Connection String**
   - Go to Project Settings → Database
   - Copy "Connection string" (URI format)
   - Use **Transaction Pooler** (port 6543) for production
   - Format: `postgresql://user:password@host:6543/postgres?pgbouncer=true`

3. **Run Migrations**
   ```bash
   cd backend
   export DATABASE_URL="your-supabase-connection-string"
   alembic upgrade head
   ```

### Option 2: Neon

1. **Create Project**
   - Go to https://neon.tech
   - Create new project
   - Choose region

2. **Get Connection String**
   - Copy connection string from dashboard
   - Format: `postgresql://user:password@host/database?sslmode=require`

3. **Run Migrations**
   ```bash
   cd backend
   export DATABASE_URL="your-neon-connection-string"
   alembic upgrade head
   ```

---

## Backend Deployment

### Option 1: Render

1. **Create Web Service**
   - Go to https://render.com
   - New → Web Service
   - Connect GitHub repository
   - Select `backend` directory

2. **Configuration**
   - **Name**: messaging-app-backend
   - **Environment**: Python 3
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `python main.py`
   - **Instance Type**: Starter (free) or Hobby

3. **Environment Variables**
   ```
   DATABASE_URL=postgresql://...
   JWT_SECRET_KEY=<generate-random-256-bit-key>
   JWT_ALGORITHM=HS256
   ACCESS_TOKEN_EXPIRE_MINUTES=1440
   ENVIRONMENT=production
   DEBUG=false
   CORS_ORIGINS=https://your-frontend.vercel.app
   RESEND_API_KEY=re_...
   VERIFIED_DOMAIN=yourdomain.com
   FRONTEND_URL=https://your-frontend.vercel.app
   ```

4. **Deploy**
   - Click "Create Web Service"
   - Wait for deployment (5-10 minutes)
   - Note the URL: `https://your-app.onrender.com`

### Option 2: Railway

1. **Create Project**
   - Go to https://railway.app
   - New Project → Deploy from GitHub
   - Select repository

2. **Configure Service**
   - Root directory: `/backend`
   - Add environment variables (same as Render)

3. **Deploy**
   - Railway auto-deploys
   - Note the URL

### Generate JWT Secret Key
```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

---

## Frontend Deployment (Vercel)

1. **Connect GitHub**
   - Go to https://vercel.com
   - New Project → Import Git Repository
   - Select your repository

2. **Configure Project**
   - **Framework Preset**: Vite
   - **Root Directory**: `/` (project root)
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`

3. **Environment Variables**
   ```
   VITE_API_URL=https://your-backend.onrender.com/api/v1
   VITE_WS_URL=wss://your-backend.onrender.com
   ```
   
   **Important**: Use `wss://` (secure WebSocket) for production!

4. **Deploy**
   - Click "Deploy"
   - Wait for build (2-3 minutes)
   - Note the URL: `https://your-app.vercel.app`

5. **Update Backend CORS**
   - Add Vercel URL to `CORS_ORIGINS` in backend env vars
   - Format: `https://your-app.vercel.app,https://*.vercel.app`

---

## Email Setup (Resend)

1. **Create Account**
   - Go to https://resend.com
   - Sign up and verify email

2. **Add Domain**
   - Go to Domains → Add Domain
   - Follow DNS configuration steps
   - Verify domain

3. **Get API Key**
   - Go to API Keys → Create API Key
   - Copy key (starts with `re_`)

4. **Update Backend**
   ```
   RESEND_API_KEY=re_your_key_here
   VERIFIED_DOMAIN=yourdomain.com
   ```

---

## Custom Domain Setup

### Frontend (Vercel)

1. **Add Domain**
   - Project Settings → Domains
   - Add your domain: `chat.yourdomain.com`

2. **DNS Configuration**
   - Add CNAME record:
     ```
     Type: CNAME
     Name: chat
     Value: cname.vercel-dns.com
     ```

3. **SSL**
   - Vercel auto-generates SSL certificate
   - Wait 24-48 hours for propagation

### Backend (Render)

1. **Add Custom Domain**
   - Service Settings → Custom Domain
   - Add: `api.yourdomain.com`

2. **DNS Configuration**
   - Add CNAME record:
     ```
     Type: CNAME
     Name: api
     Value: your-app.onrender.com
     ```

3. **Update Frontend**
   - Update `VITE_API_URL` to use custom domain
   - Update `VITE_WS_URL` to use custom domain

---

## Post-Deployment Checklist

### Backend
- [ ] Database migrations applied
- [ ] Environment variables set
- [ ] CORS configured correctly
- [ ] JWT secret key generated
- [ ] Health check working: `https://your-backend/health`
- [ ] API docs accessible: `https://your-backend/docs`

### Frontend
- [ ] Environment variables set
- [ ] Build successful
- [ ] Can access login page
- [ ] WebSocket connection working
- [ ] File uploads working

### Database
- [ ] Tables created
- [ ] Indexes applied
- [ ] Backup configured
- [ ] Connection pooling enabled

### Testing
- [ ] User registration works
- [ ] Login works
- [ ] Sending messages works
- [ ] Media upload works
- [ ] Group chat works
- [ ] Email invitations work (if configured)

---

## Monitoring

### Backend Logs
- **Render**: Dashboard → Logs
- **Railway**: Deployments → View Logs

### Frontend Errors
- **Vercel**: Dashboard → Deployments → Build Logs
- Browser console for runtime errors

### Database
- **Supabase**: Dashboard → Database → Logs
- **Neon**: Dashboard → Operations

---

## Scaling

### Database
- **Connection Pooling**: Already configured (pgbouncer)
- **Read Replicas**: Available on paid plans
- **Backups**: Configure automatic backups

### Backend
- **Horizontal Scaling**: Add more instances (paid plans)
- **Redis**: Add Redis for WebSocket scaling across instances
- **CDN**: Use CDN for static file uploads

### Frontend
- **Edge Network**: Vercel automatically uses global CDN
- **Caching**: Configure appropriate cache headers

---

## Troubleshooting

### "Cannot connect to database"
- Check `DATABASE_URL` format
- Verify database is running
- Check firewall rules
- Use transaction pooler (port 6543) for Supabase

### "CORS error"
- Add frontend URL to `CORS_ORIGINS`
- Include protocol: `https://`
- Include all subdomains if needed

### "WebSocket connection failed"
- Use `wss://` (not `ws://`) in production
- Check firewall allows WebSocket
- Verify JWT token is valid

### "File upload fails"
- Check file size < 50MB
- Verify uploads directory exists and is writable
- Check backend has sufficient storage

### "Email not sending"
- Verify `RESEND_API_KEY` is set
- Check domain is verified in Resend
- Check email queue is running

---

## Backup Strategy

### Database Backups
- **Supabase**: Auto-backups enabled by default
- **Neon**: Configure backup schedule in dashboard
- Manual backup: `pg_dump DATABASE_URL > backup.sql`

### File Uploads
- Configure cloud storage (S3, Cloudinary) for production
- Regular backups of uploads directory

### Code
- Keep Git repository up to date
- Tag releases: `git tag -a v1.0.0 -m "Release 1.0.0"`

---

## Security Best Practices

1. **Environment Variables**
   - Never commit `.env` files
   - Use different secrets for each environment
   - Rotate JWT secret periodically

2. **Database**
   - Use strong passwords
   - Enable SSL connections
   - Restrict access by IP if possible

3. **API**
   - Use HTTPS only
   - Implement rate limiting (future)
   - Monitor for suspicious activity

4. **Updates**
   - Keep dependencies up to date
   - Monitor security advisories
   - Test updates in staging first

---

## Rollback Procedure

### Backend
1. Go to Render/Railway dashboard
2. Find previous deployment
3. Click "Redeploy"
4. Verify application works

### Frontend
1. Go to Vercel dashboard
2. Deployments → Find working deployment
3. Click "..." → Promote to Production

### Database
1. Stop application
2. Restore from backup: `psql DATABASE_URL < backup.sql`
3. Restart application

---

## Performance Optimization

### Database
- Add indexes on frequently queried columns (already done)
- Use connection pooling (already configured)
- Analyze slow queries

### Backend
- Enable response compression
- Cache frequently accessed data
- Use async operations where possible

### Frontend
- Code splitting (Vite does this automatically)
- Lazy load components
- Optimize images before upload

---

## Cost Estimates

### Free Tier (Development/Testing)
- **Supabase**: Free tier (500MB database)
- **Render**: Free tier (750 hours/month)
- **Vercel**: Free tier (unlimited bandwidth)
- **Total**: $0/month

### Production (Small Scale)
- **Supabase Pro**: $25/month (8GB database)
- **Render Hobby**: $7/month per service
- **Vercel Pro**: $20/month (better performance)
- **Resend**: $20/month (100k emails)
- **Total**: ~$72/month

### Production (Medium Scale)
- **Supabase Scale**: $99/month (64GB database)
- **Render Standard**: $25/month per service
- **Vercel Pro**: $20/month
- **Resend**: $50/month (500k emails)
- **Total**: ~$194/month

---

## Support & Resources

- **FastAPI Docs**: https://fastapi.tiangolo.com
- **React Docs**: https://react.dev
- **Supabase Docs**: https://supabase.com/docs
- **Vercel Docs**: https://vercel.com/docs
- **Render Docs**: https://render.com/docs

---

## Next Steps

After successful deployment:
1. Monitor application performance
2. Set up error tracking (Sentry)
3. Configure analytics
4. Implement rate limiting
5. Add more comprehensive tests
6. Plan for real end-to-end encryption
