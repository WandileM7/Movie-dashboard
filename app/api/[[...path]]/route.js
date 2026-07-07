import { MongoClient } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';
import { NextResponse } from 'next/server';
import { SEED_MOVIES, PROVIDER_POOL } from '@/lib/seedMovies';

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

async function ensureSeeded(db, force = false) {
  const col = db.collection('movies');
  const count = await col.countDocuments();
  if (count > 0 && !force) return { seeded: false, count };
  if (seedPromise && !force) return seedPromise;
  seedPromise = (async () => {
    if (force) await col.deleteMany({});
    const posters = await fetchWikipediaPosters(SEED_MOVIES.map((m) => m.wiki));
    const docs = SEED_MOVIES.map((m) => ({
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
    await col.createIndex({ id: 1 }, { unique: true });
    await db.collection('library').createIndex({ userId: 1, movieId: 1 }, { unique: true });
    return { seeded: true, count: docs.length, postersFound: Object.keys(posters).length };
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

    // Force reseed
    if (route === 'seed' && method === 'POST') {
      const r = await ensureSeeded(db, url.searchParams.get('force') === 'true');
      return json(r);
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
      const userId = url.searchParams.get('userId');
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
      const userId = url.searchParams.get('userId');
      if (!userId) return json({ error: 'userId is required' }, 400);
      await ensureSeeded(db);
      const items = await getLibraryJoined(db, userId, url.searchParams.get('status'));
      return json({ items });
    }

    if (route === 'library' && method === 'POST') {
      const body = await request.json();
      const { userId, movieId, status, rating } = body;
      if (!userId || !movieId) return json({ error: 'userId and movieId are required' }, 400);
      const movie = await db.collection('movies').findOne({ id: movieId });
      if (!movie) return json({ error: 'Movie not found' }, 404);
      const validStatuses = ['watching', 'watched', 'want_to_watch', 'dropped'];
      if (status && !validStatuses.includes(status)) return json({ error: 'Invalid status' }, 400);
      if (rating !== undefined && rating !== null && (rating < 1 || rating > 5)) return json({ error: 'Rating must be 1-5' }, 400);
      const now = new Date().toISOString();
      const set = { updatedAt: now };
      if (status) set.status = status;
      if (rating !== undefined) set.rating = rating;
      await db.collection('library').updateOne(
        { userId, movieId },
        { $set: set, $setOnInsert: { userId, movieId, addedAt: now, ...(status ? {} : { status: 'want_to_watch' }) } },
        { upsert: true }
      );
      const item = await db.collection('library').findOne({ userId, movieId }, { projection: { _id: 0 } });
      return json({ item });
    }

    if (path[0] === 'library' && path[1] && method === 'DELETE') {
      const userId = url.searchParams.get('userId');
      if (!userId) return json({ error: 'userId is required' }, 400);
      const r = await db.collection('library').deleteOne({ userId, movieId: path[1] });
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
