# 🚀 Render + Vercel + Supabase Deployment Guide

## ✅ Prerequisites
- GitHub account
- Render account (sign up at render.com - FREE)
- Vercel account (sign up at vercel.com - FREE)
- Supabase account (sign up at supabase.com - FREE)

---

## 📋 PART 1: Setup Supabase Database (10 minutes)

### Step 1.1: Create Supabase Project
1. Go to **https://supabase.com** → Sign in
2. Click **"New Project"**
3. Fill in:
   - **Name**: `messaging-app-db`
   - **Database Password**: Create strong password → **SAVE THIS!** ⚠️
   - **Region**: Select closest to your location
4. Click **"Create new project"** → Wait 2 minutes ⏱️

### Step 1.2: Get Database URL
1. In Supabase dashboard → Click **⚙️ Settings** (bottom left)
2. Go to **Database** tab
3. Scroll to **Connection string** section
4. Select **URI** mode
5. **Copy** the connection string:
   ```
   postgresql://postgres.[ref]:[YOUR-PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres
   ```
6. **Replace** `[YOUR-PASSWORD]` with your actual password
7. **Save this** - you'll need it! 📝

### Step 1.3: Create Database Tables
1. In Supabase → Click **📊 SQL Editor** (left sidebar)
2. Click **"New query"**
3. **Copy and paste** this entire SQL script:

```sql
-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100),
    public_key BYTEA,
    is_active BOOLEAN DEFAULT TRUE,
    is_verified BOOLEAN DEFAULT FALSE,
    avatar_url VARCHAR(500),
    bio TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Contacts table
CREATE TABLE contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    contact_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    display_name VARCHAR(100),
    is_blocked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, contact_user_id)
);

-- Messages table
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    encrypted_content TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Invitations table
CREATE TABLE invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inviter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    invitee_email VARCHAR(255) NOT NULL,
    invitation_token VARCHAR(255) UNIQUE NOT NULL,
    is_accepted BOOLEAN DEFAULT FALSE,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_messages_recipient ON messages(recipient_id);
CREATE INDEX idx_contacts_user ON contacts(user_id);
CREATE INDEX idx_invitations_token ON invitations(invitation_token);
```

4. Click **"Run"** (or press F5)
5. You should see ✅ **"Success. No rows returned"**

---

## 📤 PART 2: Push Code to GitHub

### Step 2.1: Commit Your Code
Open terminal in your project folder and run:

```bash
git add .
git commit -m "Ready for Vercel deployment"
git push origin main
```

If you get errors, make sure you're logged in to GitHub and have initialized git.

---

## 🔧 PART 3: Deploy Backend to Render

### Step 3.1: Create Web Service
1. Go to **https://render.com** → Sign in with GitHub
2. Click **"New +"** → **"Web Service"**
3. Click **"Connect account"** if first time, then find and select your repository
4. Configure the service:
   - **Name**: `messaging-backend` (or any name you like)
   - **Region**: Select closest to you
   - **Branch**: `main`
   - **Root Directory**: `backend`
   - **Runtime**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - **Instance Type**: `Free`

### Step 3.2: Add Environment Variables
Scroll down to **Environment Variables** section and click **"Add Environment Variable"**. Add these **one by one**:

| Variable Name | Value |
|--------------|-------|
| `DATABASE_URL` | *(paste your Supabase connection string)* |
| `JWT_SECRET_KEY` | `aUf_JGiy8q1aIfPpFM_WhJ7ISFcmKQGe-Mq9qiWLu5s` |
| `JWT_ALGORITHM` | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `30` |
| `ENVIRONMENT` | `production` |
| `DEBUG` | `False` |
| `SMTP_SERVER` | `smtp.gmail.com` |
| `SMTP_PORT` | `587` |
| `SMTP_USERNAME` | `priyamsatya08@gmail.com` |
| `SMTP_PASSWORD` | `bsdk ivzr idqc pxvo` |
| `SMTP_FROM_EMAIL` | `priyamsatya08@gmail.com` |
| `CORS_ORIGINS` | `["*"]` |
| `PYTHON_VERSION` | `3.11.0` |

### Step 3.3: Deploy Backend
1. Click **"Create Web Service"** button at the bottom
2. Wait 3-5 minutes ⏱️ (Render will build and deploy)
3. Once done, you'll see **"Live"** status with a green checkmark ✅
4. **COPY YOUR BACKEND URL** at the top (e.g., `https://messaging-backend-xxx.onrender.com`)
5. **Save it** - you'll need it next! 📝

**Note**: Free tier may spin down after 15 minutes of inactivity. First request after inactivity may take 30-60 seconds.

---

## 🎨 PART 4: Deploy Frontend to Vercel

