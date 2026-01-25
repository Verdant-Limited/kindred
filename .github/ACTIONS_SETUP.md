# GitHub Actions Setup for Room Cleanup

This GitHub Actions workflow automatically cleans up inactive rooms every hour.

## Setup Instructions

### 1. Deploy the Supabase Edge Function

First, deploy the cleanup function to Supabase:

```bash
# Install Supabase CLI if you haven't already
brew install supabase/tap/supabase

# Login to Supabase
supabase login

# Link your project (replace with your project ref)
supabase link --project-ref YOUR_PROJECT_REF

# Deploy the function
supabase functions deploy cleanup-rooms
```

### 2. Add GitHub Secrets

Go to your GitHub repository:
**Settings → Secrets and variables → Actions → New repository secret**

Add these two secrets:

#### `SUPABASE_FUNCTION_URL`

Your cleanup function URL:

```
https://YOUR_PROJECT_REF.supabase.co/functions/v1/cleanup-rooms
```

To find your project ref:

- Go to Supabase Dashboard
- Settings → General
- Copy "Reference ID"

#### `SUPABASE_ANON_KEY`

Your Supabase anon/public key:

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

To find your anon key:

- Go to Supabase Dashboard
- Settings → API
- Copy "anon" key (under "Project API keys")

### 3. Test the Workflow

After adding the secrets, you can test it manually:

1. Go to your GitHub repository
2. Click **Actions** tab
3. Select "Cleanup Inactive Rooms" workflow
4. Click **Run workflow** → **Run workflow**
5. Check the results

### 4. Verify It's Running

The workflow runs automatically every hour. Check:

- **Actions** tab to see execution history
- Click any run to see logs
- Look for "Cleanup completed successfully"

## What It Does

Every hour, the workflow:

1. Marks rooms inactive after 24 hours of no activity
2. Deletes rooms that have been inactive/ended for 7+ days
3. Logs the results

## Troubleshooting

### "Error: Cleanup function failed"

- Check that the function is deployed: `supabase functions list`
- Verify your secrets are correct
- Check function logs in Supabase Dashboard

### Workflow not running

- Check that the workflow file is in `.github/workflows/`
- Verify the repository has Actions enabled (Settings → Actions)
- Wait up to 1 hour for first scheduled run

### Manual trigger not working

- Ensure you've pushed the workflow file to GitHub
- Check that secrets are added correctly
- Try running locally: `curl -X POST "YOUR_FUNCTION_URL" -H "Authorization: Bearer YOUR_ANON_KEY"`

## Cost

GitHub Actions is free for public repositories and includes 2,000 minutes/month for private repos. This workflow uses ~1 minute per month (24 hours × 30 days = 720 runs × ~0.001 minutes each).
