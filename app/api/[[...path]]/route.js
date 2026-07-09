import { MongoClient } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';
import { NextResponse } from 'next/server';
import { SEED_MOVIES, PROVIDER_POOL } from '@/lib/seedMovies';
import {
  hashPassword, verifyPassword, signSession, getSessionUser,
  SESSION_COOKIE, cookieOptions,
} from '@/lib/auth';
import { searchLink, normalizeService } from '@/lib/platformLinks';

let client = null;
let seedPromise = null;

async function getDb() {
  if (!client) {
    client = new MongoClient(process.env.MONGO_URL);
    await client.connect();
  }
  return client.db(process.env.DB_NAME || 'taste_cartography');
}

function cors(res) {
  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  return res;
}

const json = (data, status = 200) => cors(NextResponse.json(data, { status }));

// Deterministic sample providers (placeholder until TMDB_API_KEY is configured)
function assignProviders(title) {
  let h = 0;
  for (let i = 0; i < title.length; i++) h = (h * 31 + title.charCodeAt(i)) >>> 0;
  const count = (h % 3) + 1;
  const providers = [];
  for (let i = 0; i < count; i++) providers.push(PROVIDER_POOL[(h + i * 7) % PROVIDER_POOL.length]);
  return [...new Set(providers)];
}

// ---------- TMDB (Bearer v4 Read Access Token on v3 endpoints) ----------
const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_IMG = 'https://image.tmdb.org/t/p';
const TRAILER_TTL_MS = 30 * 24 * 3600 * 1000; // 30 days
const RATING_TTL_MS = 7 * 24 * 3600 * 1000; // 7 days — live TMDB rating refresh
const PROVIDER_TTL_MS = 7 * 24 * 3600 * 1000; // 7 days
const DEEPLINK_TTL_MS = 7 * 24 * 3600 * 1000; // 7 days

// ---------- Streaming Availability API (optional): EXACT platform deep links ----------
// Free tier on RapidAPI. When STREAMING_AVAILABILITY_API_KEY is set, provider
// badges link straight to the movie's title page on each platform. Cached per
// movie+region in Mongo so the free quota is barely touched.
async function getDeepLinks(db, movie, region) {
  const apiKey = process.env.STREAMING_AVAILABILITY_API_KEY;
  if (!apiKey || !movie.tmdbId) return null;

  const cached = movie.saDeepLinks;
  if (cached && cached.region === region && isFresh(cached.cachedAt, DEEPLINK_TTL_MS)) {
    return cached.byService;
  }

  try {
    const country = region.toLowerCase();
    const res = await fetch(
      `https://streaming-availability.p.rapidapi.com/shows/movie/${movie.tmdbId}?country=${country}`,
      { headers: { 'X-RapidAPI-Key': apiKey }, cache: 'no-store' }
    );
    if (!res.ok) throw new Error(`SA API ${res.status}`);
    const show = await res.json();
    const options = show?.streamingOptions?.[country] || [];
    // Map: normalized service key -> deep link (prefer subscription > free > rent > buy)
    const rank = { subscription: 0, free: 1, addon: 2, rent: 3, buy: 4 };
    const byService = {};
    for (const opt of [...options].sort((a, b) => (rank[a.type] ?? 9) - (rank[b.type] ?? 9))) {
      const key = normalizeService(opt.service?.name || opt.service?.id);
      if (opt.link && !byService[key]) byService[key] = opt.link;
    }
    await db.collection('movies').updateOne(
      { id: movie.id },
      { $set: { saDeepLinks: { region, byService, cachedAt: new Date().toISOString() } } }
    );
    return byService;
  } catch (e) {
    console.error('Streaming Availability error:', e.message);
    return cached?.region === region ? cached.byService : null; // stale beats nothing
  }
}

async function tmdbFetch(apiPath, params = {}) {
  const u = new URL(`${TMDB_BASE}${apiPath}`);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) u.searchParams.set(k, String(v));
  });
  const res = await fetch(u.toString(), {
    headers: { Authorization: `Bearer ${process.env.TMDB_API_KEY}`, 'Content-Type': 'application/json' },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`TMDB request failed: ${res.status}`);
  return res.json();
}

