'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Toaster, toast } from 'sonner';
import {
  Film, Search, Star, X, Play, Compass, Library as LibraryIcon, Home as HomeIcon,
  Sparkles, TrendingUp, Trash2, Loader2, Plus, Check, Eye, Bookmark, ThumbsDown, MapPin,
  Orbit, Dna, Heart, LogOut, ExternalLink,
} from 'lucide-react';
import {
  ResponsiveContainer, PieChart, Pie, Cell, RadarChart, PolarGrid, PolarAngleAxis, Radar,
  BarChart, Bar, XAxis, YAxis, Tooltip as ReTooltip,
} from 'recharts';
import { MOOD_PRESETS } from '@/lib/seedMovies';
import { searchLink } from '@/lib/platformLinks';

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

// Pre-auth versions of the app stored a random id in localStorage. We keep
// reading it once so a returning user's old library can be merged into their
// new account, then the key is removed.
function getLegacyUserId() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('tc_user_id');
}

// ---------- Auth screen ----------
const AuthScreen = ({ onAuthed }) => {
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await fetch(`/api/auth/${mode === 'login' ? 'login' : 'register'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mode === 'login' ? { email, password } : { email, password, name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Something went wrong');
      onAuthed(data.user);
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2.5 justify-center mb-8">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center shadow-lg shadow-violet-900/50">
            <Compass className="w-5.5 h-5.5 text-white w-6 h-6" />
          </div>
          <span className="font-bold text-xl font-display">Taste<span className="text-violet-400">Cartography</span></span>
        </div>

        <div className="bg-white/[0.03] rounded-2xl ring-1 ring-white/10 p-6">
          <h1 className="text-lg font-semibold mb-1">{mode === 'login' ? 'Welcome back' : 'Create your account'}</h1>
          <p className="text-xs text-zinc-500 mb-5">
            {mode === 'login' ? 'Sign in to your library and recommendations.' : 'Your library and taste profile, saved across devices.'}
          </p>

          <form onSubmit={submit} className="space-y-3">
            {mode === 'signup' && (
              <input
                value={name} onChange={(e) => setName(e.target.value)}
                placeholder="Name" autoComplete="name" data-testid="auth-name"
                className="w-full h-10 px-3.5 rounded-xl bg-white/5 border border-white/10 text-sm placeholder:text-zinc-600 focus:outline-none focus:border-violet-500/60 transition"
              />
            )}
            <input
              value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="Email" type="email" required autoComplete="email" data-testid="auth-email"
              className="w-full h-10 px-3.5 rounded-xl bg-white/5 border border-white/10 text-sm placeholder:text-zinc-600 focus:outline-none focus:border-violet-500/60 transition"
            />
            <input
              value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === 'signup' ? 'Password (min 8 characters)' : 'Password'}
              type="password" required minLength={8}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'} data-testid="auth-password"
              className="w-full h-10 px-3.5 rounded-xl bg-white/5 border border-white/10 text-sm placeholder:text-zinc-600 focus:outline-none focus:border-violet-500/60 transition"
            />
            {error && <p className="text-xs text-red-400" data-testid="auth-error">{error}</p>}
            <button
              type="submit" disabled={busy} data-testid="auth-submit"
              className="w-full h-10 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 font-semibold text-sm hover:opacity-90 disabled:opacity-50 transition flex items-center justify-center gap-2"
            >
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}
              {mode === 'login' ? 'Sign in' : 'Sign up'}
            </button>
          </form>

          <button
            onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); }}
            data-testid="auth-toggle-mode"
            className="w-full text-center text-xs text-zinc-500 hover:text-zinc-300 mt-4 transition"
          >
            {mode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
          </button>
        </div>
      </div>
    </div>
  );
};

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

// ---------- Taste Map (2D emotional constellation) ----------
const GENRE_COLORS = {
  Action: '#ef4444', Adventure: '#f97316', Animation: '#f59e0b', Comedy: '#eab308',
  Crime: '#b91c1c', Drama: '#8b5cf6', Family: '#22c55e', Fantasy: '#a855f7',
  History: '#a16207', Horror: '#9f1239', Music: '#ec4899', Musical: '#ec4899',
  Mystery: '#6366f1', Romance: '#f43f5e', 'Sci-Fi': '#06b6d4', Thriller: '#4338ca',
  War: '#78716c', Western: '#b45309',
};

const moodColor = (c) => {
  const lerp = (a, b, t) => Math.round(a + (b - a) * t);
  if (c < 0) { const t = c + 1; return `rgb(${lerp(244, 139, t)},${lerp(63, 92, t)},${lerp(94, 246, t)})`; }
  return `rgb(${lerp(139, 52, c)},${lerp(92, 211, c)},${lerp(246, 153, c)})`;
};

const jitterFor = (title, salt) => {
  let h = salt;
  for (let i = 0; i < title.length; i++) h = (h * 33 + title.charCodeAt(i)) >>> 0;
  return ((h % 1000) / 1000 - 0.5) * 28;
};

const TasteMap = ({ movies, libMap, onOpen }) => {
  const [hover, setHover] = useState(null);
  const [colorMode, setColorMode] = useState('mood'); // 'mood' | 'genre'
  const [highlightLib, setHighlightLib] = useState(false);
  const W = 1000, H = 620;

  const points = useMemo(() => movies.map((m) => ({
    m,
    x: 60 + (1 - (m.mood.m + 1) / 2) * (W - 120) + jitterFor(m.title, 7),
    y: 45 + (1 - (m.mood.l + 1) / 2) * (H - 110) + jitterFor(m.title, 13),
    r: 5 + (m.popularity / 100) * 6,
    inLib: !!libMap[m.id],
  })), [movies, libMap]);

  const quadrants = [
    { x: W * 0.25, y: 30, label: '🍵 Gentle & Cozy' },
    { x: W * 0.75, y: 30, label: '🎢 Fun & Thrilling' },
    { x: W * 0.25, y: H - 14, label: '🌧 Bittersweet & Reflective' },
    { x: W * 0.75, y: H - 14, label: '🌩 Dark & Gripping' },
  ];

  return (
    <div className="relative">
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex rounded-full border border-zinc-700 overflow-hidden text-xs">
          <button onClick={() => setColorMode('mood')} data-testid="map-color-mood"
            className={`px-3.5 py-1.5 transition ${colorMode === 'mood' ? 'bg-violet-600 text-white' : 'text-zinc-400 hover:text-zinc-200'}`}>Color by mood</button>
          <button onClick={() => setColorMode('genre')} data-testid="map-color-genre"
            className={`px-3.5 py-1.5 transition ${colorMode === 'genre' ? 'bg-violet-600 text-white' : 'text-zinc-400 hover:text-zinc-200'}`}>Color by genre</button>
        </div>
        <button onClick={() => setHighlightLib(!highlightLib)} data-testid="map-highlight-library"
          className={`px-3.5 py-1.5 rounded-full text-xs border transition ${highlightLib ? 'bg-amber-500/20 border-amber-500/60 text-amber-300' : 'border-zinc-700 text-zinc-400 hover:border-zinc-500'}`}>
          ★ Highlight my library
        </button>
        {colorMode === 'mood' && (
          <div className="flex items-center gap-2 text-[11px] text-zinc-500 ml-auto">
            <span>Challenging</span>
            <div className="w-24 h-2 rounded-full" style={{ background: 'linear-gradient(90deg,#f43f5e,#8b5cf6,#34d399)' }} />
            <span>Comforting</span>
          </div>
        )}
      </div>

      <div className="relative rounded-2xl ring-1 ring-white/10 bg-gradient-to-b from-[#0d0d16] to-[#12101c] overflow-hidden">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto block" data-testid="taste-map-svg">
          {/* grid axes */}
          <line x1={W / 2} y1={30} x2={W / 2} y2={H - 30} stroke="rgba(255,255,255,0.07)" strokeDasharray="4 6" />
          <line x1={40} y1={H / 2} x2={W - 40} y2={H / 2} stroke="rgba(255,255,255,0.07)" strokeDasharray="4 6" />
          {/* axis labels */}
          <text x={48} y={H / 2 - 8} fill="rgba(255,255,255,0.35)" fontSize="13">Calm</text>
          <text x={W - 95} y={H / 2 - 8} fill="rgba(255,255,255,0.35)" fontSize="13">Intense</text>
          <text x={W / 2 + 8} y={52} fill="rgba(255,255,255,0.35)" fontSize="13">Light</text>
          <text x={W / 2 + 8} y={H - 38} fill="rgba(255,255,255,0.35)" fontSize="13">Heavy</text>
          {quadrants.map((q) => (
            <text key={q.label} x={q.x} y={q.y} textAnchor="middle" fill="rgba(255,255,255,0.22)" fontSize="15" fontWeight="600">{q.label}</text>
          ))}
          {points.map((p) => {
            const dim = highlightLib && !p.inLib;
            const fill = colorMode === 'mood' ? moodColor(p.m.mood.c) : (GENRE_COLORS[p.m.genres[0]] || '#8b5cf6');
            return (
              <circle
                key={p.m.id}
                cx={p.x} cy={p.y} r={hover?.m.id === p.m.id ? p.r + 3 : p.r}
                fill={fill}
                fillOpacity={dim ? 0.12 : 0.85}
                stroke={p.inLib ? '#fbbf24' : 'rgba(255,255,255,0.25)'}
                strokeWidth={p.inLib ? 2 : 0.5}
                className="cursor-pointer transition-all"
                onMouseEnter={() => setHover(p)}
                onMouseLeave={() => setHover(null)}
                onClick={() => onOpen(p.m)}
              />
            );
          })}
        </svg>

        {hover && (
          <div
            className="absolute z-10 pointer-events-none flex gap-2.5 p-2 rounded-xl bg-black/90 backdrop-blur ring-1 ring-white/15 shadow-2xl w-52"
            style={{
              left: `calc(${(hover.x / W) * 100}% ${hover.x > W * 0.72 ? '- 220px' : '+ 14px'})`,
              top: `calc(${(hover.y / H) * 100}% ${hover.y > H * 0.65 ? '- 110px' : '+ 8px'})`,
            }}
          >
            <div className="w-14 h-20 rounded-md overflow-hidden shrink-0 relative bg-zinc-800">
              <Poster movie={hover.m} className="w-full h-full absolute inset-0" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold leading-tight">{hover.m.title}</p>
              <p className="text-[10px] text-zinc-400 mt-0.5">{hover.m.year} · ★ {hover.m.rating}</p>
              <p className="text-[10px] text-zinc-500 mt-1 leading-snug">{hover.m.genres.slice(0, 2).join(' · ')}</p>
              {hover.inLib && <p className="text-[10px] text-amber-300 mt-1">★ In your library</p>}
            </div>
          </div>
        )}
      </div>
      <p className="text-[11px] text-zinc-600 mt-3">Each dot is a film positioned by its emotional coordinates — hover to preview, click to open. Size = popularity.</p>
    </div>
  );
};

// ---------- Taste DNA ----------
const PERSONAS = {
  Comforting: { name: 'The Comfort Curator', desc: 'You gravitate toward warm, reassuring stories that feel like a soft blanket.' },
  Challenging: { name: 'The Fearless Explorer', desc: 'You seek films that confront, provoke, and refuse easy answers.' },
  Light: { name: 'The Joy Seeker', desc: 'Playful, buoyant cinema is your happy place — laughter over gloom.' },
  Heavy: { name: 'The Deep Diver', desc: 'You are drawn to weighty, emotionally rich stories that stay with you.' },
  Calm: { name: 'The Quiet Contemplative', desc: 'Slow-burning, meditative films are where you find meaning.' },
  Intense: { name: 'The Adrenaline Chaser', desc: 'You want cinema that grabs you by the collar and never lets go.' },
};
const PIE_COLORS = ['#8b5cf6', '#ec4899', '#06b6d4', '#f59e0b', '#34d399', '#f43f5e', '#6366f1', '#eab308'];

const TasteDNA = ({ libItems, onBrowse }) => {
  const data = useMemo(() => {
    const positives = libItems.filter((i) => i.movie && i.status !== 'dropped' && (!i.rating || i.rating >= 3));
    if (positives.length < 3) return null;
    const w = (i) => (i.rating ? i.rating - 2 : 1); // 3star->1, 5star->3
    // Mood radar (6 poles)
    const poles = { Comforting: 0, Challenging: 0, Light: 0, Heavy: 0, Calm: 0, Intense: 0 };
    let tot = 0;
    const genreCount = {};
    const decadeCount = {};
    for (const i of positives) {
      const wt = w(i);
      tot += wt;
      const { c, l, m } = i.movie.mood;
      poles.Comforting += Math.max(c, 0) * wt; poles.Challenging += Math.max(-c, 0) * wt;
      poles.Light += Math.max(l, 0) * wt; poles.Heavy += Math.max(-l, 0) * wt;
      poles.Calm += Math.max(m, 0) * wt; poles.Intense += Math.max(-m, 0) * wt;
      for (const g of i.movie.genres) genreCount[g] = (genreCount[g] || 0) + wt;
      const d = `${Math.floor(i.movie.year / 10) * 10}s`;
      decadeCount[d] = (decadeCount[d] || 0) + 1;
    }
    const radar = Object.entries(poles).map(([axis, v]) => ({ axis, value: Math.round((v / tot) * 100) }));
    const genres = Object.entries(genreCount).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, value]) => ({ name, value: Math.round(value * 10) / 10 }));
    const decades = Object.entries(decadeCount).sort((a, b) => parseInt(a[0]) - parseInt(b[0])).map(([name, count]) => ({ name, count }));
    const dominant = radar.reduce((a, b) => (b.value > a.value ? b : a));
    return { radar, genres, decades, dominant, count: positives.length };
  }, [libItems]);

  if (!data) {
    return (
      <div className="text-center py-20 text-zinc-500">
        <Dna className="w-10 h-10 mx-auto mb-3 opacity-40" />
        <p className="text-sm max-w-sm mx-auto">Your Taste DNA needs at least 3 movies in your library (rated 3★+ or tracked). Add a few favorites and come back.</p>
        <Button onClick={onBrowse} className="mt-4 bg-violet-600 hover:bg-violet-500">Browse Movies</Button>
      </div>
    );
  }

  const persona = PERSONAS[data.dominant.axis];
  const topGenres = data.genres.slice(0, 2).map((g) => g.name).join(' & ');

  return (
    <div>
      <div className="rounded-2xl p-6 md:p-8 mb-8 ring-1 ring-violet-500/25 bg-gradient-to-r from-violet-950/50 via-fuchsia-950/30 to-transparent" data-testid="dna-persona">
        <p className="text-xs uppercase tracking-widest text-violet-400 font-semibold mb-2">Your Taste Persona · from {data.count} titles</p>
        <h2 className="text-2xl md:text-4xl font-bold font-display text-transparent bg-clip-text bg-gradient-to-r from-violet-300 to-fuchsia-300">{persona.name}</h2>
        <p className="text-zinc-400 text-sm mt-2 max-w-xl">{persona.desc}</p>
        <p className="text-zinc-300 text-sm mt-3">Signature blend: <span className="text-fuchsia-300 font-semibold">{topGenres}</span> · leans <span className="text-violet-300 font-semibold">{data.dominant.axis.toLowerCase()}</span> ({data.dominant.value}%)</p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="bg-white/[0.03] rounded-2xl p-5 ring-1 ring-white/8">
          <p className="text-xs uppercase tracking-widest text-zinc-500 font-semibold mb-2">Mood Profile</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={data.radar} outerRadius="72%">
                <PolarGrid stroke="rgba(255,255,255,0.1)" />
                <PolarAngleAxis dataKey="axis" tick={{ fill: '#a1a1aa', fontSize: 11 }} />
                <Radar dataKey="value" stroke="#a78bfa" fill="#8b5cf6" fillOpacity={0.45} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-white/[0.03] rounded-2xl p-5 ring-1 ring-white/8">
          <p className="text-xs uppercase tracking-widest text-zinc-500 font-semibold mb-2">Genre Distribution</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data.genres} dataKey="value" nameKey="name" innerRadius="45%" outerRadius="75%" paddingAngle={3} stroke="none">
                  {data.genres.map((g, i) => <Cell key={g.name} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <ReTooltip contentStyle={{ background: '#18181b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
            {data.genres.slice(0, 6).map((g, i) => (
              <span key={g.name} className="flex items-center gap-1 text-[11px] text-zinc-400">
                <span className="w-2 h-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} /> {g.name}
              </span>
            ))}
          </div>
        </div>
        <div className="bg-white/[0.03] rounded-2xl p-5 ring-1 ring-white/8">
          <p className="text-xs uppercase tracking-widest text-zinc-500 font-semibold mb-2">Decade Affinity</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.decades}>
                <XAxis dataKey="name" tick={{ fill: '#a1a1aa', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fill: '#71717a', fontSize: 10 }} axisLine={false} tickLine={false} width={24} />
                <ReTooltip cursor={{ fill: 'rgba(255,255,255,0.04)' }} contentStyle={{ background: '#18181b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="count" fill="#c084fc" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

// ---------- Detail Modal ----------
const MovieModal = ({ movie, onClose, libEntry, onSetStatus, onSetRating, onToggleLike, onRemove, onOpen, libMap, onQuickAdd }) => {
  const [detail, setDetail] = useState(null);
  const [meta, setMeta] = useState(null);
  const [showTrailer, setShowTrailer] = useState(false);

  useEffect(() => {
    setDetail(null); setMeta(null); setShowTrailer(false);
    fetch(`/api/movies/${movie.id}`).then((r) => r.json()).then(setDetail).catch(() => {});
    fetch(`/api/movies/${movie.id}/metadata?region=ZA`).then((r) => r.json()).then(setMeta).catch(() => setMeta({ tmdbEnabled: false }));
  }, [movie.id]);

  // Lock the page behind the modal so only the modal scrolls.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  const trailerQuery = encodeURIComponent(`${movie.title} ${movie.year} official trailer`);
  const trailerSrc = meta?.trailerKey
    ? `https://www.youtube.com/embed/${meta.trailerKey}?autoplay=1`
    : `https://www.youtube.com/embed?listType=search&list=${trailerQuery}&autoplay=1`;
  const realProviders = meta?.tmdbEnabled && meta?.providers ? meta.providers : null;
  const CATEGORY_LABELS = { stream: 'Stream', rent: 'Rent', buy: 'Buy' };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" data-testid="movie-modal">
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      {/* Centering lives on this inner wrapper (min-h-full), NOT on the scroll
          container — otherwise a modal taller than the viewport gets its top
          pushed off-screen with no way to scroll up to it. */}
      <div className="flex min-h-full items-start md:items-center justify-center p-0 md:p-6">
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
                <button
                  onClick={() => onToggleLike(movie)}
                  data-testid="like-btn"
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition ${libEntry?.liked ? 'text-rose-300 border-rose-500/50 bg-rose-500/10 ring-1 ring-current' : 'border-zinc-700 text-zinc-400 hover:border-rose-500/50 hover:text-rose-300'}`}
                >
                  <Heart className={`w-3.5 h-3.5 ${libEntry?.liked ? 'fill-rose-400 text-rose-400' : ''}`} /> {libEntry?.liked ? 'Loved' : 'Love'}
                </button>
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
                            <a
                              key={`${p.providerId}-${cat}`}
                              href={p.url || searchLink(p.name, movie.title, movie.year)}
                              target="_blank" rel="noopener noreferrer"
                              title={p.linkType === 'exact' ? `Open ${movie.title} on ${p.name}` : `Search ${movie.title} on ${p.name}`}
                              data-testid={`provider-link-${p.providerId}`}
                              className="flex items-center gap-1.5 pl-1 pr-2 py-1 rounded-lg bg-white/5 border border-white/10 text-xs font-medium hover:border-violet-500/60 hover:bg-violet-500/10 transition group/prov"
                            >
                              {p.logoUrl && <img src={p.logoUrl} alt={p.name} className="w-5 h-5 rounded" />}
                              {p.name}
                              <ExternalLink className="w-3 h-3 text-zinc-600 group-hover/prov:text-violet-300 transition" />
                            </a>
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
                      <a
                        key={p}
                        href={searchLink(p, movie.title, movie.year)}
                        target="_blank" rel="noopener noreferrer"
                        title={`Search ${movie.title} on ${p}`}
                        className={`flex items-center gap-1.5 px-3 py-1 rounded-lg border text-xs font-semibold hover:brightness-125 transition ${PROVIDER_COLORS[p] || 'bg-zinc-800 text-zinc-300 border-zinc-700'}`}
                      >
                        {p} <ExternalLink className="w-3 h-3 opacity-60" />
                      </a>
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
  const [user, setUser] = useState(undefined); // undefined = checking, null = signed out
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

  // Who am I? (session cookie -> user)
  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((d) => setUser(d.user || null))
      .catch(() => setUser(null));
  }, []);

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

  // Session cookie identifies the user — no userId params anywhere.
  const loadLibrary = useCallback(async () => {
    try {
      const res = await fetch('/api/library');
      if (!res.ok) return;
      const data = await res.json();
      setLibItems(data.items || []);
    } catch (e) {}
  }, []);

  const loadForYou = useCallback(async () => {
    try {
      const res = await fetch('/api/recommendations/foryou');
      setForYou(await res.json());
    } catch (e) {}
  }, []);

  useEffect(() => { if (user) loadMovies(); }, [user, loadMovies]);

  // On sign-in: merge any pre-auth localStorage library into the account, then load.
  useEffect(() => {
    if (!user) return;
    (async () => {
      const legacy = getLegacyUserId();
      if (legacy) {
        try {
          const res = await fetch('/api/library/migrate', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ legacyUserId: legacy }),
          });
          const d = await res.json();
          localStorage.removeItem('tc_user_id');
          if (d.migrated > 0) toast.success(`Restored ${d.migrated} movie${d.migrated === 1 ? '' : 's'} from your previous library`);
        } catch (e) {}
      }
      loadLibrary();
      loadForYou();
    })();
  }, [user, loadLibrary, loadForYou]);

  const signOut = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
    setLibItems([]);
    setForYou({ profileBased: false, results: [] });
    setView('home');
  };

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
      : [{ movieId: movie.id, status, updatedAt: now, addedAt: now, movie }, ...libItems];
    setLibItems(updated);
    try {
      const res = await fetch('/api/library', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ movieId: movie.id, status }) });
      if (!res.ok) throw new Error();
      toast.success(`${movie.title} → ${STATUS_META[status].label}`);
      loadForYou();
    } catch (e) { setLibItems(prev); toast.error('Failed to update library'); }
  };

  const setRating = async (movie, rating) => {
    const now = new Date().toISOString();
    const existing = libMap[movie.id];
    const updated = existing
      ? libItems.map((i) => (i.movieId === movie.id ? { ...i, rating, updatedAt: now } : i))
      : [{ movieId: movie.id, status: 'watched', rating, updatedAt: now, addedAt: now, movie }, ...libItems];
    setLibItems(updated);
    try {
      await fetch('/api/library', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ movieId: movie.id, rating, ...(existing ? {} : { status: 'watched' }) }) });
      toast.success(`Rated ${movie.title} ${rating}★`);
      loadForYou();
    } catch (e) { toast.error('Failed to save rating'); }
  };

  const toggleLike = async (movie) => {
    const prev = libItems;
    const now = new Date().toISOString();
    const existing = libMap[movie.id];
    const liked = !existing?.liked;
    const updated = existing
      ? libItems.map((i) => (i.movieId === movie.id ? { ...i, liked, updatedAt: now } : i))
      : [{ movieId: movie.id, status: 'want_to_watch', liked, updatedAt: now, addedAt: now, movie }, ...libItems];
    setLibItems(updated);
    try {
      const res = await fetch('/api/library', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ movieId: movie.id, liked }) });
      if (!res.ok) throw new Error();
      toast.success(liked ? `❤️ Loved ${movie.title}` : `Removed love from ${movie.title}`);
      loadForYou();
    } catch (e) { setLibItems(prev); toast.error('Failed to update'); }
  };

  const removeFromLib = async (movie) => {
    setLibItems(libItems.filter((i) => i.movieId !== movie.id));
    try {
      await fetch(`/api/library/${movie.id}`, { method: 'DELETE' });
      toast.success(`Removed ${movie.title} from library`);
      loadForYou();
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

  // ---------- Auth gate ----------
  if (user === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-7 h-7 animate-spin text-violet-500" />
      </div>
    );
  }
  if (user === null) {
    return (
      <>
        <Toaster theme="dark" position="bottom-right" richColors />
        <AuthScreen onAuthed={setUser} />
      </>
    );
  }

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
            <NavBtn id="map" icon={Orbit} label="Taste Map" />
            <NavBtn id="dna" icon={Dna} label="Taste DNA" />
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
          <div className="flex items-center gap-2 shrink-0">
            <div
              title={user.email}
              data-testid="user-chip"
              className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-600/60 to-fuchsia-600/60 ring-1 ring-white/15 flex items-center justify-center text-xs font-bold uppercase"
            >
              {(user.name || user.email)[0]}
            </div>
            <button
              onClick={signOut}
              title="Sign out"
              data-testid="sign-out-btn"
              className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/10 transition"
            >
              <LogOut className="w-4 h-4" />
            </button>
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

        {/* ============ TASTE MAP ============ */}
        {view === 'map' && (
          <div className="mt-8">
            <h1 className="text-2xl md:text-4xl font-bold font-display mb-1">The <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-fuchsia-400">Taste Map</span></h1>
            <p className="text-zinc-500 text-sm mb-6">Every film in the catalog, charted across the emotional plane. Calm↔Intense · Light↔Heavy.</p>
            {loading ? (
              <div className="flex justify-center py-24"><Loader2 className="w-8 h-8 animate-spin text-violet-400" /></div>
            ) : (
              <TasteMap movies={movies} libMap={libMap} onOpen={setSelected} />
            )}
          </div>
        )}

        {/* ============ TASTE DNA ============ */}
        {view === 'dna' && (
          <div className="mt-8">
            <h1 className="text-2xl md:text-4xl font-bold font-display mb-1">Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-fuchsia-400">Taste DNA</span></h1>
            <p className="text-zinc-500 text-sm mb-6">A personality profile decoded from your library and ratings.</p>
            <TasteDNA libItems={libItems} onBrowse={() => setView('home')} />
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
          onToggleLike={toggleLike}
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
