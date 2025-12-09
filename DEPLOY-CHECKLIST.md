# 🚀 Quick Deployment Checklist

## Before Deploying

- [ ] All code committed to Git
- [ ] .env files are in .gitignore (✅ already done)
- [ ] Gmail App Password generated for SMTP
- [ ] PostgreSQL database ready
- [ ] All dependencies in requirements.txt

## Deployment Steps (Render - Easiest)

### 1. Push to GitHub
```bash
git add .
git commit -m "Ready for deployment"
git push origin main
```

### 2. Deploy Database (5 min)
1. Go to https://render.com → Sign in with GitHub
2. New + → PostgreSQL
3. Name: `messaging-app-db`
4. Plan: **Free**
5. Create Database
6. **Copy Internal Database URL**

### 3. Deploy Backend (10 min)
1. New + → Web Service
2. Connect GitHub repo
3. Configure:
   - Name: `messaging-app-backend`
   - Root Directory: `backend`
   - Build: `pip install -r requirements.txt`
   - Start: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - Plan: **Free**

4. Add Environment Variables (copy from .env.example):
   - DATABASE_URL (from step 2)
   - JWT_SECRET_KEY (generate new one)
   - SMTP credentials
   - FRONTEND_URL (will update later)
   - CORS_ORIGINS (will update later)

5. Deploy
6. **Copy backend URL**: `https://xxx.onrender.com`

### 4. Deploy Frontend (10 min)
1. New + → Static Site
2. Connect GitHub repo
3. Configure:
   - Name: `messaging-app-frontend`
   - Build: `npm install && npm run build`
   - Publish: `dist`
   - Plan: **Free**

4. Add Environment Variable:
   - VITE_API_URL: `<backend URL from step 3>`
   - VITE_WS_URL: `<backend URL with wss:// protocol>`

5. Deploy
6. **Copy frontend URL**: `https://yyy.onrender.com`

### 5. Update Backend URLs
1. Go back to backend service
2. Update environment variables:
   - FRONTEND_URL: `<frontend URL from step 4>`
   - CORS_ORIGINS: `["<frontend URL from step 4>"]`
3. Save (will auto-redeploy)

### 6. Initialize Database
**Option A - Using Render Shell:**
1. Backend service → Shell tab
2. Run: 
   ```bash
   python -c "from app.database import engine, Base; Base.metadata.create_all(bind=engine)"
   ```

**Option B - Using SQL client:**
1. Connect with External Database URL
2. Create tables manually

## Testing Checklist

- [ ] Open frontend URL
- [ ] Register new user
- [ ] Login works
- [ ] Send invitation email
- [ ] Check email received
- [ ] Accept invitation
- [ ] Send message
- [ ] WebSocket works (real-time)
- [ ] Both users can see messages

## Troubleshooting

### "Failed to fetch"
- Check backend is running in Render
- Verify CORS_ORIGINS includes frontend URL
- Check browser console for actual error

### Database connection failed
- Verify DATABASE_URL in backend env vars
- Check database is running

### Email not sending
- Use Gmail App Password (not regular password)
- Verify SMTP settings

### WebSocket not connecting
- Use WSS (not WS) for HTTPS sites
- Check WEBSOCKET_URL in backend
- Verify port is correct

## Costs

**Render Free Tier:**
- ✅ Backend: FREE (spins down after 15 min inactivity)
- ✅ Frontend: FREE
- ✅ PostgreSQL: FREE (90 days, then $7/month)

**Total: FREE for testing!**

## Next Steps After Deployment

1. Test all features thoroughly
2. Fix any issues
3. Consider custom domain
4. Set up monitoring
5. Plan for production (paid tier for 24/7 uptime)

---

## Alternative: Railway (Also Easy)

If Render has issues, try Railway:
1. https://railway.app
2. Sign in with GitHub
3. New Project → Deploy from GitHub
4. Add PostgreSQL
5. Configure env vars
6. Deploy!

**Costs**: $5 credit free, then ~$5/month

---

## Need Help?

Check logs in:
- Render: Service → Logs tab
- Railway: Deployment → View logs

Common fixes:
- Restart service
- Check env vars
- Rebuild and deploy
