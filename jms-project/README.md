# Job Management System (JMS)

A professional, secure, and aesthetically beautiful job management system built with Next.js and Cloudflare.

## Features

### Phase 1 (Current)
- ✅ Job creation and management
- ✅ Customer management
- ✅ Professional dark mode UI
- ✅ Secure authentication with Supabase
- ✅ Real-time job status tracking

### Phase 2-5 (Coming)
- Notes and image attachments per job
- Customer digital signature capability
- Email integration for notifications
- Service reports generation
- Contract management
- Invoice generation with payment tracking
- Inventory management system

## Tech Stack

- **Frontend:** Next.js 14, React, TypeScript, Tailwind CSS
- **Backend:** Cloudflare Workers, Next.js API Routes
- **Database:** Cloudflare D1 (SQLite)
- **Authentication:** Supabase Auth
- **Hosting:** Cloudflare Pages

## Prerequisites

- Node.js 18+ (LTS)
- npm or yarn
- Cloudflare account (free tier works)
- Supabase account (free tier works)
- Git

## Local Development Setup

### 1. Clone and Install

```bash
# Clone the repository
git clone <your-repo-url>
cd jms-system

# Install dependencies
npm install
```

### 2. Setup Environment Variables

```bash
# Copy example env file
cp .env.local.example .env.local

# Edit .env.local with your credentials:
# - Supabase URL and Keys
# - Cloudflare Account ID and API Token
```

### 3. Setup Supabase

1. Create a new project at https://supabase.com
2. Create a new table `users` with the schema from `DATABASE_SCHEMA.sql`
3. Get your project URL and API keys
4. Add to `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### 4. Setup Cloudflare D1 Database

```bash
# Install Wrangler CLI
npm install -g @cloudflare/wrangler

# Authenticate with Cloudflare
wrangler login

# Create D1 database
wrangler d1 create jms

# Apply schema
wrangler d1 execute jms --local --file=./DATABASE_SCHEMA.sql
```

### 5. Run Development Server

```bash
npm run dev
# or
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) to see the application.

## Database Schema

The system uses the following main tables:

### Users
- id (string, PK)
- email (string, unique)
- name (string)
- company_name (string, optional)
- avatar_url (string, optional)

### Customers
- id (string, PK)
- user_id (string, FK → users)
- name, email, phone, address
- company_name, notes

### Jobs
- id (string, PK)
- user_id (string, FK → users)
- customer_id (string, FK → customers)
- title, description, status, priority
- scheduled_date, completed_date
- total_amount, notes

### Additional Tables
- job_notes
- job_images
- job_signatures
- service_reports
- contracts
- invoices
- invoice_items
- inventory
- inventory_transactions

## API Endpoints

### Authentication
- `POST /api/auth/login` - Sign in
- `POST /api/auth/signup` - Register
- `POST /api/auth/logout` - Sign out

### Jobs
- `GET /api/jobs` - List all jobs
- `POST /api/jobs` - Create new job
- `GET /api/jobs/:id` - Get job details
- `PUT /api/jobs/:id` - Update job
- `DELETE /api/jobs/:id` - Delete job

### Customers
- `GET /api/customers` - List all customers
- `POST /api/customers` - Create customer
- `PUT /api/customers/:id` - Update customer
- `DELETE /api/customers/:id` - Delete customer

## Deployment to Cloudflare

### 1. Setup Cloudflare Project

```bash
# Install Wrangler if not already installed
npm install -g @cloudflare/wrangler

# Create wrangler.toml configuration
# Edit wrangler.toml with your:
# - account_id
# - database_id
# - Supabase credentials
```

### 2. Deploy

```bash
# Build the project
npm run build

# Deploy to Cloudflare Pages
wrangler deploy

# Or deploy via Git integration:
# 1. Push to GitHub
# 2. Connect repo to Cloudflare Pages
# 3. Set build command: npm run build
# 4. Set build output: .next
```

### 3. Configure Environment Variables

In Cloudflare Pages dashboard:
1. Go to Settings → Environment Variables
2. Add production variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`

## Security Features

✅ **Authentication**
- JWT-based authentication with Supabase
- Secure password hashing
- Session management

✅ **Database**
- Parameterized queries prevent SQL injection
- Row-level security with user_id isolation
- Encrypted sensitive fields

✅ **API**
- Token validation on all protected routes
- CORS configuration for origin validation
- Request rate limiting via Cloudflare

✅ **Frontend**
- TypeScript for type safety
- XSS protection with React
- CSP headers in Next.js

## Development Tips

### Adding New Pages

```bash
# Create a new page
touch pages/jobs.tsx

# Add to navigation in Header component
```

### Adding Components

Components go in `/components` and follow this pattern:

```typescript
interface MyComponentProps {
  prop1: string;
  prop2?: number;
}

export const MyComponent: React.FC<MyComponentProps> = ({
  prop1,
  prop2,
}) => {
  return (
    <div className="bg-slate-800 rounded-lg p-6">
      {/* Component content */}
    </div>
  );
};
```

### Working with the Database

Use the helper functions in `lib/db.ts`:

```typescript
import { createJob, getJobs, updateJob } from '@/lib_db';

// In your API route:
const jobs = await getJobs(db, userId);
```

## Styling

This project uses **Tailwind CSS** with a dark theme. Key colors:

- Primary: `#0f172a` (slate-950)
- Secondary: `#1e293b` (slate-800)
- Accent: `#3b82f6` (blue-500)

All components use the dark palette. For consistency:
- Use `bg-slate-*` for backgrounds
- Use `text-white` for text
- Use `border-slate-700` for borders
- Use `hover:bg-slate-600` for interactive states

## Troubleshooting

### Port 3000 already in use
```bash
# Use a different port
npm run dev -- -p 3001
```

### Database connection issues
```bash
# Check your connection string in .env.local
# Verify Cloudflare D1 is running: wrangler d1 list
```

### Supabase Auth errors
- Verify API keys are correct
- Check CORS settings in Supabase dashboard
- Ensure email verification is not required

## File Structure

```
jms-system/
├── pages/
│   ├── _app.tsx
│   ├── index.tsx
│   ├── dashboard.tsx
│   ├── login.tsx
│   ├── signup.tsx
│   └── api/
│       ├── auth/
│       ├── jobs/
│       └── customers/
├── components/
│   ├── Header.tsx
│   ├── JobCard.tsx
│   ├── CreateJobModal.tsx
│   └── ...
├── lib/
│   ├── supabase.ts
│   ├── types.ts
│   ├── db.ts
│   └── utils.ts
├── styles/
│   └── globals.css
├── public/
├── .env.local
├── wrangler.toml
├── next.config.js
├── tsconfig.json
└── package.json
```

## Next Steps

1. **Complete Phase 1 Setup**
   - Test all job CRUD operations
   - Verify authentication flow
   - Test on mobile responsiveness

2. **Move to Phase 2**
   - Add image upload with Cloudflare R2
   - Implement signature canvas
   - Add job notes functionality

3. **Add Email Integration**
   - Connect SendGrid or similar
   - Create email templates
   - Setup notification queue

4. **Production Deployment**
   - Set up domain with Cloudflare
   - Enable HTTPS
   - Configure monitoring

## Support & Issues

For issues or questions, refer to:
- [Next.js Documentation](https://nextjs.org)
- [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- [Supabase Docs](https://supabase.com/docs)
- [Tailwind CSS](https://tailwindcss.com)

## License

MIT - Feel free to use for your business.

---

Built with ❤️ for modern job management.
