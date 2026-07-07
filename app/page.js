'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Toaster, toast } from 'sonner';
import {
  Film, Search, Star, X, Play, Compass, Library as LibraryIcon, Home as HomeIcon,
  Sparkles, TrendingUp, Trash2, Loader2, Plus, Check, Eye, Bookmark, ThumbsDown, MapPin,
} from 'lucide-react';
import { MOOD_PRESETS } from '@/lib/seedMovies';

const HERO_IMG = 'https://images.pexels.com/photos/7991501/pexels-photo-7991501.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940';

const STATUS_META = {
  watching: { label: 'Watching', icon: Eye, color: 'text-violet-300 border-violet-500/50 bg-violet-500/10' },
  watched: { label: 'Watched', icon: Check, color: 'text-emerald-300 border-emerald-500/50 bg-emerald-500/10' },
  want_to_watch: { label: 'Want to Watch', icon: Bookmark, color: 'text-amber-300 border-amber-500/50 bg-amber-500/10' },
  dropped: { label: 'Dropped', icon: ThumbsDown, color: 'text-zinc-400 border-zinc-600 bg-zinc-800/50' },
};

const PROVIDER_COLORS = {
  'Netflix': 'bg-red-600/20 text-red-300 border-red-600/40',
  'Showmax': 'bg-pink-600/20 text-pink-300 border-pink-600/40',
  'Prime Video': 'bg-sky-600/20 text-sky-300 border-sky-600/40',
  'Disney+': 'bg-blue-600/20 text-blue-300 border-blue-600/40',
  'Apple TV+': 'bg-zinc-500/20 text-zinc-200 border-zinc-500/40',
  'MUBI': 'bg-teal-600/20 text-teal-300 border-teal-600/40',
};

function getUserId() {
  if (typeof window === 'undefined') return null;
  let id = localStorage.getItem('tc_user_id');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('tc_user_id', id);
  }
  return id;
}

const gradientFor = (title) => {
  let h = 0;
  for (let i = 0; i < title.length; i++) h = (h * 31 + title.charCodeAt(i)) >>> 0;
  const hues = [[262, 330], [220, 280], [180, 240], [300, 350], [20, 60], [160, 200]];
  const [h1, h2] = hues[h % hues.length];
  return `linear-gradient(160deg, hsl(${h1} 45% 22%), hsl(${h2} 55% 12%))`;
};

// ---------- Poster ----------
const Poster = ({ movie, className = '' }) => {
  const [err, setErr] = useState(false);
  if (!movie.posterUrl || err) {
    return (
      <div className={`flex flex-col items-center justify-center p-3 text-center ${className}`} style={{ background: gradientFor(movie.title) }}>
        <Film className="w-8 h-8 text-white/40 mb-2" />
        <span className="text-xs font-semibold text-white/80 leading-tight">{movie.title}</span>
        <span className="text-[10px] text-white/50 mt-1">{movie.year}</span>
      </div>
    );
  }
  return <img src={movie.posterUrl} alt={movie.title} onError={() => setErr(true)} className={`object-cover ${className}`} loading="lazy" />;
};

