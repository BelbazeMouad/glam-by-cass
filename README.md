# Glam by Cass — Full Booking Website

A complete Next.js + Supabase + Stripe website: public site with a real booking calendar and deposit payments, plus an admin panel where Cass edits prices/deposits, blocks days off, and manages bookings, reels, and messages.

**Booked+paid dates and manually blocked days automatically show as unavailable on the public calendar.**

---

## What you need (all have free tiers)
- **Node.js** 18+ installed
- A **Supabase** account (database + login) — supabase.com
- A **Stripe** account (payments) — stripe.com

---

## Setup — step by step

### 1. Install
```bash
npm install
```

### 2. Supabase (database + admin login)
1. Create a project at supabase.com. Wait for it to finish provisioning.
2. Go to **SQL Editor** → New query → paste the entire contents of `supabase/schema.sql` → **Run**. This creates all tables, security rules, and seeds starter services.
3. Go to **Project Settings → API** and copy:
   - Project URL
   - `anon` public key
   - `service_role` secret key
4. Create Cass's login: **Authentication → Users → Add user** (enter her email + a password). This is the only account — clients never log in.

### 3. Stripe (deposits)
1. In the Stripe Dashboard, grab **Developers → API keys**: publishable key + secret key (use test keys first).
2. Set up the webhook so paid deposits mark bookings confirmed:
   - **Developers → Webhooks → Add endpoint**
   - URL: `https://YOUR-SITE.com/api/stripe-webhook` (for local testing use the Stripe CLI, see below)
   - Events: select `checkout.session.completed`
   - Copy the **Signing secret** (`whsec_…`)

### 4. Environment variables
Copy `.env.local.example` to `.env.local` and fill in every value from steps 2 and 3.

### 5. Run it
```bash
npm run dev
```
Open http://localhost:3000 — the site is live.
Admin panel: http://localhost:3000/admin (log in with the Supabase user you created).

### Testing Stripe locally
Install the Stripe CLI, then:
```bash
stripe listen --forward-to localhost:3000/api/stripe-webhook
```
It prints a `whsec_…` — put that in `.env.local` as `STRIPE_WEBHOOK_SECRET`. Use test card `4242 4242 4242 4242`, any future expiry/CVC.

---

## How it works

**Client books:** picks a service → picks an available date (greyed = taken or day off) → enters name/email → pays the deposit via Stripe → returns to a confirmation page. When Stripe confirms payment, the webhook marks the booking `paid + confirmed`, and that date immediately shows as unavailable to everyone else.

**Cass's admin panel** (`/admin`):
- **Services & Prices** — edit each service's name, description, price, and deposit. Changes appear on the booking page instantly.
- **Days Off** — block any date (vacation, personal). Blocked days grey out on the public calendar.
- **Bookings** — see every booking, who paid, cancel if needed, export CSV.
- **Reels** — add/remove portfolio videos.
- **Messages** — read contact-form messages.

---

## Deploy (free)
1. Push this folder to a GitHub repo.
2. Import it at **vercel.com** → add all the `.env.local` variables in Vercel's Environment Variables settings → Deploy.
3. Update the Stripe webhook URL to your real Vercel domain, and set `NEXT_PUBLIC_SITE_URL` to it.
4. Buy a domain (~€10/yr) and point it at Vercel.

---

## Prefer Cal.com instead of the built-in calendar?
The built-in calendar already does everything (bookings, deposits, blocking). But if you'd rather use Cal.com: set up Cal.com + Stripe there, and drop its embed on the Book page. The `NEXT_PUBLIC_CALCOM_LINK` env var is included for that. The built-in system is recommended since it keeps everything in one place and in Cass's admin panel.

---

## File map
```
app/
  page.jsx                    public site (home/about/services/portfolio/book/contact)
  globals.css                 all styling (the Glam design)
  components/BookingCalendar.jsx   real calendar + deposit checkout
  admin/page.jsx              admin login
  admin/Dashboard.jsx         admin panels (prices, days off, bookings, reels, messages)
  booking-confirmed/page.jsx  post-payment thank-you
  api/availability/route.js   services + unavailable dates (public)
  api/checkout/route.js       creates Stripe deposit session
  api/stripe-webhook/route.js marks booking paid → blocks the date
  api/contact/route.js        saves contact messages
lib/supabase.js               database clients
supabase/schema.sql           run this once in Supabase
public/                       logo images
```
