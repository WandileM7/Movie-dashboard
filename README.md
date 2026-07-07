# 🎬 Taste Cartography

A movie recommender with **emotional intelligence**. Discover films by *mood*, track your library Netflix-style, see trailers, and find where to stream in your region — with real accounts.

## Features

- **Mood Lab** — three mood sliders (comforting↔challenging, light↔heavy, calm↔intense) + presets; movies ranked by distance in 3D mood space
- **For You** — content-based recommendations from your library: weighted mood centroid + genre affinity (ratings, statuses, and ❤️ likes all feed the profile)
- **Library** — watching / watched / want to watch / dropped, 1–5★ ratings, love hearts
- **Taste Map** — every movie plotted in mood space, colored by mood or genre
- **Taste DNA** — radar of your emotional poles, top genres, decades
- **Trailers** — official YouTube trailer via TMDB (search-embed fallback without a key)
- **Where to Watch** — real region streaming availability (ZA: Netflix, Showmax, Prime…) via TMDB watch-providers, cached with TTLs
- **Real auth** — email+password accounts; bcrypt-hashed passwords; JWT sessions in httpOnly cookies; the API derives the user from the session (never from client-supplied ids); pre-auth localStorage libraries auto-merge into your account on first sign-in

## Stack

Next.js 15 (App Router) · MongoDB · Tailwind + shadcn/ui · Recharts · jose + bcryptjs · TMDB API

## Setup

```bash
cp .env.example .env      # then fill in:
# MONGO_URL      — local mongod or MongoDB Atlas free tier
# AUTH_SECRET    — openssl rand -base64 32
# TMDB_API_KEY   — free v4 Read Access Token from themoviedb.org (optional but recommended)

npm install
npm run dev               # http://localhost:3000
```

The movie catalog (126 curated titles with hand-tuned mood coordinates) auto-seeds on first request.

## API (all under /api)

| Route | Auth | Purpose |
|---|---|---|
| `POST auth/register` `auth/login` `auth/logout`, `GET auth/me` | — | Accounts & sessions |
| `GET movies`, `GET movies/:id`, `GET genres` | public | Catalog, detail + emotionally-similar |
| `GET movies/:id/metadata?region=ZA` | public | Trailer key + watch providers (cached) |
| `POST recommendations/mood` | public | Mood-space ranking |
| `GET recommendations/foryou` | session | Personalized (popular fallback if signed out) |
| `GET/POST library`, `DELETE library/:movieId` | session | Your library (status, rating, liked) |
| `POST library/migrate` | session | One-time merge of pre-auth localStorage library |

## Deploying free

- **App:** Vercel (set the three env vars)
- **DB:** MongoDB Atlas free tier (M0)
- **TMDB:** free API key

## Roadmap ideas

Swap the curated catalog for MovieLens 25M, add an SVD/two-tower embedding engine and a UMAP-based taste map, movie-to-movie path-finding, OAuth providers.