### Step 4.1: Create Frontend Deployment
1. In Vercel → Click **"Add New..."** → **"Project"**
2. Select the **SAME repository** again
3. This time, **DON'T change Root Directory** (leave as is)
4. Configure:
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`

### Step 4.2: Add Frontend Environment Variables
Click **"Environment Variables"** and add:

| Variable Name | Value |
|--------------|-------|
| `VITE_API_URL` | `https://your-backend.vercel.app/api/v1` *(replace with YOUR backend URL)* |
| `VITE_WS_URL` | `wss://your-backend.vercel.app` *(replace with YOUR backend URL)* |

⚠️ **IMPORTANT**: Replace `your-backend.vercel.app` with your actual backend URL from Step 3!

### Step 4.3: Deploy Frontend
1. Click **"Deploy"**
2. Wait 2-3 minutes ⏱️
3. **COPY YOUR FRONTEND URL** (e.g., `https://messaging-app-xxx.vercel.app`)

---

## 🔄 PART 5: Update Backend CORS

### Step 5.1: Update CORS Settings
1. Go to Render → Select your **backend** web service
2. Click **"Environment"** in left sidebar
3. Find `CORS_ORIGINS` → Click **"Edit"**
4. Change value to: `["https://your-frontend.vercel.app"]`
   *(replace with YOUR frontend URL)*
5. Click **"Save Changes"**
6. Also add new variable (click **"Add Environment Variable"**):
   - **Key**: `FRONTEND_URL`
   - **Value**: `https://your-frontend.vercel.app` *(your frontend URL)*
7. Click **"Save Changes"**

### Step 5.2: Redeploy Backend
1. After saving environment variables, Render will automatically trigger a redeploy
2. Wait for the deployment to finish (you'll see "Live" status) ⏱️
3. If it doesn't auto-deploy, click **"Manual Deploy"** → **"Deploy latest commit"**

---

## ✅ PART 6: Test Your App!

### Open your frontend URL and test:

1. ✅ **Register** a new account
2. ✅ **Login** with your credentials
3. ✅ **Add a contact** (try your own email)
4. ✅ **Check your email** for invitation
5. ✅ **Send messages** (open 2 browser tabs)

---

## 🐛 Troubleshooting

### ❌ "Failed to fetch" errors:
- Check browser console (F12)
- Verify VITE_API_URL in frontend settings
- Make sure backend is deployed and running on Render
- **Render free tier**: Backend may be sleeping - wait 30-60 seconds for first request

### ❌ CORS errors:
- Verify CORS_ORIGINS includes your frontend URL
- Check Render environment variables
- Wait for auto-redeploy after changing env vars

### ❌ Database connection errors:
- Check DATABASE_URL in Render environment settings
- Verify Supabase connection string is correct
- Make sure you're using port 6543 (Supabase pooler)

### ❌ Email not sending:
- Check SMTP credentials in Render env vars
- Verify Gmail "App Password" is correct

### ❌ Backend not responding:
- Render free tier spins down after 15 min inactivity
- First request takes 30-60 seconds to wake up
- Check Render logs for errors

### 📊 View Logs:
- **Backend logs**: Render → Your Web Service → **"Logs"** tab (live streaming)
- **Frontend logs**: Browser console (F12)
- **Render events**: Render → Your Web Service → **"Events"** tab

---

## 🎉 SUCCESS! Your App is Live!

- **Frontend**: https://your-app.vercel.app
- **Backend API**: https://your-backend.onrender.com/api/v1
- **Database**: Managed by Supabase
- **Email**: Sent via Gmail SMTP

## 📝 Important Notes:

✅ **WebSocket Support**:
Render supports WebSockets! Your real-time messaging should work in production on Render, unlike Vercel serverless.

🔒 **Security**:
- Change JWT_SECRET_KEY in production
- Use strong database password
- Enable Row Level Security in Supabase
- Update CORS to specific domains

💰 **Free Tier Limits**:
- **Render**: 750 hours/month, spins down after 15 min inactivity
- **Vercel**: 100GB bandwidth/month
- **Supabase**: 500MB database, 2GB bandwidth
- Monitor usage in dashboards

⚠️ **Render Free Tier Behavior**:
- Backend sleeps after 15 minutes of no activity
- Wakes up on first request (takes 30-60 seconds)
- Consider upgrading to paid tier ($7/month) for always-on service

---

## 🚀 Next Steps (Optional):

1. **Custom Domain**: Add in Vercel → Project Settings → Domains
2. **Environment-specific configs**: Create separate projects for staging/production
3. **Monitoring**: Set up error tracking (Sentry)
4. **Analytics**: Add analytics (Vercel Analytics)
5. **CI/CD**: Automatic deployments on git push (already enabled!)

---

**Need help?** Check Vercel docs or Supabase docs for detailed guides.

**Happy Messaging! 💬**