const isFresh = (cachedAt, ttl) => cachedAt && Date.now() - new Date(cachedAt).getTime() < ttl;

async function getMovieMetadata(db, movie, region) {
  const col = db.collection('movies');
  let { tmdbId, tmdbTrailer, tmdbProviders } = movie;
  const updates = {};

  // 1. Resolve tmdb_id via search (permanent cache)
  if (!tmdbId) {
    const s = await tmdbFetch('/search/movie', { query: movie.title, year: movie.year });
    const results = s.results || [];
    const best = results.find((r) => (r.title || '').toLowerCase() === movie.title.toLowerCase()) || results[0];
    if (best) {
      tmdbId = best.id;
      updates.tmdbId = tmdbId;
      if (best.poster_path) updates.posterUrl = `${TMDB_IMG}/w500${best.poster_path}`;
      if (best.backdrop_path) updates.backdropUrl = `${TMDB_IMG}/w780${best.backdrop_path}`;
      // The search response already carries live ratings — use them.
      if (typeof best.vote_average === 'number' && (best.vote_count || 0) >= 20) {
        updates.rating = Math.round(best.vote_average * 10) / 10;
        updates.ratingSyncedAt = new Date().toISOString();
      }
    }
  }

  // 1.5 Live rating refresh (7-day TTL): replace the hardcoded seed rating
  // with TMDB's current vote_average. vote_count >= 20 guards against noisy
  // scores on brand-new releases.
  if (tmdbId && !updates.rating && !isFresh(movie.ratingSyncedAt, RATING_TTL_MS)) {
    try {
      const d = await tmdbFetch(`/movie/${tmdbId}`);
      if (typeof d.vote_average === 'number' && (d.vote_count || 0) >= 20) {
        updates.rating = Math.round(d.vote_average * 10) / 10;
      }
      if (typeof d.popularity === 'number') updates.tmdbPopularity = d.popularity;
      updates.ratingSyncedAt = new Date().toISOString();
    } catch (e) { /* keep existing rating; retry after TTL */ }
  }

  // 2. Official YouTube trailer key (30-day TTL)
  if (tmdbId && !(tmdbTrailer && isFresh(tmdbTrailer.cachedAt, TRAILER_TTL_MS))) {
    const v = await tmdbFetch(`/movie/${tmdbId}/videos`);
    const vids = v.results || [];
    const t =
      vids.find((x) => x.type === 'Trailer' && x.site === 'YouTube' && x.official) ||
      vids.find((x) => x.type === 'Trailer' && x.site === 'YouTube') ||
      vids.find((x) => x.site === 'YouTube');
    tmdbTrailer = { key: t ? t.key : null, name: t ? t.name : null, cachedAt: new Date().toISOString() };
    updates.tmdbTrailer = tmdbTrailer;
  }

  // 3. Watch providers for region (7-day TTL)
  if (tmdbId && !(tmdbProviders && tmdbProviders.region === region && isFresh(tmdbProviders.cachedAt, PROVIDER_TTL_MS))) {
    const p = await tmdbFetch(`/movie/${tmdbId}/watch/providers`);
    const entry = (p.results || {})[region];
    const decorate = (list, category) =>
      (list || []).map((x) => ({
        providerId: x.provider_id,
        name: x.provider_name,
        logoUrl: x.logo_path ? `${TMDB_IMG}/w92${x.logo_path}` : null,
        category,
      }));
    tmdbProviders = {
      region,
      link: entry?.link || null,
      items: entry ? [...decorate(entry.flatrate, 'stream'), ...decorate(entry.rent, 'rent'), ...decorate(entry.buy, 'buy')] : [],
      cachedAt: new Date().toISOString(),
    };
    updates.tmdbProviders = tmdbProviders;
  }

  if (Object.keys(updates).length) await col.updateOne({ id: movie.id }, { $set: updates });

  // 4. Attach a clickable URL to every provider badge:
  //    exact platform deep link when the Streaming Availability key is set,
  //    otherwise the platform's search preloaded with the title.
  let providersOut = tmdbProviders || null;
  if (providersOut?.items?.length) {
    const deepLinks = await getDeepLinks(db, { ...movie, tmdbId }, region);
    providersOut = {
      ...providersOut,
      items: providersOut.items.map((item) => {
        const exact = deepLinks?.[normalizeService(item.name)] || null;
        return {
          ...item,
          url: exact || searchLink(item.name, movie.title, movie.year),
          linkType: exact ? 'exact' : 'search',
        };
      }),
    };
  }

  return {
    tmdbEnabled: true,
    tmdbId: tmdbId || null,
    trailerKey: tmdbTrailer?.key || null,
    trailerName: tmdbTrailer?.name || null,
    providers: providersOut,
    posterUrl: updates.posterUrl || movie.posterUrl || null,
    backdropUrl: updates.backdropUrl || movie.backdropUrl || null,
  };
}

