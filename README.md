# PunchDesk v2 — Setup Guide

A full-stack workforce time tracking app with individual employee accounts,
remote clock-in, manager dashboards, and holiday management.

---

## What You're Getting

| Feature | Details |
|---|---|
| **Individual accounts** | Each employee logs in with their own email + password |
| **Roles** | `admin`, `manager`, `employee` — different views per role |
| **Remote clock-in** | Works on any device with a browser — phone, tablet, laptop |
| **Location logging** | Remote / Office / Field captured on every clock-in |
| **Manager dashboard** | See who's clocked in live, approve timesheets & time-off |
| **Holiday auto-apply** | Holidays flow into timesheets automatically |
| **Row-level security** | Employees can only see their own data; managers see all |

---

## Prerequisites

- A computer with a terminal (Mac Terminal or Windows PowerShell)
- Node.js 18+ — download from **nodejs.org** if you don't have it

---

## Step 1 — Supabase (Database + Auth)

### 1.1 Create your project
1. Go to **supabase.com** → Sign up (use GitHub for easiest setup)
2. Click **New project**
3. Name it `punchdesk`, choose a region close to Hawaii (US West)
4. **Save your database password** — you'll need it later
5. Wait ~2 minutes for provisioning

### 1.2 Run the database schema
1. In your Supabase project, click **SQL Editor** in the left sidebar
2. Click **New query**
3. Copy the entire contents of `sql/schema.sql` from this project
4. Paste it in and click **Run**
5. You should see "Success" at the bottom

This creates all tables, security rules, and seeds 2026 US federal holidays.

### 1.3 Enable Email Auth
1. Go to **Authentication → Providers**
2. Make sure **Email** is enabled (it is by default)
3. Go to **Authentication → Email Templates** and customize the invite/reset emails with your company name

### 1.4 Get your API keys
1. Go to **Project Settings → API** (gear icon)
2. Copy:
   - **Project URL** → looks like `https://xxxx.supabase.co`
   - **anon / public key** → the long JWT string (NOT the service_role key)

---

## Step 2 — GitHub (Version Control)

### 2.1 Create account and install Git
- Sign up at **github.com**
- Install Git from **git-scm.com** (Windows) or run `xcode-select --install` (Mac)

### 2.2 Create a private repository
1. Click **+** → **New repository**
2. Name: `punchdesk`
3. Visibility: **Private** ← important for employee data
4. Don't add README

### 2.3 Push this project
```bash
cd path/to/punchdesk-v2

git init
git add .
git commit -m "Initial PunchDesk v2"
git remote add origin https://github.com/YOUR_USERNAME/punchdesk.git
git branch -M main
git push -u origin main
```

> For the Git password prompt, use a **Personal Access Token**:
> GitHub → Settings → Developer settings → Personal access tokens → Generate new token
> Check the `repo` scope.

---

## Step 3 — Vercel (Hosting)

### 3.1 Sign up and import
1. Go to **vercel.com** → Sign Up → **Continue with GitHub**
2. Click **Add New… → Project**
3. Find `punchdesk` in your repo list → click **Import**

### 3.2 Configure environment variables
Before clicking Deploy, click **Environment Variables** and add:

| Name | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon key |

Set both for **Production**, **Preview**, and **Development**.

### 3.3 Deploy
Click **Deploy**. In ~60 seconds you'll get a live URL like:
```
https://punchdesk-yourname.vercel.app
```

Every `git push` to `main` auto-redeploys.

---

## Step 4 — Create Your First Admin Account

1. Go to your live app URL
2. Click **Sign Up** (or go to Supabase → Authentication → Users → Invite user)
3. Use your email to create the first account
4. In Supabase → **Table Editor → profiles**, find your row and change `role` from `employee` to `admin`
5. Sign back in — you now have full manager access

---

## Step 5 — Invite Your Team

As an admin:
1. Click **Employees** in the sidebar → **Invite Employee**
2. Enter their name, work email, and role
3. They'll receive an email to set their password
4. Once they log in, they see the **Time Clock** page and can clock in from anywhere

---

## Local Development (optional)

To run locally before deploying:

```bash
# Install dependencies
npm install

# Create environment file
cp .env.example .env.local
# Edit .env.local and add your Supabase keys

# Start the dev server
npm run dev
```

Open **http://localhost:3000**

---

## Roles Explained

| Role | Can Do |
|---|---|
| `employee` | Clock in/out, view own timesheets, request time off, see holidays |
| `manager` | Everything above + approve timesheets, approve/deny time off, manage holidays, see all employees clocked in |
| `admin` | Everything above + invite employees, change roles, manage all settings |

---

## File Structure

```
punchdesk-v2/
├── pages/
│   ├── _app.js          # Next.js app wrapper
│   └── index.js         # Main app (all pages in one file)
├── lib/
│   ├── supabase.js      # Supabase client setup
│   └── db.js            # All database functions
├── sql/
│   └── schema.sql       # Run this in Supabase SQL Editor
├── .env.example         # Copy to .env.local, add your keys
├── .gitignore           # Keeps secrets out of Git
├── next.config.js
└── package.json
```

---

## Need Help?

- **Supabase docs**: docs.supabase.com
- **Vercel docs**: vercel.com/docs
- **Next.js docs**: nextjs.org/docs

Or ask Claude to add a feature — just describe what you need!
