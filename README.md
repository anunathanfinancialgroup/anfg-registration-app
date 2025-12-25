# CAN Client Registration (Self-hosted, free-tier friendly)

This project recreates your Client Registration form as a self-hosted web app:
- React + Vite frontend (deploy free on Cloudflare Pages / Vercel)
- Supabase Postgres for saving registrations
- Supabase Edge Function sends confirmation email + saves the lead
- Mailjet free tier for email sending

## 1) Local dev

### Install
```bash
npm install
```

### Configure frontend env
Create `.env` from `.env.example` and set:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

### Run
```bash
npm run dev
```

---

## 2) Supabase setup (database + edge function)

### A) Create project
Create a Supabase project and note your Project Ref / URL.

### B) Create the table
Run the SQL in:
`supabase/migrations/001_create_client_registrations.sql`

You can paste it into Supabase SQL Editor.

### C) Install Supabase CLI (one-time)
https://supabase.com/docs/guides/cli

### D) Link and deploy the function
From this repo root:
```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase functions deploy register
```

### E) Set Edge Function secrets
Set these in Supabase dashboard (Project Settings → Functions → Secrets) or CLI:

Required:
- `MAILJET_API_KEY`
- `MAILJET_SECRET_KEY`
- `FROM_EMAIL` (the email Mailjet allows you to send from)
- `SUPABASE_SERVICE_ROLE_KEY` (already available in Supabase project settings)
- `SUPABASE_URL` (already available)

Optional:
- `FROM_NAME` (defaults to “CAN Financial Solutions”)
- `ADMIN_NOTIFY_EMAIL` (send a copy to your business email)
- `LOGO_URL` (public URL for a logo used in email)

Tip: if you don’t want to host the logo, just set `LOGO_URL` to an empty string.

---

## 3) Deploy frontend (free)

### Cloudflare Pages (recommended)
1. Push this repo to GitHub
2. Cloudflare Pages → Create Project → Connect repo
3. Build command: `npm run build`
4. Output directory: `dist`
5. Add env variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

---

## 4) Notes
- The app requires at least one meeting day and AM/PM
- If “Entrepreneurship” or “Client” is selected, the matching section requires at least one checkbox
- Submissions are stored in `client_registrations`