async function fetchWikipediaPosters(wikiTitles) {
  // Batch-fetch poster thumbnails from Wikipedia pageimages API (no key needed)
  const results = {};
  const batches = [];
  for (let i = 0; i < wikiTitles.length; i += 30) batches.push(wikiTitles.slice(i, i + 30));
  for (const batch of batches) {
    try {
      const url = `https://en.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&prop=pageimages&piprop=thumbnail&pithumbsize=500&pilimit=50&pilicense=any&redirects=1&titles=${encodeURIComponent(batch.join('|'))}`;
      const res = await fetch(url, { headers: { 'User-Agent': 'TasteCartography/1.0 (movie recommender app)' } });
      if (!res.ok) continue;
      const data = await res.json();
      const q = data.query || {};
      // Build mapping: original -> normalized -> redirected -> final page title
      const forward = {};
      for (const t of batch) forward[t] = t;
      for (const n of q.normalized || []) {
        for (const k of Object.keys(forward)) if (forward[k] === n.from) forward[k] = n.to;
      }
      for (const r of q.redirects || []) {
        for (const k of Object.keys(forward)) if (forward[k] === r.from) forward[k] = r.to;
      }
      const byTitle = {};
      for (const pid of Object.keys(q.pages || {})) {
        const p = q.pages[pid];
        if (p.thumbnail && p.thumbnail.source) byTitle[p.title] = p.thumbnail.source;
      }
      for (const orig of batch) {
        const final = forward[orig];
        if (byTitle[final]) results[orig] = byTitle[final];
      }
    } catch (e) {
      console.error('Wikipedia poster batch failed:', e.message);
    }
  }
  return results;
}

let seedSyncedThisBoot = false;

// ADDITIVE catalog sync: inserts any seed titles missing from the DB (matched
// by title+year) and NEVER deletes or re-ids existing movies — so user library
// references always stay intact and new seed titles roll out automatically on
// the next request after a deploy. `force` additionally refreshes the curated
// fields (mood, rating, genres, overview) on existing titles, in place.
async function ensureSeeded(db, force = false) {
  const col = db.collection('movies');
  if (seedSyncedThisBoot && !force) return { seeded: false };
  if (seedPromise && !force) return seedPromise;
  seedPromise = (async () => {
    const existing = await col.find({}, { projection: { title: 1, year: 1 } }).toArray();
    const have = new Set(existing.map((m) => `${m.title}::${m.year}`));
    const missing = SEED_MOVIES.filter((m) => !have.has(`${m.title}::${m.year}`));

    let added = 0;
    let postersFound = 0;
    if (missing.length) {
      const posters = await fetchWikipediaPosters(missing.map((m) => m.wiki));
      postersFound = Object.keys(posters).length;
      const docs = missing.map((m) => ({
        id: uuidv4(),
        title: m.title,
        year: m.year,
        genres: m.genres,
        overview: m.overview,
        rating: m.rating,
        popularity: m.popularity,
        mood: m.mood, // { c: comforting<->challenging, l: light<->heavy, m: calm<->intense }
        posterUrl: posters[m.wiki] || null,
        providers: assignProviders(m.title),
        providersRegion: 'ZA',
        providersSample: true,
        createdAt: new Date().toISOString(),
      }));
      await col.insertMany(docs);
      added = docs.length;
    }

    if (force) {
      for (const m of SEED_MOVIES) {
        await col.updateOne(
          { title: m.title, year: m.year },
          { $set: { genres: m.genres, overview: m.overview, rating: m.rating, popularity: m.popularity, mood: m.mood } }
        );
      }
    }

    await col.createIndex({ id: 1 }, { unique: true });
    await db.collection('library').createIndex({ userId: 1, movieId: 1 }, { unique: true });
    seedSyncedThisBoot = true;
    return { seeded: added > 0, added, total: existing.length + added, postersFound, refreshed: force };
  })();
  const r = await seedPromise;
  seedPromise = null;
  return r;
}

