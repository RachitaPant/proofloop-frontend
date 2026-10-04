# ProofLoop Deployment Guide

## Quick Deploy Checklist

### Prerequisites
- [ ] MongoDB Atlas cluster created
- [ ] Railway/Render account created
- [ ] Vercel account created
- [ ] GitHub repository created

## Step-by-Step Deployment

### 1. MongoDB Atlas Setup (5 minutes)

1. **Create Account**: Go to [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas)
2. **Create Cluster**:
   - Click "Build a Database"
   - Choose "M0 Free" tier
   - Select region closest to your users
   - Click "Create Cluster"

3. **Create Database User**:
   - Go to "Database Access"
   - Click "Add New Database User"
   - Choose "Password" authentication
   - Create username and strong password
   - Grant "Read and write to any database"

4. **Configure Network Access**:
   - Go to "Network Access"
   - Click "Add IP Address"
   - For development: Click "Allow Access from Anywhere" (0.0.0.0/0)
   - For production: Add specific IPs of your deployment services

5. **Get Connection String**:
   - Go to "Database" → Click "Connect"
   - Choose "Connect your application"
   - Copy the connection string
   - Replace `<password>` with your database user password
   - Example: `mongodb+srv://proofloop:mypassword@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority`

### 2. Backend Deployment on Railway (10 minutes)

1. **Create Railway Account**:
   - Visit [railway.app](https://railway.app)
   - Sign up with GitHub

2. **Create New Project**:
   - Click "New Project"
   - Choose "Deploy from GitHub repo"
   - Select your ProofLoop repository
   - Railway will automatically detect the Dockerfile

3. **Configure Service**:
   - Click on the service
   - Go to "Settings"
   - Set "Root Directory" to `backend`
   - Click "Variables" tab

4. **Add Environment Variables**:
   ```
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/
   MONGODB_DATABASE=proofloop
   JWT_SECRET=your-super-secret-jwt-key-minimum-256-bits-long
   CORS_ALLOWED_ORIGINS=https://your-app.vercel.app,http://localhost:3000
   PORT=8080
   ```

5. **Generate Deployment Domain**:
   - Go to "Settings"
   - Under "Networking", click "Generate Domain"
   - Copy the URL (e.g., `https://proofloop-backend.up.railway.app`)

6. **Deploy**:
   - Railway will automatically deploy
   - Check logs for "Started ProofLoopApplication"
   - Test: Visit `https://your-backend-url/api/workflows` (should return 401 Unauthorized)

### 3. Frontend Deployment on Vercel (5 minutes)

1. **Create Vercel Account**:
   - Visit [vercel.com](https://vercel.com)
   - Sign up with GitHub

2. **Import Project**:
   - Click "Add New" → "Project"
   - Import your GitHub repository
   - Vercel auto-detects Next.js

3. **Configure Build**:
   - **Framework Preset**: Next.js (auto-detected)
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build` (default)
   - **Output Directory**: `.next` (default)

4. **Add Environment Variable**:
   - Click "Environment Variables"
   - Add:
     - Key: `NEXT_PUBLIC_API_URL`
     - Value: `https://your-backend.up.railway.app` (from Railway)
   - Select all environments (Production, Preview, Development)

5. **Deploy**:
   - Click "Deploy"
   - Wait 2-3 minutes
   - Vercel will provide your URL (e.g., `https://proofloop.vercel.app`)

6. **Update Backend CORS**:
   - Go back to Railway
   - Update `CORS_ALLOWED_ORIGINS` to include your Vercel URL
   - Example: `https://proofloop.vercel.app,http://localhost:3000`

### 4. Test Deployment

1. **Visit Your App**:
   - Open `https://your-app.vercel.app`
   - You should see the ProofLoop landing page

2. **Test Login**:
   - Use demo credentials:
     - Email: `admin@proofloop.com`
     - Password: `admin123`
   - If successful, you'll see the dashboard

3. **Verify Backend**:
   - Create a workflow
   - Create a request
   - Approve/reject a request
   - Check analytics (if admin)

## Alternative Deployment: Render

If you prefer Render over Railway:

1. **Create Render Account**: [render.com](https://render.com)

2. **Create Web Service**:
   - Click "New" → "Web Service"
   - Connect GitHub repository
   - Configure:
     - **Name**: proofloop-backend
     - **Root Directory**: backend
     - **Environment**: Docker
     - **Instance Type**: Free

3. **Add Environment Variables** (same as Railway):
   ```
   MONGODB_URI=...
   MONGODB_DATABASE=proofloop
   JWT_SECRET=...
   CORS_ALLOWED_ORIGINS=...
   ```

4. **Deploy**: Render will build and deploy automatically

## Troubleshooting

### Backend won't start
- Check MongoDB connection string is correct
- Verify JWT_SECRET is set
- Check Railway/Render logs for errors

### Frontend can't connect to backend
- Verify NEXT_PUBLIC_API_URL is correct
- Check CORS_ALLOWED_ORIGINS includes your Vercel domain
- Look for CORS errors in browser console

### "401 Unauthorized" errors
- JWT token may be expired (refresh page to login again)
- Check JWT_SECRET matches between deployments
- Verify token is being sent in Authorization header

### Demo data not appearing
- Data seeder runs on first startup only
- Check backend logs for "Database seeded successfully"
- If needed, delete the MongoDB database and restart backend

## Production Checklist

- [ ] Use strong, unique JWT_SECRET (32+ characters)
- [ ] Restrict MongoDB Network Access to specific IPs
- [ ] Enable SSL/HTTPS (automatic on Railway/Render/Vercel)
- [ ] Set up monitoring (Railway provides basic monitoring)
- [ ] Configure custom domain (optional)
- [ ] Set up automatic backups for MongoDB
- [ ] Review and update CORS origins for production only

## Cost Breakdown (Free Tier)

- **MongoDB Atlas**: Free M0 cluster (512 MB storage)
- **Railway**: $5/month credit (sufficient for backend)
- **Vercel**: Unlimited for personal projects
- **Total**: FREE for development/portfolio projects

## Next Steps

1. **Custom Domain** (optional):
   - Vercel: Add custom domain in project settings
   - Railway: Add custom domain in service settings

2. **Monitoring**:
   - Railway provides logs and metrics
   - Vercel provides analytics
   - MongoDB Atlas provides performance insights

3. **Scaling**:
   - Railway: Upgrade plan for more resources
   - MongoDB: Upgrade cluster tier for more storage
   - Vercel: Automatic scaling included

## Support

If you encounter issues:
1. Check logs in Railway/Render and Vercel dashboards
2. Verify all environment variables are set correctly
3. Test backend API directly with Postman
4. Check MongoDB Atlas connection metrics

---

**Congratulations! Your ProofLoop app is now live! 🎉**

Share your deployment:
- Frontend: `https://your-app.vercel.app`
- Backend API: `https://your-backend.railway.app`
