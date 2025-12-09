# 📋 Pre-Deployment Checklist

## ✅ Before You Deploy

### Code Preparation
- [ ] All code committed to GitHub
- [ ] No sensitive data in code (passwords, keys)
- [ ] Environment variables configured
- [ ] .gitignore includes .env files

### Accounts Setup
- [ ] GitHub account created
- [ ] Vercel account created (vercel.com)
- [ ] Supabase account created (supabase.com)

### Database Ready
- [ ] Supabase project created
- [ ] Database password saved securely
- [ ] Connection string copied
- [ ] SQL tables created successfully

### Configuration Files
- [ ] vercel.json exists in root
- [ ] backend/vercel.json exists
- [ ] .env.example files updated

## 🚀 Deployment Steps

### Backend
- [ ] Backend deployed to Vercel
- [ ] Environment variables added
- [ ] Database connection tested
- [ ] Backend URL copied

### Frontend
- [ ] Frontend deployed to Vercel
- [ ] VITE_API_URL set to backend URL
- [ ] VITE_WS_URL set to backend URL
- [ ] Frontend URL copied

### Final Configuration
- [ ] Backend CORS_ORIGINS updated with frontend URL
- [ ] Backend redeployed
- [ ] FRONTEND_URL env var added to backend

## ✅ Post-Deployment Testing

- [ ] Can access frontend URL
- [ ] Can register new account
- [ ] Can login successfully
- [ ] Can add contact (email sent)
- [ ] Can receive invitation email
- [ ] Can send messages
- [ ] Real-time messaging works (if supported)

## 🐛 If Something Doesn't Work

1. Check browser console (F12) for errors
2. Check Vercel deployment logs
3. Verify environment variables
4. Check CORS settings
5. Verify database connection string
6. Test backend API endpoints directly

## 📝 URLs to Save

- Frontend: ___________________________
- Backend: ___________________________
- Supabase Project: ___________________________
- Database Connection String: ___________________________

## 🔐 Credentials to Save Securely

- Supabase Database Password: ___________________________
- JWT Secret Key: ___________________________
- Gmail App Password: ___________________________

---

**Ready to deploy?** Follow the step-by-step guide in `DEPLOYMENT.md`!