// ---------- Movie Card ----------
const MovieCard = ({ movie, onOpen, libEntry, onQuickAdd, size = 'md' }) => {
  const w = size === 'sm' ? 'w-36' : 'w-full';
  return (
    <div className={`${w} shrink-0 group cursor-pointer`} onClick={() => onOpen(movie)} data-testid={`movie-card-${movie.title.replace(/\W+/g, '-').toLowerCase()}`}>
      <div className="relative rounded-xl overflow-hidden aspect-[2/3] bg-zinc-900 ring-1 ring-white/5 transition-all duration-300 group-hover:ring-violet-500/60 group-hover:scale-[1.03] group-hover:shadow-2xl group-hover:shadow-violet-900/30">
        <Poster movie={movie} className="w-full h-full absolute inset-0" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        {movie.matchPercent !== undefined && (
          <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[11px] font-bold bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-lg">
            {movie.matchPercent}% match
          </div>
        )}
        <div className="absolute top-2 right-2 flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-black/60 backdrop-blur-sm text-[11px] font-semibold text-amber-300">
          <Star className="w-3 h-3 fill-amber-300" /> {movie.rating}
        </div>
        {libEntry && (
          <div className={`absolute bottom-2 left-2 px-1.5 py-0.5 rounded-md border text-[10px] font-medium backdrop-blur-sm ${STATUS_META[libEntry.status]?.color || ''}`}>
            {STATUS_META[libEntry.status]?.label}
          </div>
        )}
        {!libEntry && (
          <button
            onClick={(e) => { e.stopPropagation(); onQuickAdd(movie, 'want_to_watch'); }}
            className="absolute bottom-2 right-2 w-7 h-7 rounded-full bg-white/15 backdrop-blur-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-violet-600"
            title="Add to Want to Watch" data-testid="quick-add-btn"
          >
            <Plus className="w-4 h-4 text-white" />
          </button>
        )}
      </div>
      <div className="mt-2 px-0.5">
        <p className="text-[13px] font-medium text-zinc-200 truncate">{movie.title}</p>
        <p className="text-[11px] text-zinc-500">{movie.year} · {movie.genres.slice(0, 2).join(', ')}</p>
      </div>
    </div>
  );
};

// ---------- Row ----------
const Row = ({ title, icon: Icon, movies, onOpen, libMap, onQuickAdd, subtitle }) => {
  if (!movies?.length) return null;
  return (
    <section className="mb-10">
      <div className="flex items-baseline gap-3 mb-3">
        <h2 className="text-lg font-bold flex items-center gap-2 font-display"><Icon className="w-5 h-5 text-violet-400" /> {title}</h2>
        {subtitle && <span className="text-xs text-zinc-500">{subtitle}</span>}
      </div>
      <div className="flex gap-4 overflow-x-auto pb-3 scrollbar-thin">
        {movies.map((m) => (
          <MovieCard key={m.id} movie={m} onOpen={onOpen} libEntry={libMap[m.id]} onQuickAdd={onQuickAdd} size="sm" />
        ))}
      </div>
    </section>
  );
};

// ---------- Mood bar (visualizes a movie's mood coords) ----------
const MoodBar = ({ leftLabel, rightLabel, value }) => {
  const pct = ((value + 1) / 2) * 100;
  return (
    <div className="mb-2.5">
      <div className="flex justify-between text-[11px] text-zinc-500 mb-1">
        <span>{leftLabel}</span><span>{rightLabel}</span>
      </div>
      <div className="h-1.5 rounded-full bg-zinc-800 relative">
        <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-gradient-to-r from-violet-400 to-fuchsia-400 shadow-md shadow-violet-500/50" style={{ left: `calc(${pct}% - 6px)` }} />
      </div>
    </div>
  );
};

// ---------- Star rating ----------
const StarRating = ({ value, onChange }) => (
  <div className="flex gap-1" data-testid="star-rating">
    {[1, 2, 3, 4, 5].map((s) => (
      <button key={s} onClick={() => onChange(s)} className="transition-transform hover:scale-125">
        <Star className={`w-6 h-6 ${s <= (value || 0) ? 'fill-amber-400 text-amber-400' : 'text-zinc-600'}`} />
      </button>
    ))}
  </div>
);

