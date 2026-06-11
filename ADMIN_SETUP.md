# Admin Setup Guide 👑

## Quick Start: Setting Up Your Admin Account

### Step 1: Create Your User Account
1. Go to `/register` and create a new account with your email
2. Set a strong password
3. Verify your email address

### Step 2: Make Yourself an Admin (Two Options)

#### **Option A: Using Prisma Studio (Easiest)**
```bash
npx prisma studio
```
1. This opens a local database GUI at `http://localhost:5555`
2. Click on the `User` table
3. Find your email in the list
4. Click the row to open it
5. Change `role` from `USER` to `ADMIN`
6. Save

You're now an admin! Go to `/admin` to see the dashboard.

#### **Option B: Using Prisma CLI**
```bash
npx prisma db execute --stdin
```

Then paste:
```sql
UPDATE "User" SET role = 'ADMIN' WHERE email = 'your-email@example.com';
```

Press Enter, then Ctrl+D to exit.

---

## What You Can Do as Admin

### Admin Dashboard (`/admin`)
- **Total Users**: See how many people have signed up
- **Active Subscriptions**: Track paying customers
- **Monthly Revenue**: Monitor $99/month subscriptions

### Coming Soon
- User management (suspend/reactivate accounts)
- Subscription tracking (who's paid, who's canceled)
- Revenue analytics (MRR, churn rate, LTV)
- Letter approval system (moderate generated letters)
- Compliance reporting (audit trail of disputes)

---

## User Roles Explained

### USER (Default)
- Free tier: 3 letters/month
- Premium tier: Unlimited letters + AI refinement
- Can create/view their own disputes only

### ADMIN
- Full access to `/admin` dashboard
- Can see all user accounts
- Can view subscription status
- Can manage revenue tracking

---

## Billing Model

### Free Tier
- $0/month
- 3 dispute letters per month
- Basic analytics

### Premium Tier
- **$99/month**
- Unlimited dispute letters
- AI-powered letter refinement
- 90-day progress tracking
- Priority email support

---

## How Subscriptions Work

When a user clicks "Upgrade to Premium":
1. They're taken to Stripe payment (coming soon)
2. After payment, a `Subscription` record is created
3. Status is set to `ACTIVE`
4. Monthly charge on same day (recurring)
5. User can cancel anytime from `/billing`

### Subscription Statuses
- `ACTIVE`: Currently paying, has access to Premium
- `CANCELED`: User requested cancellation, access until end of period
- `EXPIRED`: Subscription ended, downgraded to Free
- `PAST_DUE`: Payment failed, pending retry

---

## Key Admin Tasks

### Monitoring Revenue
Visit `/admin` daily to track:
- New subscriptions (check count increased)
- Monthly recurring revenue (MRR)
- Churn rate (canceled subscriptions)

### Helping Users
Premium members can email support@gabrielcapitallabs.com and you'll respond within 24 hours with priority support.

### Compliance
Keep audit trail of:
- Which letters were generated
- Which bureaus they were sent to
- Dispute resolution outcomes

---

## Troubleshooting

**Q: I made myself admin but don't see the `/admin` page**
A: Clear your browser cache and log out/back in

**Q: Where do I see Stripe payments?**
A: Coming soon! For now, subscriptions are placeholders in the database

**Q: How do I add another admin?**
A: Use Prisma Studio to set another user's role to `ADMIN`

**Q: Can I modify a user's subscription status?**
A: Yes, use Prisma Studio or contact the dev team for bulk changes

---

## Next: Stripe Integration

To accept real payments:

1. Create account at stripe.com
2. Get your Stripe API keys
3. Add to `.env.local`:
   ```
   STRIPE_PUBLIC_KEY=pk_test_...
   STRIPE_SECRET_KEY=sk_test_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```
4. We'll add payment forms to `/billing` page

---

**Questions?** Email support@gabrielcapitallabs.com or check `/help`
