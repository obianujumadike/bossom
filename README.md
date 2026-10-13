# Bossom

A clinical radiology platform for managing mammogram cases, running AI-assisted analysis, and supporting radiologist workflows.

---

## What it does

- **Case management** — create, track, and manage patient mammogram cases with full clinical metadata (study type, breast density, referring physician, priority, clinical indication)
- **Image upload** — securely upload mammogram images to Supabase Storage
- **AI analysis** — submit images for automated BI-RADS classification via the SensiNet inference service, with Bayesian uncertainty estimation
- **Results display** — view BI-RADS category, malignancy probability, confidence scores, and regions of interest; re-run analysis at any time
- **Mark as Complete** — mark cases as completed after review; a BI-RADS-aware next-steps modal surfaces clinical guidance (routine follow-up, short-interval follow-up, biopsy, or urgent referral)
- **Dashboard** — at-a-glance stats across all cases (total, in-progress, completed, urgent); clickable cards filter the case list
- **Radiologist accounts** — email/password auth, profiles, onboarding flow, password reset
- **Audit trail** — all analyses are persisted with timestamps and model version

---

## Authorship

Blossom (this application — UI, API routes, database schema, clinical workflow) is an **original work** by the Blossom team.

The AI model powering the mammogram analysis is **not** authored by the Blossom team. See the [mammogram-inference-service README](mammogram-inference-service/README.md) for full attribution.

---

## Tech stack

**Frontend / Backend**
- [Next.js 15](https://nextjs.org/) (App Router, React Server Components)
- [Tailwind CSS](https://tailwindcss.com/)
- [Supabase](https://supabase.com/) — Auth, PostgreSQL, Storage

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
│       ├── supabase/         # Supabase client (browser, server, middleware)
│       └── auth/             # Auth context, guards, permissions
└── mammogram-inference-service/  # Python FastAPI AI backend
```

---

## Getting started

### Prerequisites

- Node.js 20+
- A [Supabase](https://supabase.com/) project
- Python 3.10+ (only needed to run the inference service locally)

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Create `.env.local` in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# AI inference endpoint — use the hosted HF Space or run locally
GCLOUD_MODEL_ENDPOINT=https://tampee-mammogram-analyzer.hf.space
MODEL_API_KEY=your-api-key
```

### 3. Run the web app

```bash
npm run dev
```

### 4. AI inference service

The inference service is **hosted on Hugging Face Spaces** at `https://tampee-mammogram-analyzer.hf.space`. No local setup is required if you use the hosted endpoint.

To run it locally instead:

```bash
cd mammogram-inference-service
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Then set `GCLOUD_MODEL_ENDPOINT=http://localhost:8000` in `.env.local`.

The inference service runs in **mock mode** if model weights are absent — useful for UI development without a GPU.

---

## AI model attribution

The mammogram analysis feature is powered by **SensiNet**, a dual-stream deep learning model for mammographic classification.

> **Original model:** [Aredeksu/SensiNet-Mammography](https://huggingface.co/Aredeksu/SensiNet-Mammography) on Hugging Face  
> **License:** Apache License 2.0  
> **Architecture:** Xception + EfficientNet-B3 with CBAM attention fusion  
> **Training data:** CBIS-DDSM (Curated Breast Imaging Subset of DDSM)

The Blossom team did **not** design the SensiNet architecture or produce its weights. Our contribution is the FastAPI wrapper, Bayesian MC-Dropout inference pipeline (10 stochastic passes), SSRF protection, and integration with the Blossom clinical workflow. We use the model under its Apache 2.0 license, which requires this attribution.

---

## Important notice

Blossom is a **research and development prototype**. It has not been validated for clinical use. AI-generated BI-RADS scores are estimates only and must not be used to diagnose, treat, or manage patients without appropriate radiologist oversight and regulatory approval.

---

## License

The Blossom application code is original work by the Blossom team. The SensiNet model is used under [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0) — copyright belongs to its original authors.
