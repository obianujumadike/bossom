# Bossom

A clinical radiology platform for managing mammogram cases, running AI-assisted analysis, and supporting radiologist workflows.

---

## What it does

- **Case management** — create, track, and manage patient mammogram cases with full clinical metadata (study type, breast density, referring physician, priority, clinical indication)
- **Image upload** — mammograms go straight from the browser to Cloudinary as private (`authenticated`) assets; only signed URLs leave the server
- **AI analysis** — submit images for automated BI-RADS classification via the SensiNet inference service, with Bayesian uncertainty estimation
- **Results display** — view BI-RADS category, malignancy probability, confidence scores, and regions of interest; re-run analysis at any time
- **Mark as Complete** — mark cases as completed after review; a BI-RADS-aware next-steps modal surfaces clinical guidance (routine follow-up, short-interval follow-up, biopsy, or urgent referral)
- **Dashboard** — at-a-glance stats across all cases (total, in-progress, completed, urgent); clickable cards filter the case list
- **Radiologist accounts** — email/password auth with a 6-digit email code to confirm sign-up and to reset passwords; profiles
- **Audit trail** — every analysis is persisted with timestamps, model version, who requested it and whether the result came from the model or the dev mock

---

## Authorship

Bossom (this application — UI, API routes, database schema, clinical workflow) is an **original work** by the Bossom team.

The AI model powering the mammogram analysis is **not** authored by the Bossom team. See the [mammogram-inference-service README](mammogram-inference-service/README.md) for full attribution.

---

## Tech stack