// ---------- Detail Modal ----------
const MovieModal = ({ movie, onClose, libEntry, onSetStatus, onSetRating, onRemove, onOpen, libMap, onQuickAdd }) => {
  const [detail, setDetail] = useState(null);
  const [meta, setMeta] = useState(null);
  const [showTrailer, setShowTrailer] = useState(false);

  useEffect(() => {
    setDetail(null); setMeta(null); setShowTrailer(false);
    fetch(`/api/movies/${movie.id}`).then((r) => r.json()).then(setDetail).catch(() => {});
    fetch(`/api/movies/${movie.id}/metadata?region=ZA`).then((r) => r.json()).then(setMeta).catch(() => setMeta({ tmdbEnabled: false }));
  }, [movie.id]);

  const trailerQuery = encodeURIComponent(`${movie.title} ${movie.year} official trailer`);
  const trailerSrc = meta?.trailerKey
    ? `https://www.youtube.com/embed/${meta.trailerKey}?autoplay=1`
    : `https://www.youtube.com/embed?listType=search&list=${trailerQuery}&autoplay=1`;
  const realProviders = meta?.tmdbEnabled && meta?.providers ? meta.providers : null;
  const CATEGORY_LABELS = { stream: 'Stream', rent: 'Rent', buy: 'Buy' };

  return (
    <div className="fixed inset-0 z-50 flex items-start md:items-center justify-center p-0 md:p-6 overflow-y-auto" data-testid="movie-modal">
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-3xl bg-[#12121a] md:rounded-2xl ring-1 ring-white/10 shadow-2xl my-0 md:my-8 overflow-hidden">
        <button onClick={onClose} className="absolute top-3 right-3 z-20 w-9 h-9 rounded-full bg-black/60 backdrop-blur flex items-center justify-center hover:bg-black/90 transition" data-testid="modal-close">
          <X className="w-5 h-5" />
        </button>

        {/* Trailer / backdrop */}
        <div className="relative aspect-video bg-black">
          {showTrailer ? (
            <iframe
              className="w-full h-full"
              src={trailerSrc}
              title={`${movie.title} trailer`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <>
              <Poster movie={movie} className="w-full h-full absolute inset-0 opacity-40 blur-[2px] scale-110" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#12121a] via-black/30 to-black/50" />
              <div className="absolute inset-0 flex items-center justify-center">
                <button onClick={() => setShowTrailer(true)} className="flex items-center gap-2 px-5 py-3 rounded-full bg-white/10 backdrop-blur-md ring-1 ring-white/20 hover:bg-violet-600 transition font-semibold" data-testid="play-trailer-btn">
                  <Play className="w-5 h-5 fill-white" /> Play Trailer
                </button>
              </div>
              <div className="absolute bottom-4 left-5 right-16">
                <h2 className="text-2xl md:text-3xl font-bold font-display drop-shadow-lg">{movie.title}</h2>
                <p className="text-sm text-zinc-300 mt-1">{movie.year} · {movie.genres.join(' · ')} · <Star className="w-3.5 h-3.5 inline fill-amber-300 text-amber-300 -mt-0.5" /> {movie.rating}</p>
              </div>
            </>
          )}
        </div>

        <div className="p-5 md:p-6 grid md:grid-cols-[1fr_240px] gap-6">
          <div>
            <p className="text-sm text-zinc-300 leading-relaxed">{movie.overview}</p>

            {/* Library controls */}
            <div className="mt-5">
              <p className="text-xs uppercase tracking-widest text-zinc-500 mb-2 font-semibold">My Library</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(STATUS_META).map(([key, meta]) => {
                  const Icon = meta.icon;
                  const active = libEntry?.status === key;
                  return (
                    <button
                      key={key}
                      onClick={() => onSetStatus(movie, key)}
                      data-testid={`status-btn-${key}`}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition ${active ? meta.color + ' ring-1 ring-current' : 'border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200'}`}
                    >
                      <Icon className="w-3.5 h-3.5" /> {meta.label}
                    </button>
                  );
                })}
                {libEntry && (
                  <button onClick={() => onRemove(movie)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-red-900/60 text-red-400 text-xs hover:bg-red-950/40 transition" data-testid="remove-from-library-btn">
                    <Trash2 className="w-3.5 h-3.5" /> Remove
                  </button>
                )}
              </div>
              <div className="mt-4 flex items-center gap-3">
                <span className="text-xs text-zinc-500">Your rating:</span>
                <StarRating value={libEntry?.rating} onChange={(r) => onSetRating(movie, r)} />
              </div>
            </div>

            {/* Where to watch */}
            <div className="mt-5">
              <p className="text-xs uppercase tracking-widest text-zinc-500 mb-2 font-semibold flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> Where to Watch <span className="text-zinc-600 normal-case tracking-normal">(South Africa)</span></p>
              {!meta ? (
                <div className="flex gap-2">
                  {[1, 2, 3].map((i) => <div key={i} className="w-20 h-7 rounded-lg bg-zinc-800/80 animate-pulse" />)}
                </div>
              ) : realProviders ? (
                realProviders.items?.length ? (
                  <div className="space-y-2.5" data-testid="real-providers">
                    {['stream', 'rent', 'buy'].map((cat) => {
                      const items = realProviders.items.filter((p) => p.category === cat);
                      if (!items.length) return null;
                      return (
                        <div key={cat} className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] uppercase tracking-wider text-zinc-500 w-12">{CATEGORY_LABELS[cat]}</span>
                          {items.map((p) => (
                            <span key={`${p.providerId}-${cat}`} className="flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-xs font-medium" title={p.name}>
                              {p.logoUrl && <img src={p.logoUrl} alt={p.name} className="w-5 h-5 rounded" />}
                              {p.name}
                            </span>
                          ))}
                        </div>
                      );
                    })}
                    {realProviders.link && (
                      <a href={realProviders.link} target="_blank" rel="noopener noreferrer" className="inline-block text-[11px] text-violet-400 hover:text-violet-300 underline underline-offset-2">
                        View all options on TMDB ↗
                      </a>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-zinc-500">Not currently available on streaming services in South Africa.</p>
                )
              ) : (
                <>
                  <div className="flex flex-wrap gap-2">
                    {(movie.providers || []).map((p) => (
                      <span key={p} className={`px-3 py-1 rounded-lg border text-xs font-semibold ${PROVIDER_COLORS[p] || 'bg-zinc-800 text-zinc-300 border-zinc-700'}`}>{p}</span>
                    ))}
                  </div>
                  <p className="text-[10px] text-zinc-600 mt-1.5">Sample availability — connects to live TMDB data when an API key is added.</p>
                </>
              )}
            </div>
          </div>

          {/* Mood fingerprint */}
          <div className="bg-white/[0.03] rounded-xl p-4 ring-1 ring-white/5 h-fit">
            <p className="text-xs uppercase tracking-widest text-zinc-500 mb-3 font-semibold flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5 text-violet-400" /> Mood Fingerprint</p>
            <MoodBar leftLabel="Challenging" rightLabel="Comforting" value={movie.mood.c} />
            <MoodBar leftLabel="Heavy" rightLabel="Light" value={movie.mood.l} />
            <MoodBar leftLabel="Intense" rightLabel="Calm" value={movie.mood.m} />
          </div>
        </div>

        {/* Similar */}
        {detail?.similar?.length > 0 && (
          <div className="px-5 md:px-6 pb-6">
            <p className="text-xs uppercase tracking-widest text-zinc-500 mb-3 font-semibold">Emotionally Similar</p>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {detail.similar.map((s) => (
                <div key={s.id} className="w-24 shrink-0 cursor-pointer group" onClick={() => onOpen(s)}>
                  <div className="rounded-lg overflow-hidden aspect-[2/3] ring-1 ring-white/5 group-hover:ring-violet-500/60 transition relative">
                    <Poster movie={s} className="w-full h-full absolute inset-0" />
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-1 truncate">{s.title}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ---------- Mood Slider ----------
const MoodSlider = ({ leftLabel, rightLabel, leftEmoji, rightEmoji, value, onChange, testId }) => (
  <div className="mb-7">
    <div className="flex justify-between items-center mb-2.5">
      <span className={`text-sm font-medium transition ${value < -15 ? 'text-fuchsia-300' : 'text-zinc-500'}`}>{leftEmoji} {leftLabel}</span>
      <span className={`text-sm font-medium transition ${value > 15 ? 'text-violet-300' : 'text-zinc-500'}`}>{rightLabel} {rightEmoji}</span>
    </div>
    <Slider value={[value]} onValueChange={([v]) => onChange(v)} min={-100} max={100} step={5} data-testid={testId} className="[&_[role=slider]]:bg-gradient-to-r [&_[role=slider]]:from-violet-500 [&_[role=slider]]:to-fuchsia-500 [&_[role=slider]]:border-0 [&_[role=slider]]:w-5 [&_[role=slider]]:h-5 [&_[role=slider]]:shadow-lg [&_[role=slider]]:shadow-violet-500/40" />
  </div>
);

// ---------- Main App ----------
function App() {
  const [userId, setUserId] = useState(null);
  const [view, setView] = useState('home');
  const [movies, setMovies] = useState([]);
  const [genres, setGenres] = useState([]);
  const [genreFilter, setGenreFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [libItems, setLibItems] = useState([]);
  const [libTab, setLibTab] = useState('watching');
  const [forYou, setForYou] = useState({ profileBased: false, results: [] });
  const [mood, setMood] = useState({ c: 60, l: 50, m: 40 });
  const [activePreset, setActivePreset] = useState('cozy');
  const [moodResults, setMoodResults] = useState([]);
  const [moodLoading, setMoodLoading] = useState(false);
  const moodTimer = useRef(null);

  const libMap = useMemo(() => Object.fromEntries(libItems.map((i) => [i.movieId, i])), [libItems]);

  useEffect(() => { setUserId(getUserId()); }, []);

  const loadMovies = useCallback(async () => {
    setLoading(true);
    try {
      const [mRes, gRes] = await Promise.all([fetch('/api/movies?sort=popular'), fetch('/api/genres')]);
      const mData = await mRes.json();
      const gData = await gRes.json();
      setMovies(mData.movies || []);
      setGenres(gData.genres || []);
    } catch (e) { toast.error('Failed to load movies'); }
    setLoading(false);
  }, []);

  const loadLibrary = useCallback(async (uid) => {
    if (!uid) return;
    try {
      const res = await fetch(`/api/library?userId=${uid}`);
      const data = await res.json();
      setLibItems(data.items || []);
    } catch (e) {}
  }, []);

  const loadForYou = useCallback(async (uid) => {
    try {
      const res = await fetch(`/api/recommendations/foryou?userId=${uid || ''}`);
      setForYou(await res.json());
    } catch (e) {}
  }, []);

  useEffect(() => { loadMovies(); }, [loadMovies]);
  useEffect(() => { if (userId) { loadLibrary(userId); loadForYou(userId); } }, [userId, loadLibrary, loadForYou]);

  // Mood querying with debounce
  const fetchMood = useCallback(async (m) => {
    setMoodLoading(true);
    try {
      const res = await fetch('/api/recommendations/mood', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mood: { c: m.c / 100, l: m.l / 100, m: m.m / 100 }, limit: 18 }),
      });
      const data = await res.json();
      setMoodResults(data.results || []);
    } catch (e) {}
    setMoodLoading(false);
  }, []);

  useEffect(() => {
    if (view !== 'mood') return;
    clearTimeout(moodTimer.current);
    moodTimer.current = setTimeout(() => fetchMood(mood), 350);
    return () => clearTimeout(moodTimer.current);
  }, [mood, view, fetchMood]);

  const setStatus = async (movie, status) => {
    const prev = libItems;
    const now = new Date().toISOString();
    const existing = libMap[movie.id];
    const updated = existing
      ? libItems.map((i) => (i.movieId === movie.id ? { ...i, status, updatedAt: now } : i))
      : [{ userId, movieId: movie.id, status, updatedAt: now, addedAt: now, movie }, ...libItems];
    setLibItems(updated);
    try {
      const res = await fetch('/api/library', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId, movieId: movie.id, status }) });
      if (!res.ok) throw new Error();
      toast.success(`${movie.title} → ${STATUS_META[status].label}`);
      loadForYou(userId);
    } catch (e) { setLibItems(prev); toast.error('Failed to update library'); }
  };

  const setRating = async (movie, rating) => {
    const now = new Date().toISOString();
    const existing = libMap[movie.id];
    const updated = existing
      ? libItems.map((i) => (i.movieId === movie.id ? { ...i, rating, updatedAt: now } : i))
      : [{ userId, movieId: movie.id, status: 'watched', rating, updatedAt: now, addedAt: now, movie }, ...libItems];
    setLibItems(updated);
    try {
      await fetch('/api/library', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId, movieId: movie.id, rating, ...(existing ? {} : { status: 'watched' }) }) });
      toast.success(`Rated ${movie.title} ${rating}★`);
      loadForYou(userId);
    } catch (e) { toast.error('Failed to save rating'); }
  };

  const removeFromLib = async (movie) => {
    setLibItems(libItems.filter((i) => i.movieId !== movie.id));
    try {
      await fetch(`/api/library/${movie.id}?userId=${userId}`, { method: 'DELETE' });
      toast.success(`Removed ${movie.title} from library`);
      loadForYou(userId);
    } catch (e) {}
  };

  const applyPreset = (preset) => {
    setActivePreset(preset.id);
    setMood({ c: Math.round(preset.mood.c * 100), l: Math.round(preset.mood.l * 100), m: Math.round(preset.mood.m * 100) });
    setView('mood');
  };

  const filteredMovies = useMemo(() => {
    let list = movies;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((m) => m.title.toLowerCase().includes(q) || m.genres.some((g) => g.toLowerCase().includes(q)));
    }
    if (genreFilter !== 'All') list = list.filter((m) => m.genres.includes(genreFilter));
    return list;
  }, [movies, search, genreFilter]);

  const continueWatching = useMemo(() => libItems.filter((i) => i.status === 'watching').map((i) => i.movie), [libItems]);
  const trending = useMemo(() => [...movies].sort((a, b) => b.popularity - a.popularity).slice(0, 15), [movies]);
  const libByTab = useMemo(() => libItems.filter((i) => i.status === libTab), [libItems, libTab]);

  const NavBtn = ({ id, icon: Icon, label }) => (
    <button
      onClick={() => setView(id)}
      data-testid={`nav-${id}`}
      className={`flex items-center gap-2 px-3.5 py-2 rounded-full text-sm font-medium transition ${view === id ? 'bg-white/10 text-white' : 'text-zinc-400 hover:text-white'}`}
    >
      <Icon className="w-4 h-4" /> <span className="hidden sm:inline">{label}</span>
    </button>
  );

  return (
    <div className="min-h-screen">
      <Toaster theme="dark" position="bottom-right" richColors />

      {/* Nav */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-[#0a0a0f]/80 border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 flex items-center gap-3">
          <button onClick={() => setView('home')} className="flex items-center gap-2 mr-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center shadow-lg shadow-violet-900/50">
              <Compass className="w-4.5 h-4.5 text-white w-5 h-5" />
            </div>
            <span className="font-bold text-base font-display hidden md:inline">Taste<span className="text-violet-400">Cartography</span></span>
          </button>
          <nav className="flex items-center gap-1">
            <NavBtn id="home" icon={HomeIcon} label="Home" />
            <NavBtn id="mood" icon={Sparkles} label="Mood Lab" />
            <NavBtn id="library" icon={LibraryIcon} label="My Library" />
          </nav>
          <div className="ml-auto relative w-40 sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); if (e.target.value) setView('home'); }}
              placeholder="Search movies..."
              data-testid="search-input"
              className="w-full h-9 pl-9 pr-3 rounded-full bg-white/5 border border-white/10 text-sm placeholder:text-zinc-600 focus:outline-none focus:border-violet-500/60 focus:bg-white/[0.07] transition"
            />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 md:px-6 pb-20">
        {/* ============ HOME ============ */}
        {view === 'home' && (
          <>
            {!search && (
              <section className="relative rounded-2xl overflow-hidden mt-6 mb-10 ring-1 ring-white/10">
                <img src={HERO_IMG} alt="Cinema" className="absolute inset-0 w-full h-full object-cover opacity-50" />
                <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0f] via-[#0a0a0f]/70 to-transparent" />
                <div className="relative p-8 md:p-14 max-w-2xl">
                  <Badge className="bg-violet-600/20 text-violet-300 border border-violet-500/40 mb-4 hover:bg-violet-600/20">Emotional Intelligence for Movie Night</Badge>
                  <h1 className="text-3xl md:text-5xl font-bold font-display leading-tight">
                    Find films that match <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-fuchsia-400">your mood</span>
                  </h1>
                  <p className="text-zinc-400 mt-3 text-sm md:text-base max-w-lg">
                    Every movie mapped on three emotional axes — comforting↔challenging, light↔heavy, calm↔intense. Tell us how you feel, we'll find the film.
                  </p>
                  <div className="flex flex-wrap gap-2 mt-6">
                    {MOOD_PRESETS.map((p) => (
                      <button key={p.id} onClick={() => applyPreset(p)} data-testid={`hero-preset-${p.id}`}
                        className="px-4 py-2 rounded-full bg-white/5 border border-white/15 text-sm hover:bg-violet-600/30 hover:border-violet-500/60 transition backdrop-blur-sm">
                        {p.emoji} {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              </section>
            )}

            {loading ? (
              <div className="flex flex-col items-center justify-center py-24 text-zinc-500">
                <Loader2 className="w-8 h-8 animate-spin mb-3 text-violet-400" />
                <p className="text-sm">Charting the taste map... (first load seeds the catalog)</p>
              </div>
            ) : search ? (
              <section className="mt-6">
                <h2 className="text-lg font-bold mb-4 font-display">Results for "{search}" <span className="text-zinc-500 text-sm font-normal">({filteredMovies.length})</span></h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {filteredMovies.map((m) => <MovieCard key={m.id} movie={m} onOpen={setSelected} libEntry={libMap[m.id]} onQuickAdd={setStatus} />)}
                </div>
                {!filteredMovies.length && <p className="text-zinc-500 text-sm py-10 text-center">No movies found.</p>}
              </section>
            ) : (
              <>
                <Row title="Continue Watching" icon={Eye} movies={continueWatching} onOpen={setSelected} libMap={libMap} onQuickAdd={setStatus} />
                <Row title="For You" icon={Sparkles} movies={forYou.results.slice(0, 15)} onOpen={setSelected} libMap={libMap} onQuickAdd={setStatus}
                  subtitle={forYou.profileBased ? 'based on your taste profile' : 'popular picks — rate movies to personalize'} />
                <Row title="Trending" icon={TrendingUp} movies={trending} onOpen={setSelected} libMap={libMap} onQuickAdd={setStatus} />

                <section>
                  <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                    <h2 className="text-lg font-bold flex items-center gap-2 font-display"><Film className="w-5 h-5 text-violet-400" /> Full Catalog</h2>
                    <div className="flex gap-1.5 overflow-x-auto pb-1">
                      {['All', ...genres].map((g) => (
                        <button key={g} onClick={() => setGenreFilter(g)}
                          className={`px-3 py-1 rounded-full text-xs whitespace-nowrap border transition ${genreFilter === g ? 'bg-violet-600 border-violet-500 text-white' : 'border-zinc-700 text-zinc-400 hover:border-zinc-500'}`}>
                          {g}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4" data-testid="catalog-grid">
                    {filteredMovies.map((m) => <MovieCard key={m.id} movie={m} onOpen={setSelected} libEntry={libMap[m.id]} onQuickAdd={setStatus} />)}
                  </div>
                </section>
              </>
            )}
          </>
        )}

        {/* ============ MOOD LAB ============ */}
        {view === 'mood' && (
          <div className="mt-8">
            <div className="text-center max-w-xl mx-auto mb-8">
              <h1 className="text-2xl md:text-4xl font-bold font-display">How are you <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-fuchsia-400">feeling</span> tonight?</h1>
              <p className="text-zinc-500 text-sm mt-2">Dial in your emotional state. We'll search the mood-space for your perfect match.</p>
            </div>

            <div className="grid lg:grid-cols-[380px_1fr] gap-8">
              <div className="bg-white/[0.03] rounded-2xl p-6 ring-1 ring-white/8 h-fit lg:sticky lg:top-24">
                <div className="flex flex-wrap gap-2 mb-7">
                  {MOOD_PRESETS.map((p) => (
                    <button key={p.id} onClick={() => applyPreset(p)} data-testid={`preset-${p.id}`}
                      className={`px-3 py-1.5 rounded-full text-xs border transition ${activePreset === p.id ? 'bg-violet-600 border-violet-500 text-white shadow-lg shadow-violet-900/40' : 'border-zinc-700 text-zinc-400 hover:border-violet-500/50 hover:text-zinc-200'}`}>
                      {p.emoji} {p.label}
                    </button>
                  ))}
                </div>
                <MoodSlider leftLabel="Challenging" rightLabel="Comforting" leftEmoji="🌊" rightEmoji="🫖" value={mood.c} onChange={(v) => { setMood({ ...mood, c: v }); setActivePreset(null); }} testId="slider-comforting" />
                <MoodSlider leftLabel="Heavy" rightLabel="Light" leftEmoji="🪨" rightEmoji="🎈" value={mood.l} onChange={(v) => { setMood({ ...mood, l: v }); setActivePreset(null); }} testId="slider-light" />
                <MoodSlider leftLabel="Intense" rightLabel="Calm" leftEmoji="🔥" rightEmoji="🌊" value={mood.m} onChange={(v) => { setMood({ ...mood, m: v }); setActivePreset(null); }} testId="slider-calm" />
                <p className="text-[11px] text-zinc-600 mt-2">Results update live via cosine matching in 3D mood-space.</p>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-4">
                  <h2 className="text-lg font-bold font-display">Your Mood Matches</h2>
                  {moodLoading && <Loader2 className="w-4 h-4 animate-spin text-violet-400" />}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4" data-testid="mood-results-grid">
                  {moodResults.map((m) => <MovieCard key={m.id} movie={m} onOpen={setSelected} libEntry={libMap[m.id]} onQuickAdd={setStatus} />)}
                </div>
                {!moodResults.length && !moodLoading && <p className="text-zinc-500 text-sm py-10 text-center">Move the sliders to explore the mood-space.</p>}
              </div>
            </div>
          </div>
        )}

        {/* ============ LIBRARY ============ */}
        {view === 'library' && (
          <div className="mt-8">
            <h1 className="text-2xl md:text-3xl font-bold font-display mb-1">My Library</h1>
            <p className="text-zinc-500 text-sm mb-6">{libItems.length} title{libItems.length === 1 ? '' : 's'} tracked</p>
            <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
              {Object.entries(STATUS_META).map(([key, meta]) => {
                const Icon = meta.icon;
                const count = libItems.filter((i) => i.status === key).length;
                return (
                  <button key={key} onClick={() => setLibTab(key)} data-testid={`lib-tab-${key}`}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm border whitespace-nowrap transition ${libTab === key ? meta.color + ' ring-1 ring-current font-semibold' : 'border-zinc-700 text-zinc-400 hover:border-zinc-500'}`}>
                    <Icon className="w-4 h-4" /> {meta.label} <span className="text-xs opacity-70">({count})</span>
                  </button>
                );
              })}
            </div>
            {libByTab.length ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4" data-testid="library-grid">
                {libByTab.map((i) => (
                  <div key={i.movieId}>
                    <MovieCard movie={i.movie} onOpen={setSelected} libEntry={i} onQuickAdd={setStatus} />
                    {i.rating && (
                      <div className="flex gap-0.5 mt-1 px-0.5">
                        {[1, 2, 3, 4, 5].map((s) => <Star key={s} className={`w-3 h-3 ${s <= i.rating ? 'fill-amber-400 text-amber-400' : 'text-zinc-700'}`} />)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-20 text-zinc-500">
                <LibraryIcon className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p className="text-sm">Nothing here yet. Add movies from Home or the Mood Lab.</p>
                <Button onClick={() => setView('home')} className="mt-4 bg-violet-600 hover:bg-violet-500">Browse Movies</Button>
              </div>
            )}
          </div>
        )}
      </main>

      {selected && (
        <MovieModal
          movie={selected}
          onClose={() => setSelected(null)}
          libEntry={libMap[selected.id]}
          onSetStatus={setStatus}
          onSetRating={setRating}
          onRemove={(m) => { removeFromLib(m); }}
          onOpen={setSelected}
          libMap={libMap}
          onQuickAdd={setStatus}
        />
      )}

      <footer className="border-t border-white/5 py-8 text-center text-xs text-zinc-600">
        Taste Cartography — movies mapped by emotion · Region: South Africa 🇿🇦
      </footer>
    </div>
  );
}

export default App;
