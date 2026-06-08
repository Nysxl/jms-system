# Cloudflare Deployment Guide

Complete guide for deploying JMS to Cloudflare Pages with D1 database.

## Prerequisites

- Cloudflare account (free tier eligible)
- GitHub repository
- Node.js 18+
- npm

## Step 1: Cloudflare Setup

### 1.1 Create D1 Database

```bash
# Install Wrangler CLI
npm install -g @cloudflare/wrangler

# Login to Cloudflare
wrangler login

# Create D1 database
wrangler d1 create jms

# Note the database_id from output
```

### 1.2 Create Supabase Project

1. Visit https://supabase.com
2. Create new project
3. Set project name: `jms`
4. Create strong password
5. Wait for setup to complete
6. Go to Settings → API Keys
7. Copy:
   - Project URL
   - anon/public key
   - service_role key

## Step 2: Prepare Your Repository

### 2.1 Push Code to GitHub

```bash
# Initialize git if needed
git init
git add .
git commit -m "Initial JMS setup"

# Add remote and push
git remote add origin https://github.com/YOUR_USERNAME/jms-system.git
git branch -M main
git push -u origin main
```

### 2.2 Update Configuration Files

**wrangler.toml:**
```toml
name = "jms-system"
type = "javascript"
account_id = "YOUR_ACCOUNT_ID"  # Find in Cloudflare dashboard
workers_dev = true
main = "dist/index.js"
compatibility_date = "2024-01-01"

[[d1_databases]]
binding = "DB"
database_name = "jms"
database_id = "YOUR_DATABASE_ID"  # From wrangler d1 create

[env.production]
vars = { ENVIRONMENT = "production" }

[env.production.vars]
SUPABASE_URL = "YOUR_SUPABASE_URL"
SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY"
```

## Step 3: Initialize Cloudflare Pages Project

### 3.1 Connect GitHub to Cloudflare

1. Login to Cloudflare Dashboard
2. Go to Pages
3. Click "Create a project"
4. Select "Connect to Git"
5. Authorize GitHub
6. Select your `jms-system` repository

### 3.2 Configure Build Settings

**Build command:**
```
npm run build
```

**Build output directory:**
```
.next
```

**Environment Variables:**

Add the following in the Pages settings:

```
NEXT_PUBLIC_SUPABASE_URL = your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY = your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY = your_service_role_key
CLOUDFLARE_ACCOUNT_ID = your_account_id
CLOUDFLARE_DATABASE_ID = your_database_id
```

### 3.3 Deploy

1. Click "Save and Deploy"
2. Cloudflare will build and deploy automatically
3. You'll get a preview domain like: `jms-system.pages.dev`

## Step 4: Database Migration

### 4.1 Apply Schema Locally First

```bash
# Login to Wrangler
wrangler login

# Apply schema to local D1
wrangler d1 execute jms --local --file=./DATABASE_SCHEMA.sql
```

### 4.2 Apply Schema to Production

```bash
# Apply to Cloudflare D1
wrangler d1 execute jms --remote --file=./DATABASE_SCHEMA.sql

# Verify tables were created
wrangler d1 execute jms --remote "SELECT name FROM sqlite_master WHERE type='table';"
```

## Step 5: Domain Configuration (Optional)

### 5.1 Add Custom Domain

1. Go to Cloudflare Pages project
2. Settings → Custom domain
3. Enter your domain (e.g., `jms.yourdomain.com`)
4. Add CNAME record to your DNS:
   - Name: `jms`
   - Target: `jms-system.pages.dev`

### 5.2 SSL/TLS

- Cloudflare automatically provisions SSL certificates
- HTTPS is enabled by default

## Step 6: Environment-Specific Settings

### Production Variables

In Cloudflare Pages dashboard → Settings → Environment variables:

```
NODE_ENV = production
NEXT_PUBLIC_APP_NAME = JMS System
NEXT_PUBLIC_API_URL = https://jms.yourdomain.com
```

### Development Variables

In `.env.local` for local testing:

```
NEXT_PUBLIC_SUPABASE_URL = your_dev_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY = your_dev_supabase_key
NODE_ENV = development
```

## Step 7: First Deployment

### 7.1 Verify Deployment

```bash
# Check build status
# Go to Cloudflare Pages → Deployments tab
# Look for green checkmark

# Test the site
# Visit https://your-domain.pages.dev
# Or your custom domain
```

### 7.2 Test Key Features

1. **Authentication**
   - Try signing up
   - Try signing in
   - Verify JWT tokens are working

2. **Database**
   - Create a new job
   - Verify it appears in dashboard
   - Check D1 database directly:
   
   ```bash
   wrangler d1 execute jms --remote "SELECT * FROM jobs;"
   ```

3. **API Routes**
   - Test with curl:
   
   ```bash
   curl -X GET https://your-domain.pages.dev/api/jobs \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

## Step 8: Monitoring & Logs

### View Deployment Logs

```bash
# View recent deployments
wrangler pages deployments list

# View specific deployment logs
wrangler pages deployment list
```

### Enable Cloudflare Analytics

1. Go to Cloudflare dashboard
2. Select your domain
3. Go to Analytics & Logs
4. View traffic, errors, and performance

## Step 9: Backup & Disaster Recovery

### Backup D1 Database

```bash
# Export data from D1
wrangler d1 execute jms --remote "SELECT * FROM jobs;" > backup_jobs.sql

# Schedule regular backups (use GitHub Actions)
```

### GitHub Actions for CI/CD

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Cloudflare

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npm run build
      - uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

## Troubleshooting

### 404 on Pages
- Ensure build command is correct
- Check build output directory is `.next`
- Review build logs for errors

### Database Connection Issues

```bash
# Test connection
wrangler d1 execute jms --remote "SELECT 1;"

# Check bindings in wrangler.toml
# Verify database_id is correct
```

### Environment Variables Not Loading
- Check variable names match exactly
- Ensure no extra spaces
- Redeploy after adding variables:
  - Go to Deployments
  - Trigger new deployment

### Supabase Auth Failing
1. Verify API keys in environment
2. Check CORS settings in Supabase
3. Ensure redirect URL is whitelisted
4. Check email is verified in Supabase

## Performance Tips

1. **Enable Caching**
   - Set Cache-Control headers for static assets
   - Configure in wrangler.toml

2. **Image Optimization**
   - Use Next.js Image component
   - Cloudflare will cache optimized images

3. **Database Optimization**
   - Add indexes for frequently queried columns
   - Batch operations where possible

4. **Monitor Performance**
   - Use Cloudflare Analytics
   - Check Time to First Byte (TTFB)
   - Monitor database query times

## Cost Optimization

The free tier includes:
- Unlimited Pages deployments
- 100,000 D1 database requests/day
- Up to 10GB storage in D1
- Unlimited bandwidth

When upgrading:
- D1 costs $0.75/month after free tier
- Keep worker usage under 100,000 requests/day
- Monitor storage usage

## Next: Setup API Integrations

With your JMS deployed, next steps are:

1. **Setup SendGrid for Email**
   - Create SendGrid account
   - Get API key
   - Add to environment variables

2. **Setup Cloudflare R2 for Images**
   - Create R2 bucket
   - Configure CORS
   - Update image upload endpoints

3. **Configure Custom SMTP**
   - For outbound email notifications
   - Set up bounce handling

---

Congratulations! JMS is now live on Cloudflare.
