---
description: Deploy QA Guardian application to Netlify
---

# Deploy QA Guardian to Netlify

This workflow guides you through deploying the QA Guardian application to Netlify, including setting up required infrastructure.

## Prerequisites

Before deploying, you need:
1. Netlify account (already authenticated)
2. PostgreSQL database (Neon recommended - https://neon.tech)
3. Redis instance (Upstash recommended - https://upstash.com)

## Step 1: Set up Infrastructure

### PostgreSQL Database (Neon)
1. Go to https://neon.tech and create a free account
2. Create a new project called "qa-guardian"
3. Copy the connection string (starts with `postgresql://`)
4. Save it as `DATABASE_URL`

### Redis (Upstash)
1. Go to https://upstash.com and create a free account
2. Create a new Redis database
3. Copy the connection string (starts with `redis://` or `rediss://`)
4. Save it as `REDIS_URL`

### Generate Secrets
```bash
# Generate JWT secret (save this)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate Magic Link secret (save this)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Step 2: Deploy Backend

```bash
# Navigate to backend directory
cd backend

# Link to Netlify (creates new site)
netlify link --create

# Set environment variables
netlify env:set DATABASE_URL "your-postgresql-connection-string"
netlify env:set REDIS_URL "your-redis-connection-string"
netlify env:set JWT_SECRET "your-generated-jwt-secret"
netlify env:set MAGIC_LINK_SECRET "your-generated-magic-link-secret"
netlify env:set NODE_ENV "production"

# Deploy
netlify deploy --prod

# Save the backend URL that is displayed (e.g., https://your-api-name.netlify.app)
```

## Step 3: Run Database Migrations

```bash
# Still in backend directory
# This runs migrations against your production database
DATABASE_URL="your-postgresql-connection-string" npx prisma migrate deploy

# Seed the database with admin user
DATABASE_URL="your-postgresql-connection-string" npm run db:seed
```

## Step 4: Deploy Frontend

```bash
# Navigate to frontend directory
cd ../frontend

# Link to Netlify (creates new site)
netlify link --create

# Set backend API URL (use the URL from Step 2)
netlify env:set NEXT_PUBLIC_API_URL "https://your-backend-url.netlify.app/.netlify/functions/api"

# Deploy
netlify deploy --prod

# Save the frontend URL that is displayed (e.g., https://your-app-name.netlify.app)
```

## Step 5: Verify Deployment

### Test Backend
```bash
# Test health endpoint
curl https://your-backend-url.netlify.app/.netlify/functions/api/health
```

### Test Frontend
1. Open the frontend URL in your browser
2. You should see the login page
3. Login with default credentials:
   - Email: `admin@qabot.local`
   - Password: `admin123`
4. Verify you can access the dashboard

## Troubleshooting

### Backend Issues
- Check Netlify function logs: `netlify logs`
- Verify environment variables are set: `netlify env:list`
- Check database connection in Netlify dashboard logs

### Frontend Issues
- Verify `NEXT_PUBLIC_API_URL` is correct
- Check browser console for CORS errors
- Ensure backend is deployed and accessible

### Database Issues
- Test connection string locally first
- Ensure Prisma schema is up to date: `npx prisma generate`
- Check migration status: `npx prisma migrate status`

## Post-Deployment

After successful deployment:
1. Save your backend URL and frontend URL
2. Update DNS if you want custom domains
3. Configure additional environment variables as needed (SMTP, Slack, S3)
4. Set up monitoring and alerts