const moodDist = (a, b) => Math.sqrt((a.c - b.c) ** 2 + (a.l - b.l) ** 2 + (a.m - b.m) ** 2);
const MAX_DIST = Math.sqrt(12);
const moodSim = (a, b) => 1 - moodDist(a, b) / MAX_DIST;

function similarMovies(target, all, n = 8) {
  return all
    .filter((m) => m.id !== target.id)
    .map((m) => {
      const genreOverlap = m.genres.filter((g) => target.genres.includes(g)).length / Math.max(target.genres.length, 1);
      return { m, score: 0.5 * genreOverlap + 0.5 * moodSim(target.mood, m.mood) };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, n)
    .map((x) => x.m);
}

async function getLibraryJoined(db, userId, status) {
  const q = { userId };
  if (status) q.status = status;
  const items = await db.collection('library').find(q, { projection: { _id: 0 } }).sort({ updatedAt: -1 }).toArray();
  if (!items.length) return [];
  const movieIds = items.map((i) => i.movieId);
  const movies = await db.collection('movies').find({ id: { $in: movieIds } }, { projection: { _id: 0 } }).toArray();
  const byId = Object.fromEntries(movies.map((m) => [m.id, m]));
  return items.filter((i) => byId[i.movieId]).map((i) => ({ ...i, movie: byId[i.movieId] }));
}

export async function OPTIONS() {
  return cors(new NextResponse(null, { status: 204 }));
}

async function handler(request, { params }) {
  const { path = [] } = await params;
  const route = path.join('/');
  const method = request.method;
  const url = new URL(request.url);

  try {
    const db = await getDb();

    // Health
    if (route === '' && method === 'GET') return json({ status: 'ok', app: 'Taste Cartography API' });

    // ---------- Auth ----------
    if (route === 'auth/register' && method === 'POST') {
      const { email, password, name } = await request.json();
      const cleanEmail = String(email || '').trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) return json({ error: 'Please enter a valid email' }, 400);
      if (!password || String(password).length < 8) return json({ error: 'Password must be at least 8 characters' }, 400);
      const users = db.collection('users');
      await users.createIndex({ email: 1 }, { unique: true });
      const existing = await users.findOne({ email: cleanEmail });
      if (existing) return json({ error: 'An account with this email already exists' }, 409);
      const user = {
        id: uuidv4(),
        email: cleanEmail,
        name: (name || '').trim() || cleanEmail.split('@')[0],
        passwordHash: await hashPassword(String(password)),
        createdAt: new Date().toISOString(),
      };
      await users.insertOne(user);
      const token = await signSession(user);
      const res = json({ user: { id: user.id, email: user.email, name: user.name } }, 201);
      res.cookies.set(SESSION_COOKIE, token, cookieOptions);
      return res;
    }

    if (route === 'auth/login' && method === 'POST') {
      const { email, password } = await request.json();
      const cleanEmail = String(email || '').trim().toLowerCase();
      const user = await db.collection('users').findOne({ email: cleanEmail });
      // Same error for unknown email / wrong password (no account enumeration).
      if (!user || !(await verifyPassword(String(password || ''), user.passwordHash))) {
        return json({ error: 'Invalid email or password' }, 401);
      }
      const token = await signSession(user);
      const res = json({ user: { id: user.id, email: user.email, name: user.name } });
      res.cookies.set(SESSION_COOKIE, token, cookieOptions);
      return res;
    }

    if (route === 'auth/logout' && method === 'POST') {
      const res = json({ ok: true });
      res.cookies.set(SESSION_COOKIE, '', { ...cookieOptions, maxAge: 0 });
      return res;
    }

    if (route === 'auth/me' && method === 'GET') {
      const user = await getSessionUser(request);
      return json({ user });
    }

    // Merge a pre-auth (localStorage-era) library into the signed-in account.
    if (route === 'library/migrate' && method === 'POST') {
      const user = await getSessionUser(request);
      if (!user) return json({ error: 'Not signed in' }, 401);
      const { legacyUserId } = await request.json();
      if (!legacyUserId || legacyUserId === user.id) return json({ migrated: 0 });
      const lib = db.collection('library');
      const legacyItems = await lib.find({ userId: legacyUserId }).toArray();
      let migrated = 0;
      for (const item of legacyItems) {
        const exists = await lib.findOne({ userId: user.id, movieId: item.movieId });
        if (!exists) {
          const { _id, userId, ...rest } = item;
          await lib.insertOne({ ...rest, userId: user.id });
          migrated++;
        }
      }
      await lib.deleteMany({ userId: legacyUserId });
      return json({ migrated });
    }

    // Force reseed
    if (route === 'seed' && method === 'POST') {
      const r = await ensureSeeded(db, url.searchParams.get('force') === 'true');
      return json(r);
    }

    // Batch-refresh catalog ratings/popularity from TMDB. Processes up to 60
    // stale movies per call (serverless-friendly); call repeatedly until
    // remaining=0. When a pass completes, popularity is recomputed as each
    // movie's percentile (0-100) of live TMDB popularity across the catalog.
    if (route === 'sync-ratings' && method === 'POST') {
      const user = await getSessionUser(request);
      if (!user) return json({ error: 'Not signed in' }, 401);
      if (!process.env.TMDB_API_KEY) return json({ error: 'TMDB_API_KEY not configured' }, 400);
      await ensureSeeded(db);
      const col = db.collection('movies');
      const staleBefore = new Date(Date.now() - RATING_TTL_MS).toISOString();
      const staleQuery = { $or: [{ ratingSyncedAt: { $exists: false } }, { ratingSyncedAt: { $lt: staleBefore } }] };
      const stale = await col.find(staleQuery, { projection: { _id: 0, id: 1, title: 1, year: 1, tmdbId: 1 } }).limit(60).toArray();

      let updated = 0, failed = 0;
      const BATCH = 8;
      for (let i = 0; i < stale.length; i += BATCH) {
        await Promise.all(stale.slice(i, i + BATCH).map(async (m) => {
          try {
            let tmdbId = m.tmdbId;
            if (!tmdbId) {
              const s = await tmdbFetch('/search/movie', { query: m.title, year: m.year });
              const best = (s.results || []).find((r) => (r.title || '').toLowerCase() === m.title.toLowerCase()) || (s.results || [])[0];
              if (!best) { // no TMDB match — mark synced so we don't retry forever
                await col.updateOne({ id: m.id }, { $set: { ratingSyncedAt: new Date().toISOString() } });
                return;
              }
              tmdbId = best.id;
            }
            const d = await tmdbFetch(`/movie/${tmdbId}`);
            const set = { tmdbId, ratingSyncedAt: new Date().toISOString() };
            if (typeof d.vote_average === 'number' && (d.vote_count || 0) >= 20) set.rating = Math.round(d.vote_average * 10) / 10;
            if (typeof d.popularity === 'number') set.tmdbPopularity = d.popularity;
            await col.updateOne({ id: m.id }, { $set: set });
            updated++;
          } catch (e) { failed++; }
        }));
      }

      const remaining = await col.countDocuments(staleQuery);
      if (remaining === 0) {
        // Full pass complete: recompute popularity percentiles from live data.
        const withPop = await col
          .find({ tmdbPopularity: { $exists: true, $ne: null } }, { projection: { id: 1, tmdbPopularity: 1 } })
          .toArray();
        withPop.sort((a, b) => a.tmdbPopularity - b.tmdbPopularity);
        const denom = Math.max(withPop.length - 1, 1);
        for (let i = 0; i < withPop.length; i++) {
          await col.updateOne({ id: withPop[i].id }, { $set: { popularity: Math.round((i / denom) * 100) } });
        }
      }
      return json({ processed: stale.length, updated, failed, remaining });
    }

    // Movies list
    if (route === 'movies' && method === 'GET') {
      await ensureSeeded(db);
      const search = (url.searchParams.get('search') || '').trim().toLowerCase();
      const genre = url.searchParams.get('genre');
      const sort = url.searchParams.get('sort') || 'popular';
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '200', 10), 300);
      let movies = await db.collection('movies').find({}, { projection: { _id: 0 } }).toArray();
      if (search) movies = movies.filter((m) => m.title.toLowerCase().includes(search) || m.genres.some((g) => g.toLowerCase().includes(search)));
      if (genre && genre !== 'All') movies = movies.filter((m) => m.genres.includes(genre));
      if (sort === 'popular') movies.sort((a, b) => b.popularity - a.popularity);
      else if (sort === 'rating') movies.sort((a, b) => b.rating - a.rating);
      else if (sort === 'year') movies.sort((a, b) => b.year - a.year);
      return json({ movies: movies.slice(0, limit), total: movies.length });
    }

    // Genres
    if (route === 'genres' && method === 'GET') {
      await ensureSeeded(db);
      const genres = await db.collection('movies').distinct('genres');
      return json({ genres: genres.sort() });
    }

    // Movie TMDB metadata: real trailer + streaming providers (cached with TTL)
    if (path[0] === 'movies' && path[1] && path[2] === 'metadata' && method === 'GET') {
      await ensureSeeded(db);
      const movie = await db.collection('movies').findOne({ id: path[1] }, { projection: { _id: 0 } });
      if (!movie) return json({ error: 'Movie not found' }, 404);
      if (!process.env.TMDB_API_KEY) return json({ tmdbEnabled: false, trailerKey: null, providers: null });
      const region = url.searchParams.get('region') || 'ZA';
      try {
        const meta = await getMovieMetadata(db, movie, region);
        return json(meta);
      } catch (e) {
        console.error('TMDB metadata error:', e.message);
        return json({
          tmdbEnabled: true,
          error: 'tmdb_fetch_failed',
          tmdbId: movie.tmdbId || null,
          trailerKey: movie.tmdbTrailer?.key || null,
          providers: movie.tmdbProviders || null,
        });
      }
    }

    // Movie detail + similar
    if (path[0] === 'movies' && path[1] && method === 'GET') {
      await ensureSeeded(db);
      const movie = await db.collection('movies').findOne({ id: path[1] }, { projection: { _id: 0 } });
      if (!movie) return json({ error: 'Movie not found' }, 404);
      const all = await db.collection('movies').find({}, { projection: { _id: 0 } }).toArray();
      return json({ movie, similar: similarMovies(movie, all) });
    }

    // Mood recommendations (the standout feature)
    if (route === 'recommendations/mood' && method === 'POST') {
      await ensureSeeded(db);
      const body = await request.json();
      const mood = body.mood || {};
      const target = {
        c: Math.max(-1, Math.min(1, Number(mood.c) || 0)),
        l: Math.max(-1, Math.min(1, Number(mood.l) || 0)),
        m: Math.max(-1, Math.min(1, Number(mood.m) || 0)),
      };
      const limit = Math.min(Number(body.limit) || 24, 60);
      const all = await db.collection('movies').find({}, { projection: { _id: 0 } }).toArray();
      const scored = all
        .map((mv) => {
          const dist = moodDist(target, mv.mood);
          return { ...mv, matchPercent: Math.max(0, Math.round((1 - dist / MAX_DIST) * 100)), moodDistance: Number(dist.toFixed(3)) };
        })
        .sort((a, b) => a.moodDistance - b.moodDistance)
        .slice(0, limit);
      return json({ target, results: scored });
    }

    // For You recommendations (content-based from library profile)
    if (route === 'recommendations/foryou' && method === 'GET') {
      await ensureSeeded(db);
      const sessionUser = await getSessionUser(request);
      const userId = sessionUser?.id || null;
      const all = await db.collection('movies').find({}, { projection: { _id: 0 } }).toArray();
      const popular = [...all].sort((a, b) => b.popularity * b.rating - a.popularity * a.rating);
      if (!userId) return json({ profileBased: false, results: popular.slice(0, 20) });
      const lib = await db.collection('library').find({ userId }, { projection: { _id: 0 } }).toArray();
      const byId = Object.fromEntries(all.map((m) => [m.id, m]));
      const signals = lib
        .map((i) => {
          const mv = byId[i.movieId];
          if (!mv) return null;
          let w;
          if (i.rating) w = i.rating - 2.5; // 1..5 -> -1.5..2.5
          else if (i.status === 'dropped') w = -1;
          else if (i.status === 'want_to_watch') w = 0.7;
          else w = 1.2; // watching / watched
          if (i.liked) w += 0.8; // hearts are a strong positive signal
          return { mv, w };
        })
        .filter(Boolean);
      const positives = signals.filter((s) => s.w > 0);
      if (!positives.length) return json({ profileBased: false, results: popular.filter((m) => !lib.some((i) => i.movieId === m.id)).slice(0, 20) });
      // Build taste profile: weighted mood centroid + genre affinity
      let totW = 0;
      const centroid = { c: 0, l: 0, m: 0 };
      const genreW = {};
      for (const { mv, w } of signals) {
        if (w > 0) {
          centroid.c += mv.mood.c * w; centroid.l += mv.mood.l * w; centroid.m += mv.mood.m * w;
          totW += w;
        }
        for (const g of mv.genres) genreW[g] = (genreW[g] || 0) + w;
      }
      centroid.c /= totW; centroid.l /= totW; centroid.m /= totW;
      const maxG = Math.max(...Object.values(genreW).map(Math.abs), 1);
      const inLib = new Set(lib.map((i) => i.movieId));
      const results = all
        .filter((m) => !inLib.has(m.id))
        .map((m) => {
          const gScore = m.genres.reduce((s, g) => s + (genreW[g] || 0) / maxG, 0) / Math.max(m.genres.length, 1);
          const score = 0.45 * ((gScore + 1) / 2) + 0.35 * moodSim(centroid, m.mood) + 0.2 * (m.popularity / 100) * (m.rating / 10);
          return { ...m, score: Number(score.toFixed(4)) };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 20);
      return json({ profileBased: true, profile: { mood: centroid }, results });
    }

    // Library CRUD
    if (route === 'library' && method === 'GET') {
      const user = await getSessionUser(request);
      if (!user) return json({ error: 'Not signed in' }, 401);
      await ensureSeeded(db);
      const items = await getLibraryJoined(db, user.id, url.searchParams.get('status'));
      return json({ items });
    }

    if (route === 'library' && method === 'POST') {
      const user = await getSessionUser(request);
      if (!user) return json({ error: 'Not signed in' }, 401);
      const body = await request.json();
      const { movieId, status, rating, liked } = body;
      if (!movieId) return json({ error: 'movieId is required' }, 400);
      const movie = await db.collection('movies').findOne({ id: movieId });
      if (!movie) return json({ error: 'Movie not found' }, 404);
      const validStatuses = ['watching', 'watched', 'want_to_watch', 'dropped'];
      if (status && !validStatuses.includes(status)) return json({ error: 'Invalid status' }, 400);
      if (rating !== undefined && rating !== null && (rating < 1 || rating > 5)) return json({ error: 'Rating must be 1-5' }, 400);
      const now = new Date().toISOString();
      const set = { updatedAt: now };
      if (status) set.status = status;
      if (rating !== undefined) set.rating = rating;
      if (liked !== undefined) set.liked = !!liked;
      await db.collection('library').updateOne(
        { userId: user.id, movieId },
        { $set: set, $setOnInsert: { userId: user.id, movieId, addedAt: now, ...(status ? {} : { status: 'want_to_watch' }) } },
        { upsert: true }
      );
      const item = await db.collection('library').findOne({ userId: user.id, movieId }, { projection: { _id: 0 } });
      return json({ item });
    }

    if (path[0] === 'library' && path[1] && method === 'DELETE') {
      const user = await getSessionUser(request);
      if (!user) return json({ error: 'Not signed in' }, 401);
      const r = await db.collection('library').deleteOne({ userId: user.id, movieId: path[1] });
      return json({ deleted: r.deletedCount > 0 });
    }

    return json({ error: `Route not found: ${method} /${route}` }, 404);
  } catch (e) {
    console.error('API error:', e);
    return json({ error: e.message }, 500);
  }
}

export const GET = handler;
export const POST = handler;
export const PATCH = handler;
export const DELETE = handler;
