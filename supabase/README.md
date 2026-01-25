# Room Cleanup System

This directory contains the automated room cleanup system for Kindred.

## Components

### 1. Database Migration (`migrations/20260124_add_activity_tracking.sql`)

Adds:

- `last_activity` timestamp - tracks when room was last updated
- `ended_at` timestamp - tracks when room was ended/marked inactive
- Database functions for cleanup
- Trigger to auto-update `last_activity` on changes

### 2. Edge Function (`functions/cleanup-rooms/index.ts`)

Runs cleanup logic:

- Marks rooms inactive after 24 hours of no activity
- Deletes rooms after 7 days of being inactive/ended

## Setup Instructions

### Step 1: Run the Migration

```bash
# Option A: Using Supabase CLI
supabase db push

# Option B: Manual in Supabase Dashboard
# Go to SQL Editor and paste the contents of the migration file
```

### Step 2: Deploy Edge Function

```bash
# Deploy the cleanup function
supabase functions deploy cleanup-rooms

# Verify deployment
supabase functions list
```

### Step 3: Schedule the Function

In Supabase Dashboard > Database > Cron Jobs (if available):

```sql
-- Run cleanup every hour
SELECT cron.schedule(
  'hourly-room-cleanup',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT.supabase.co/functions/v1/cleanup-rooms',
    headers := '{"Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb
  )
  $$
);
```

**OR** use a third-party cron service (cron-job.org, GitHub Actions, etc.) to call:

```
POST https://YOUR_PROJECT.supabase.co/functions/v1/cleanup-rooms
Authorization: Bearer YOUR_ANON_KEY
```

### Step 4: Update Application Code

The migration adds `last_activity` which auto-updates on changes. Optionally, you can manually update it when users interact with the room:

```typescript
// Optional: Manually touch last_activity when users join/interact
await supabase
	.from('programs')
	.update({ last_activity: new Date().toISOString() })
	.eq('id', roomCode);
```

## Cleanup Logic

- **Active → Inactive**: After 24 hours of no `last_activity`
- **Inactive/Ended → Deleted**: After 7 days of being in that state
- Users joining/updating room = `last_activity` updates automatically

## Testing

Test the cleanup function manually:

```bash
# Invoke function locally
supabase functions serve cleanup-rooms

# Call it
curl -X POST http://localhost:54321/functions/v1/cleanup-rooms
```

## Monitoring

Check logs in Supabase Dashboard > Functions > cleanup-rooms > Logs
