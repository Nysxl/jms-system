# Quick Start Guide

Get JMS running locally in 5 minutes.

## Prerequisites

- Node.js 18+
- npm or yarn
- Supabase account (https://supabase.com)
- Cloudflare account (https://cloudflare.com)
- Git

## Step 1: Clone & Install (2 min)

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/jms-system.git
cd jms-system

# Install dependencies
npm install

# Or with yarn
yarn install
```

## Step 2: Setup Supabase (2 min)

1. Go to https://supabase.com
2. Create new project:
   - Project name: `jms`
   - Password: (create strong one)
   - Select region closest to you

3. Once created, go to Settings → API Keys
4. Copy `Project URL` and `anon/public` key

5. Create `.env.local` in project root:

```bash
cp .env.local.example .env.local
```

6. Edit `.env.local` and add:

```
NEXT_PUBLIC_SUPABASE_URL=YOUR_PROJECT_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY
```

## Step 3: Start Development Server (1 min)

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

You should see the JMS landing page!

## Step 4: Create Your First Job

1. Click "Sign In" or "Sign Up"
2. Create account (use test email)
3. Go to Dashboard
4. Click "Create Job"
5. Select a customer and enter job details
6. Click "Create Job"

✅ Success! Your first job is created.

## Next Steps

### To Deploy (see `DEPLOYMENT_GUIDE.md`):
```bash
# Push to GitHub
git push origin main

# Connect to Cloudflare Pages
# CI/CD will deploy automatically
```

### To Continue Development:
- Follow `PROJECT_STRUCTURE.md` for adding new features
- Check `SECURITY.md` for best practices
- Read `README.md` for full documentation

### To Add More Features:
- Phase 2: Add images & notes to jobs
- Phase 3: Setup email notifications
- Phase 4: Create invoices & contracts
- Phase 5: Add inventory management

## Common Commands

```bash
# Development
npm run dev                 # Start dev server
npm run build              # Build for production
npm start                  # Run production build

# Linting
npm run lint               # Check code style

# Database (after setup)
wrangler d1 list          # List databases
wrangler d1 execute jms   # Run SQL queries
```

## Troubleshooting

### Port 3000 in use?
```bash
npm run dev -- -p 3001
```

### Supabase connection error?
1. Check `.env.local` has correct URLs/keys
2. Verify internet connection
3. Ensure Supabase project is active

### Build errors?
```bash
# Clear Next.js cache
rm -rf .next

# Reinstall dependencies
rm -rf node_modules
npm install

# Try building again
npm run build
```

## File Structure Reference

```
jms-system/
├── pages/               # Pages & API routes
├── components/          # React components
├── lib/                 # Utilities & types
├── styles/              # CSS & Tailwind
├── .env.local           # Your secrets (don't commit!)
├── wrangler.toml        # Cloudflare config
└── DATABASE_SCHEMA.sql  # Database structure
```

## Important Files

- **README.md** - Full documentation
- **DEPLOYMENT_GUIDE.md** - Deploy to Cloudflare
- **SECURITY.md** - Security best practices
- **PROJECT_STRUCTURE.md** - Code organization
- **.env.local** - Your secrets (NEVER commit!)

## What's Included

✅ Authentication (Supabase)
✅ Dark mode UI (Tailwind CSS)
✅ Job management
✅ Customer management
✅ API routes (boilerplate)
✅ TypeScript types
✅ Database schema

## What to Add Next

- [ ] Customer signup/login pages
- [ ] Job detail page
- [ ] Customer list page
- [ ] Job notes feature
- [ ] Image upload
- [ ] Customer signature
- [ ] Email notifications
- [ ] Invoice generation
- [ ] Service reports
- [ ] Contracts
- [ ] Inventory system

## Get Help

- **Docs:** Read README.md, DEPLOYMENT_GUIDE.md, SECURITY.md
- **GitHub:** Check issues and discussions
- **Supabase:** https://supabase.com/docs
- **Next.js:** https://nextjs.org/docs
- **Cloudflare:** https://developers.cloudflare.com

## Next Phase

Once comfortable, move to Phase 2:

```
Phase 2: Notes, Images & Signatures
- Add job notes
- Upload images
- Customer signature capture
- Continue with other phases
```

---

🚀 You're all set! Start building!
