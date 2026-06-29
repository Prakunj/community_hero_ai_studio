# Community Hero — Urban Civic Issue Management Platform

A full-stack civic reporting platform that lets citizens report urban infrastructure issues and empowers municipal administrators to track, triage, and resolve them using AI-assisted workflows.

---

## Features

### Citizen-Facing
- **Report Issues** — Submit pothole, garbage, water leakage, streetlight, drain, or other infrastructure problems with photos and auto-detected location
- **Track Progress** — View real-time status updates (Reported → Verified → In Progress → Resolved)
- **Verify Reports** — Upvote other citizens' reports to increase urgency
- **Media Safety** — Uploaded photos are automatically screened by Gemini Vision before going public

### Admin Dashboard
- **Action Center** — Deterministic, real-time list of what needs immediate attention: SLA breaches, stuck verified issues, long-unactioned reports, and flagged media
- **AI Agent Resolution Pipeline** — 5-step agentic flow (classify → search history → calculate urgency → severity analysis → resolution plan) powered by Gemini
- **Smart Urgency Scoring** — Multi-factor score: verifications, days open, area density, image presence, category risk, proximity to schools/hospitals
- **Media Moderation** — Approve or reject flagged photos; admins always see content in detail view even when hidden from public
- **Issue Management** — Update status, add resolution notes, filter/sort by category, status, and urgency

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Tailwind CSS v4, Vite |
| Backend | Node.js, Express, TypeScript (`tsx`) |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth (email/password, role-based) |
| AI | Google Gemini 2.5 Flash (`@google/genai`) |
| Maps | Google Maps Geocoding API, Google Places Nearby Search API |
| Media | Multer (multipart upload), Gemini Vision (moderation) |

---

## Google Technologies Used

- **Gemini 2.5 Flash** — 5-step AI agent pipeline for issue resolution planning; Vision API for image safety moderation
- **Google Maps Geocoding API** — Converts GPS coordinates to human-readable addresses on issue submission
- **Google Places Nearby Search API** — Checks proximity to schools and hospitals (within 500 m) to boost urgency score

---

## AI in Detail

### 1. Media Safety Moderation (Gemini Vision)
Every uploaded image is sent to Gemini Vision immediately after issue creation (fire-and-forget via `setImmediate`). The model evaluates safety and returns one of: `approved`, `flagged`, `needs_review`, or `rejected_media`. Images stay hidden from the public until approved; admins can see all media and make final call. The frontend self-polls every 5 seconds while any issue has `pending` moderation status so the UI updates automatically without a page refresh.

### 2. AI Agent Resolution Pipeline (5-Step Agentic Flow)
When an admin opens the AI analysis panel on any issue, a 5-step sequential agent runs:

| Step | Action |
|---|---|
| Step 1 | Validate & classify the issue (category, severity estimate) |
| Step 2 | Search historic patterns — similar past issues in the same area |
| Step 3 | Calculate dynamic urgency score (deterministic, multi-factor) |
| Step 4 | Gemini severity analysis — synthesizes all context into a structured assessment |
| Step 5 | Gemini resolution plan — concrete next steps for the municipality |

Each step's output feeds the next, creating a true agentic chain.

### 3. Dynamic Urgency Score
Calculated server-side when the AI pipeline runs:

```
score = (verifications × 5)
      + (days_open × 2)
      + (area_density × 4)
      + (has_image ? 10 : 0)
      + category_risk          // water_leakage=20, drain=18, pothole=15 …
      + proximity_bonus        // +15 near school, +20 near hospital
```

Capped at 100.

### 4. Reverse Geocoding (Google Maps Geocoding API)
On issue submission the browser captures GPS coordinates via `navigator.geolocation`. The server calls the Geocoding API to convert them to a readable address string stored alongside the coordinates.

---

## Project Structure

```
community-hero/
├── src/
│   ├── App.tsx          # Full SPA: citizen view, admin dashboard, all UI
│   ├── types.ts         # Shared TypeScript interfaces
│   ├── main.tsx         # React entry point
│   └── index.css        # Global styles
├── server.ts            # Express API server + AI agent logic
├── index.html           # HTML shell
├── vite.config.ts
├── tsconfig.json
└── package.json
```

---

## Getting Started

### Prerequisites
- Node.js 18+
- A [Supabase](https://supabase.com) project
- A [Google AI Studio](https://aistudio.google.com) Gemini API key
- A Google Maps Platform API key (Geocoding + Places APIs enabled)

### Setup

```bash
git clone https://github.com/YOUR_USERNAME/community-hero.git
cd community-hero
npm install
```

Create a `.env` file:

```env
GEMINI_API_KEY=your_gemini_api_key

NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co/rest/v1/
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
```

```bash
npm run dev
```

App runs at `http://localhost:3000`.

### Database
The app uses Supabase with a `issues` table. Key columns: `id`, `title`, `description`, `category`, `status`, `lat`, `lng`, `address`, `image_url`, `moderation_status`, `moderation_result`, `urgency_score`, `created_at`, `user_id`.

---

## Roles

| Role | Capabilities |
|---|---|
| Citizen | Report issues, verify others' reports, track status |
| Admin | All citizen capabilities + status management, AI analysis, media moderation, Action Center |

---

## License

MIT
