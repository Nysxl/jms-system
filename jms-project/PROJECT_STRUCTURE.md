# Project Structure Guide

## Directory Organization

```
jms-system/
├── pages/                          # Next.js pages & API routes
│   ├── _app.tsx                    # App wrapper & global config
│   ├── index.tsx                   # Landing page
│   ├── dashboard.tsx               # Main dashboard
│   ├── login.tsx                   # Login page (to create)
│   ├── signup.tsx                  # Signup page (to create)
│   ├── jobs/
│   │   ├── index.tsx               # Jobs list page (to create)
│   │   └── [id].tsx                # Job detail page (to create)
│   ├── customers/
│   │   ├── index.tsx               # Customers list (to create)
│   │   └── [id].tsx                # Customer detail (to create)
│   ├── inventory/                  # Inventory pages (to create)
│   ├── invoices/                   # Invoice pages (to create)
│   ├── reports/                    # Reports pages (to create)
│   └── api/
│       ├── auth/
│       │   ├── login.ts            # Login endpoint
│       │   ├── signup.ts           # Signup endpoint (to create)
│       │   └── logout.ts           # Logout endpoint (to create)
│       ├── jobs/
│       │   ├── index.ts            # Get/create jobs
│       │   └── [id].ts             # Get/update/delete job
│       ├── customers/
│       │   ├── index.ts            # Customer CRUD (to create)
│       │   └── [id].ts             # Individual customer (to create)
│       ├── invoices/               # Invoice endpoints (to create)
│       ├── reports/                # Report endpoints (to create)
│       └── inventory/              # Inventory endpoints (to create)
│
├── components/                      # Reusable React components
│   ├── Header.tsx                  # Navigation header
│   ├── Footer.tsx                  # Footer (to create)
│   ├── JobCard.tsx                 # Job card component
│   ├── CreateJobModal.tsx          # Job creation modal
│   ├── CustomerForm.tsx            # Customer form (to create)
│   ├── InvoiceGenerator.tsx        # Invoice UI (to create)
│   ├── SignatureCanvas.tsx         # Signature capture (to create)
│   └── forms/
│       ├── LoginForm.tsx           # Login form (to create)
│       ├── SignupForm.tsx          # Signup form (to create)
│       └── JobForm.tsx             # Job form (to create)
│
├── lib/                             # Library & utility code
│   ├── supabase.ts                 # Supabase client & auth
│   ├── types.ts                    # TypeScript interfaces
│   ├── db.ts                       # Database helpers
│   ├── constants.ts                # App constants (to create)
│   ├── utils.ts                    # Utility functions (to create)
│   ├── api-client.ts               # API request helper (to create)
│   └── hooks/
│       ├── useAuth.ts              # Auth hook (to create)
│       ├── useJobs.ts              # Jobs hook (to create)
│       └── useCustomers.ts         # Customers hook (to create)
│
├── styles/                          # Global styles
│   ├── globals.css                 # Tailwind & custom styles
│   └── theme.css                   # Theme variables (to create)
│
├── public/                          # Static assets
│   ├── favicon.ico
│   ├── logo.svg                    # App logo
│   └── images/
│
├── config/                          # Configuration files
│   ├── nav.config.ts               # Navigation config (to create)
│   └── constants.config.ts         # App constants (to create)
│
├── hooks/                           # Global hooks
│   └── useAppState.ts              # Global state (to create)
│
├── store/                           # Zustand store (optional)
│   └── appStore.ts                 # Global store (to create)
│
├── utils/                           # Utility functions
│   ├── formatters.ts               # Date, currency, etc (to create)
│   └── validators.ts               # Form & data validation (to create)
│
├── middleware/                      # API middleware
│   ├── auth.ts                     # Auth middleware (to create)
│   └── errorHandler.ts             # Error handling (to create)
│
├── types/                           # Additional type definitions
│   └── next.d.ts                   # Next.js type extensions (to create)
│
├── __tests__/                       # Test files (optional)
│   ├── pages/                      # Page tests
│   ├── components/                 # Component tests
│   └── lib/                        # Library tests
│
├── .github/                         # GitHub configuration
│   └── workflows/
│       ├── deploy.yml              # Deploy workflow (to create)
│       └── test.yml                # Test workflow (to create)
│
├── .env.local.example              # Example env variables
├── .gitignore                      # Git ignore rules
├── DATABASE_SCHEMA.sql             # D1 schema
├── DEPLOYMENT_GUIDE.md             # Deployment steps
├── SECURITY.md                     # Security policy
├── README.md                       # Project documentation
├── PROJECT_STRUCTURE.md            # This file
├── wrangler.toml                   # Cloudflare config
├── next.config.js                  # Next.js config
├── tsconfig.json                   # TypeScript config
├── tailwind.config.ts              # Tailwind config
├── postcss.config.js               # PostCSS config
└── package.json                    # Dependencies
```

## File Naming Conventions

### React Components
- **Naming:** PascalCase (e.g., `JobCard.tsx`)
- **Location:** `/components`
- **Format:** Functional components with TypeScript
- **Props:** Define `interface ComponentNameProps`

Example:
```typescript
interface JobCardProps {
  job: Job;
  onEdit?: (job: Job) => void;
}

export const JobCard: React.FC<JobCardProps> = ({ job, onEdit }) => {
  // Component code
};
```

