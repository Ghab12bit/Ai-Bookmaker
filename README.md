# AdClear Review — Design Feedback Portal

Internal tool for anchored, batched, staged design feedback. Replaces scattered WhatsApp threads with a single canvas where every comment lives on a coordinate of the design.

## Setup

### 1. Supabase

1. Create a Supabase project at [supabase.com](https://supabase.com)
2. Run the SQL in `supabase-schema.sql` in the SQL Editor to create all tables, RLS policies, and storage buckets
3. Copy your project URL and anon key

### 2. Environment

```bash
cp .env.local.example .env.local
```

Fill in `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

### 3. Team Accounts

Create team accounts manually in Supabase Auth, then insert matching `profiles` rows:

```sql
INSERT INTO profiles (id, name, role) VALUES
  ('<auth-user-id>', 'Designer Name', 'designer'),
  ('<auth-user-id>', 'AM Name', 'am');
```

### 4. Run

```bash
npm install
npm run dev
```

### 5. Deploy

Connect the GitHub repo to Vercel, add the same env vars, and deploy.

## Architecture

- **Next.js** (App Router, TypeScript)
- **Supabase** — Postgres, Auth, Realtime, Storage
- **Tailwind CSS** + shadcn/ui-style components

## Roles

| Role | Auth | Capabilities |
|------|------|-------------|
| Designer | Email + password | Upload designs, resolve pins, set status |
| Account Manager | Email + password | Comment, move stage, share client link |
| Client | Magic link (no account) | Comment on client-stage designs, approve |
