# Supabase Setup

This directory contains database migrations for the English Learning System.

## Setup Instructions

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Sign up / Sign in
3. Click "New Project"
4. Fill in:
   - **Name**: `english-learning` (or any name you prefer)
   - **Database Password**: (save this securely!)
   - **Region**: Choose closest to you
5. Wait for project to be created (~2 minutes)

### 2. Get Project Credentials

1. Go to Project Settings → API
2. Copy:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **anon/public key** (for client-side)
   - **service_role key** (for server-side, keep secret!)

### 3. Apply Migrations

#### Option A: Via Supabase Dashboard (SQL Editor)

1. Go to SQL Editor in Supabase Dashboard
2. Copy contents of `migrations/20250101000000_initial_schema.sql`
3. Paste and run

#### Option B: Via Supabase CLI (recommended for development)

```bash
# Install Supabase CLI
npm install -g supabase

# Link to your project
supabase link --project-ref your-project-ref

# Apply migrations
supabase db push
```

### 4. Set Environment Variables

Create `.env.local` (or `.env`) in project root:

```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## Migration Files

- `migrations/20250101000000_initial_schema.sql` - Initial schema (profiles, words, pronunciations)

## Seed Data

Seed scripts for populating initial data (e.g., 3000 words) will be added in `seed/` directory.

