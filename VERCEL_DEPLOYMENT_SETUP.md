# Vercel Automatic Deployment Setup Guide

This repository is now configured for automatic deployment to Vercel on every push to main/master/develop branches.

## Quick Start - Complete These Steps

### Step 1: Create Vercel Account & Project

1. Go to https://vercel.com
2. Sign in with GitHub or create an account
3. Click "Add New" → "Project"
4. Import the SignBridge repository
5. Click "Import"
6. Vercel will detect it's an Angular project and auto-configure:
   - **Framework Preset:** Angular
   - **Build Command:** `npm run build:prod`
   - **Output Directory:** `dist/signbridge`
7. Click "Deploy" and wait for completion

### Step 2: Get Your Vercel Tokens

After deployment completes:

1. Go to https://vercel.com/account/tokens
2. Create a new token (name it: `GITHUB_ACTIONS_DEPLOY`)
3. Copy the token (you'll use it in Step 3)

### Step 3: Get Project IDs

1. Go to your SignBridge project in Vercel
2. Go to Settings → General
3. Copy:
   - **Project ID** (looks like: `prj_xxxxx`)
   - **Org ID** (at the top, looks like: `team_xxxxx`)

### Step 4: Add GitHub Secrets

1. Go to https://github.com/Soumya-code-ai/SignBridge
2. Click Settings → Secrets and variables → Actions
3. Click "New repository secret" and add:

**Secret 1:**
- **Name:** `VERCEL_TOKEN`
- **Value:** [Paste the token from Step 2]

**Secret 2:**
- **Name:** `VERCEL_ORG_ID`
- **Value:** [Paste your Org ID from Step 3]

**Secret 3:**
- **Name:** `VERCEL_PROJECT_ID`
- **Value:** [Paste your Project ID from Step 3]

### Step 5: Create Pull Request & Merge

1. Go to https://github.com/Soumya-code-ai/SignBridge/pull/new/setup-vercel-deployment
2. Click "Create pull request"
3. Add title: "Setup Vercel automatic deployment"
4. Click "Create pull request"
5. Once the PR checks pass, click "Merge pull request"

## Result ✅

After merging:
- Every push to `main`, `master`, or `develop` will automatically deploy to Vercel
- Pull requests will create preview URLs
- Production deployment link: **https://signbridge-[your-project-name].vercel.app**

## Verify It Works

1. After merging, go to your repository's "Actions" tab
2. You should see the "Deploy to Vercel" workflow running
3. Once complete, you'll get a deployment URL in the workflow logs

## Troubleshooting

If the workflow fails:
1. Check GitHub Actions logs for error details
2. Verify all three secrets are correctly set (no extra spaces)
3. Ensure your Vercel project is properly linked to the repository
4. Re-run the workflow from the Actions tab

## Your Deployment Link

Once deployed successfully, your SignBridge app will be live at:
```
https://signbridge-[project-name].vercel.app
```

You can share this link immediately!
