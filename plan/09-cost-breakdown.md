# 09 — Cost Breakdown

All costs in Indian Rupees (₹) unless noted. Exchange rate used: 1 USD ≈ ₹84.

---

## Development Phase (One-Time Setup Costs)

Everything below is available on a free tier during development. No payment required to build and test the application.

| Service | Free Tier Available | Limit That Matters |
|---|---|---|
| Supabase | Yes — free tier | 500 MB database, 1 GB Storage, 50,000 MAU, 2 GB bandwidth |
| Vercel | Yes — Hobby tier | 100 GB bandwidth/month, unlimited deployments, 100 serverless function hours/month |
| Razorpay | Yes — test mode | Unlimited test transactions; no charges until live mode |
| Canva Developer | Yes — dev mode | Up to ~25 allowlisted users can authenticate; no API usage cost |
| GitHub | Yes | Unlimited private repos |

**One-time development costs: ₹0**

---

## One-Time Pre-Launch Costs

| Item | Estimated Cost | Notes |
|---|---|---|
| Domain name (.in) | ₹500–800 / year | `.in` via GoDaddy, Namecheap, or BigRock. `.com` is ₹800–1,200/year |
| **Total** | **₹500–1,200 one-time** | |

---

## Ongoing Monthly Costs at Launch (Low Traffic)

Assumptions: < 100 orders/month, < 1,000 monthly active users, < 5 GB Storage used.

### Supabase (Free Tier)

| Resource | Free Limit | Estimated Usage at Launch | Cost |
|---|---|---|---|
| Database rows | Unlimited on free | ~5,000 rows (orders + frames + tokens) | ₹0 |
| Database size | 500 MB | < 50 MB | ₹0 |
| Storage | 1 GB | ~2 GB (PDF + PNG per order × 100 orders ≈ ~500 MB) | ₹0 |
| Auth MAU | 50,000 | < 500 | ₹0 |
| API calls (Edge Functions) | 500,000 / month | < 10,000 | ₹0 |
| Bandwidth | 2 GB | < 1 GB | ₹0 |

**Supabase cost at launch: ₹0/month**

Storage note: Each order produces ~1 PNG (≈ 2–5 MB) + 1 PDF (≈ 5–15 MB) ≈ 10–20 MB per order. At 100 orders/month, that is ~2 GB/month cumulative (not egress — stored data). The free tier provides 1 GB. At 50–60 orders, storage will exceed the free tier. Watch this closely — it is the first free-tier limit likely to be hit.

### Vercel (Hobby / Free Tier)

| Resource | Free Limit | Estimated Usage at Launch | Cost |
|---|---|---|---|
| Bandwidth | 100 GB/month | < 5 GB | ₹0 |
| Serverless function executions | 100,000/month | < 5,000 | ₹0 |
| Build minutes | 6,000 min/month | < 100 min | ₹0 |

**Vercel cost at launch: ₹0/month**

Note: The Vercel Hobby tier does not support commercial use by their ToS. Upgrade to Vercel Pro (USD $20/month ≈ ₹1,680/month) as soon as the site starts generating revenue. Budget this as a soft commitment from day one.

### Razorpay

No monthly fee. Charges per transaction only.

| Transaction type | Fee |
|---|---|
| UPI | 2% per transaction (minimum ₹0) |
| GST on fee | 18% on the gateway fee |

Effective total fee: ~2.36% per transaction (2% + 18% GST on the 2%).

| Order value | Gateway fee | Net received |
|---|---|---|
| ₹500 | ₹11.80 | ₹488.20 |
| ₹1,000 | ₹23.60 | ₹976.40 |
| ₹2,000 | ₹47.20 | ₹1,952.80 |

**Razorpay cost at launch:** Variable. At 100 orders/month × avg ₹800/order → fees ≈ ₹1,888/month. These fees are a cost of revenue, not an infrastructure cost.

### Canva Connect API

No usage-based API cost. Canva does not charge per API call or per design creation for public integrations. The only Canva cost would be if the business owner needs a personal Canva Pro subscription for creating templates (₹4,000/year ≈ ₹333/month) — this is optional and separate from the API.

**Canva API cost: ₹0/month**

---

## Scaling Triggers — When Free Tiers Break

| Service | Trigger | What Happens | First Paid Tier |
|---|---|---|---|
| Supabase Storage | > 1 GB stored | Free tier exceeded | Supabase Pro: USD $25/month (≈ ₹2,100) — includes 8 GB Storage, 100K MAU |
| Supabase Database | > 500 MB DB size | Extremely unlikely in v1 | Covered by Pro plan above |
| Vercel | Commercial use / > 100 GB bandwidth | Hobby ToS violation / overage | Vercel Pro: USD $20/month (≈ ₹1,680) — includes 1 TB bandwidth |
| Razorpay | N/A — scales linearly with revenue | Fee grows with orders | No tiers — always 2% per transaction |
| Canva API | Rate limits (undocumented) | API errors under sustained load | No paid tier for public integrations; contact Canva if rate limits are hit |

**Storage is the first free-tier limit you will hit, likely around 50–60 cumulative orders.**

---

## Total Estimated Monthly Cost at Launch

| Scenario | Supabase | Vercel | Domain (amortised) | Total |
|---|---|---|---|---|
| Pre-revenue (testing) | ₹0 | ₹0 | ₹67/month | **₹67/month** |
| At launch, < 60 orders | ₹0 | ₹0 | ₹67/month | **₹67/month** |
| At launch, 60–100 orders (Storage > 1 GB) | ₹2,100 | ₹0* | ₹67/month | **~₹2,200/month** |

*Upgrade Vercel to Pro (₹1,680/month) as soon as the site is generating real revenue, regardless of bandwidth usage.

**Realistic launch cost: ₹0–₹67/month until the first 50–60 orders are fulfilled. Then ≈ ₹2,200–3,900/month once both Supabase Pro and Vercel Pro are needed.**

---

## Total Estimated Monthly Cost at 500 Orders/Month

Assumptions: 500 orders/month, avg order ₹800, ~5 GB new storage per month (cumulative storage will be 20–30 GB after a few months of this volume), 5,000 MAU.

| Item | Cost |
|---|---|
| Supabase Pro (8 GB storage included; extra storage at $0.021/GB) | ₹2,100 + extra storage overage ≈ ₹2,500–3,500 |
| Vercel Pro (1 TB bandwidth — easily sufficient at this volume) | ₹1,680 |
| Domain (amortised) | ₹67 |
| Razorpay fees (500 × ₹800 × 2.36%) | ₹9,440 |
| **Total infrastructure** | **≈ ₹4,250–5,250/month** |
| **Total including Razorpay fees** | **≈ ₹13,700–14,700/month** |

Note: Razorpay fees are a cost of revenue (paid from order income). Infrastructure-only cost at 500 orders/month is approximately **₹4,250–5,250/month**.

At 500 orders/month × ₹800 average = ₹4,00,000 revenue. Infrastructure cost is ~1.3% of revenue. This is a healthy margin for a bootstrapped v1 platform.

---

## Summary Table

| Phase | Monthly Cost |
|---|---|
| Development | ₹0 |
| Launch (< 50 orders cumulative) | ₹67 (domain only) |
| Early traction (50–200 orders/month) | ₹2,200–3,900 |
| Growth (500 orders/month) | ₹4,250–5,250 (infra only) |