**Frontend / Backend**
- [Next.js 15](https://nextjs.org/) (App Router, React Server Components)
- [Tailwind CSS](https://tailwindcss.com/)
- [Convex](https://convex.dev/) — database, server functions and auth ([Convex Auth](https://labs.convex.dev/auth))
- [Cloudinary](https://cloudinary.com/) — image storage and delivery
- [Resend](https://resend.com/) — sign-up and password-reset emails

**AI inference**
- [mammogram-inference-service](mammogram-inference-service/) — FastAPI microservice deployed on [Hugging Face Spaces](https://huggingface.co/spaces/tampee/mammogram-analyzer)
- Model: **SensiNet** (Xception + EfficientNet-B3 dual-stream, CBAM attention, Bayesian MC-Dropout)
- Original model by [Aredeksu/SensiNet-Mammography](https://huggingface.co/Aredeksu/SensiNet-Mammography) (Apache-2.0)
- Trained on: CBIS-DDSM mammography dataset

---

## Project structure

```
blossom/
├── src/
│   ├── app/
│   │   ├── api/              # Next.js API routes
│   │   │   ├── analyze/      # POST /api/analyze — triggers AI inference
│   │   │   ├── cases/        # CRUD for patient cases
│   │   │   ├── dashboard/    # Dashboard stats aggregation
│   │   │   └── profile/      # Radiologist profile management
│   │   ├── cases/            # Case list, analysis viewer, upload
│   │   ├── dashboard/        # Main dashboard with case stats
│   │   ├── onboarding/       # First-run onboarding flow
│   │   └── auth/             # Login, signup, callback, password reset
│   └── lib/
│       ├── convex/           # Convex client provider, /api/auth proxy, route helper
│       └── auth/             # Auth context, guards, permissions
├── convex/                   # Schema and server functions (cases, images, analyses, auth)
│   └── lib/                  # Password provider, email codes, Cloudinary signing, pure rules (+ tests)
├── scripts/
│   ├── e2e-convex.ts         # End-to-end checks against a dev deployment
│   └── migrate-from-supabase.ts
└── mammogram-inference-service/  # Python FastAPI AI backend
```

---

## Getting started

### Prerequisites

- Node.js 24 (pinned in `.nvmrc`; run `nvm use`)
- A [Convex](https://convex.dev/) account (free), a [Cloudinary](https://cloudinary.com/) account (free) and a [Resend](https://resend.com/) API key
- Python 3.10+ (only needed to run the inference service locally)

### 1. Install dependencies

```bash
npm install
```

### 2. Create the Convex deployment

```bash
npx convex dev
```

The first run creates (or links) the project and writes `CONVEX_DEPLOYMENT` and `NEXT_PUBLIC_CONVEX_URL` to `.env.local`. Leave it running: it pushes `convex/` on every save.

### 3. Configure the deployment

Server secrets live on the Convex deployment, not in `.env.local` (see `.env.local.example` for the full list):

```bash
npx convex env set SITE_URL http://localhost:3000
npx convex env set AUTH_RESEND_KEY re_...
npx convex env set AUTH_EMAIL_FROM "Bossom <no-reply@yourdomain.com>"
npx convex env set CLOUDINARY_CLOUD_NAME ...
npx convex env set CLOUDINARY_API_KEY ...
npx convex env set CLOUDINARY_API_SECRET ...
npx convex env set GCLOUD_MODEL_ENDPOINT <inference-service-url>   # see "AI inference service"
```

**Auth keys.** Convex Auth signs sessions with an RS256 key pair. `npx @convex-dev/auth` generates and sets `JWT_PRIVATE_KEY` and `JWKS` for you; run it once per deployment (and with `--prod` for production).

**Dev shortcuts** (never on production): `DEV_LOG_AUTH_CODES=true` prints sign-up/reset codes to `npx convex logs` instead of emailing them, and `ANALYSIS_MOCK=true` returns random BI-RADS results when no model endpoint is set. Without an endpoint or the mock flag, analysis fails rather than inventing a result.

### 4. Run the web app

```bash
npm run dev
```

### Checks

```bash
npm run typecheck   # Next app and Convex functions
npm test            # unit tests for the auth rules and Cloudinary signing
npm run test:e2e    # sign-up, sign-in, reset and case isolation against the dev deployment
```

`test:e2e` needs `DEV_LOG_AUTH_CODES=true` on the dev deployment; it creates throwaway accounts with unique emails on every run.

### AI inference service

Since #25 the app expects the service to accept the image as multipart `file` at `POST {GCLOUD_MODEL_ENDPOINT}/api/analyze` and to answer with `probability_malignant`, `decision_confidence` and `prediction`; the BI-RADS category is derived from the probability (`convex/lib/birads.ts`). A response without a valid `probability_malignant` fails the analysis rather than defaulting to benign.

The SensiNet service in `mammogram-inference-service/` and its Hugging Face Space (`https://tampee-mammogram-analyzer.hf.space`) still expose the older contract (`POST /analyze` with an `image_url`, returning `birads`), so they don't work as `GCLOUD_MODEL_ENDPOINT` until they're updated.

To run the SensiNet service locally:

```bash
cd mammogram-inference-service
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Analysis runs inside Convex's cloud, which can't reach `localhost`. To use a local service, expose it with a tunnel (e.g. `cloudflared tunnel --url http://localhost:8000`) and set `GCLOUD_MODEL_ENDPOINT` on the dev deployment to the tunnel URL.

The inference service runs in **mock mode** if model weights are absent — useful for UI development without a GPU.

---

## Migrating from Supabase

`scripts/migrate-from-supabase.ts` copies users, patients, clinical history, cases, analyses and regions into Convex, and every mammogram from Supabase Storage into Cloudinary.

```bash
npm run migrate:supabase -- --dry-run   # read only: counts + a local backup
npm run migrate:supabase                # into the dev deployment
npm run migrate:supabase -- --prod      # into production
```

It needs `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and the three `CLOUDINARY_*` values in `.env.local`. Add `SUPABASE_ACCESS_TOKEN` (a [personal access token](https://supabase.com/dashboard/account/tokens)) so users keep their existing passwords; without it they sign in once via **Forgot password**.

- **Safe to re-run.** Every row keeps its Supabase id as `legacy_id`, so a second run skips what is already there, copies files it hasn't copied yet, and attaches password hashes if the token was added later.
- **Backup first.** Before writing anything it saves the full export, including `audit_logs` and `system_settings`, which the app no longer uses, to `migration-data/`. That folder is git-ignored because it contains patient data; delete it once the migration is verified.
- **Interrupted analyses.** Runs left `pending`/`processing` in Supabase import as `failed` with a reason.
- **Old links.** Case URLs change from Supabase UUIDs to Convex ids; an old `/cases/<uuid>` link shows "not found".

---

## AI model attribution

The mammogram analysis feature is powered by **SensiNet**, a dual-stream deep learning model for mammographic classification.

> **Original model:** [Aredeksu/SensiNet-Mammography](https://huggingface.co/Aredeksu/SensiNet-Mammography) on Hugging Face  
> **License:** Apache License 2.0  
> **Architecture:** Xception + EfficientNet-B3 with CBAM attention fusion  
> **Training data:** CBIS-DDSM (Curated Breast Imaging Subset of DDSM)

The Bossom team did **not** design the SensiNet architecture or produce its weights. Our contribution is the FastAPI wrapper, Bayesian MC-Dropout inference pipeline (10 stochastic passes), SSRF protection, and integration with the Bossom clinical workflow. We use the model under its Apache 2.0 license, which requires this attribution.

---

## Important notice

Bossom is a **research and development prototype**. It has not been validated for clinical use. AI-generated BI-RADS scores are estimates only and must not be used to diagnose, treat, or manage patients without appropriate radiologist oversight and regulatory approval.

---

## License

The Bossom application code is original work by the Bossom team. The SensiNet model is used under [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0) — copyright belongs to its original authors.