### Pages
- **Naming:** lowercase with hyphens for multi-word (e.g., `dashboard.tsx`)
- **Location:** `/pages`
- **Default export:** The page component
- **Format:** Next.js page format

### API Routes
- **Naming:** RESTful naming (e.g., `[id].ts`, `index.ts`)
- **Location:** `/pages/api/*`
- **Naming pattern:** 
  - `index.ts` for `GET` and `POST`
  - `[id].ts` for `GET`, `PUT`, `DELETE`

### Utilities & Libraries
- **Naming:** camelCase (e.g., `formatDate.ts`)
- **Location:** `/lib` or `/utils`
- **Export:** Named exports for multiple functions, default for single function

### Hooks
- **Naming:** `use{HookName}` (e.g., `useAuth.ts`)
- **Location:** `/lib/hooks` or `/hooks`
- **Return:** Return object or array based on use case

## Import Path Aliases

Configured in `tsconfig.json`:

```typescript
// Instead of: ../../../lib/types
import { Job } from '@/lib_types';

// Instead of: ../../components/Header
import { Header } from '@/components/Header';

// Available aliases:
// @/* = root directory
```

## Module Dependency Flow

```
Pages (UI Entry Points)
    ↓
Components (Reusable UI)
    ↓
Hooks (Logic, State)
    ↓
Lib (Business Logic, Types, Utils)
    ↓
API Routes (Server Logic)
    ↓
Database (D1, Supabase)
```

## Create New Feature Checklist

When adding a new feature (e.g., Contracts), follow this:

### 1. Define Types
```
- Add types to `lib/types.ts`
- Create `Contract`, `ContractStatus` interfaces
```

### 2. Create API Routes
```
pages/api/contracts/index.ts     (GET, POST)
pages/api/contracts/[id].ts      (GET, PUT, DELETE)
```

### 3. Create Database Functions
```
- Add SQL in `DATABASE_SCHEMA.sql`
- Add helper functions in `lib/db.ts`
```

### 4. Create Components
```
components/ContractCard.tsx
components/CreateContractModal.tsx
components/ContractForm.tsx
```

### 5. Create Hooks
```
lib/hooks/useContracts.ts
```

### 6. Create Pages
```
pages/contracts/index.tsx        (List view)
pages/contracts/[id].tsx         (Detail view)
pages/contracts/new.tsx          (Create view)
```

### 7. Update Navigation
```
- Add link to Header component
- Add route to nav.config.ts
- Update types if needed
```

## Phase 1-5 File Distribution

### Phase 1: Job Management ✅
```
pages/
├── dashboard.tsx
├── index.tsx
├── _app.tsx
└── api/
    ├── auth/login.ts
    └── jobs/
        ├── index.ts
        └── [id].ts

components/
├── Header.tsx
├── JobCard.tsx
└── CreateJobModal.tsx

lib/
├── supabase.ts
├── types.ts
└── db.ts
```

### Phase 2: Notes & Images (To Create)
```
New files:
├── api/jobs/images.ts
├── api/jobs/notes.ts
├── components/JobNoteInput.tsx
├── components/ImageGallery.tsx
└── components/SignatureCanvas.tsx
```

### Phase 3: Email Integration (To Create)
```
New files:
├── lib/email.ts
├── lib/templates/
├── api/email/send.ts
└── pages/notifications.tsx
```

### Phase 4: Contracts & Invoices (To Create)
```
New files:
├── pages/contracts/
├── pages/invoices/
├── api/contracts/
├── api/invoices/
└── components/
    ├── InvoiceGenerator.tsx
    └── ContractTemplate.tsx
```

### Phase 5: Inventory (To Create)
```
New files:
├── pages/inventory/
├── api/inventory/
└── components/
    ├── InventoryList.tsx
    └── InventoryForm.tsx
```

## Database Schema Organization

See `DATABASE_SCHEMA.sql` for complete schema. Key tables:

- **Core:** users, customers, jobs
- **Job Details:** job_notes, job_images, job_signatures
- **Documents:** service_reports, contracts, invoices, invoice_items
- **Inventory:** inventory, inventory_transactions

All tables include:
- Unique ID (UUID or snowflake ID)
- user_id (for isolation)
- created_at & updated_at timestamps
- Appropriate indexes

## Performance Considerations

### Code Splitting
- Next.js automatically code-splits at page level
- Use dynamic imports for heavy components:

```typescript
const HeavyComponent = dynamic(() => import('@/components/Heavy'), {
  loading: () => <div>Loading...</div>,
});
```

### Image Optimization
- Use `next/image` for all images
- Cloudflare serves optimized versions

### Database
- All queries parameterized
- Indexes on foreign keys & frequently searched fields
- Batch operations for bulk imports

## Best Practices

1. **Keep components small** - max 300 lines per file
2. **Separate logic from UI** - use hooks for logic
3. **Type everything** - no `any` types
4. **Reusable components** - DRY principle
5. **Consistent naming** - follow conventions above
6. **Document complex code** - use JSDoc comments
7. **Test before merge** - run tests locally
8. **Code review** - peer review before deployment

---

Use this structure to keep the codebase organized as you build out all phases.
