// lib/platformLinks.js
// Turns a provider name + movie into a clickable link on that platform.
//
// Two tiers:
//   1. EXACT deep links (title page on the platform) come from the Streaming
//      Availability API when STREAMING_AVAILABILITY_API_KEY is set — handled
//      in the API route and matched to providers via normalizeService().
//   2. SEARCH links (this file) always work with zero API keys: the platform's
//      own search, preloaded with the title. One click from the title page.
//      Unknown platforms fall back to a Google "watch X on Y" search.

// Canonical service keys used to match TMDB provider names to
// Streaming Availability service names (both sides get normalized).
const SERVICE_ALIASES = [
  { key: 'netflix', match: ['netflix'] },
  { key: 'prime', match: ['amazon prime', 'prime video', 'amazon video'] },
  { key: 'disney', match: ['disney'] },
  { key: 'apple', match: ['apple tv', 'apple itunes', 'itunes'] },
  { key: 'showmax', match: ['showmax'] },
  { key: 'mubi', match: ['mubi'] },
  { key: 'hbo', match: ['hbo', 'max'] },
  { key: 'paramount', match: ['paramount'] },
  { key: 'britbox', match: ['britbox'] },
  { key: 'youtube', match: ['youtube'] },
  { key: 'google', match: ['google play'] },
  { key: 'rakuten', match: ['rakuten'] },
  { key: 'curiosity', match: ['curiosity'] },
];

export function normalizeService(name) {
  const n = String(name || '').toLowerCase();
  for (const { key, match } of SERVICE_ALIASES) {
    if (match.some((m) => n.includes(m))) return key;
  }
  return n.replace(/[^a-z0-9]+/g, '-');
}

// Search-URL templates. Only platforms whose search URL format is stable and
// well known are listed; anything else uses the Google fallback below.
const SEARCH_TEMPLATES = {
  netflix: (q) => `https://www.netflix.com/search?q=${q}`,
  prime: (q) => `https://www.primevideo.com/search?phrase=${q}`,
  disney: (q) => `https://www.disneyplus.com/search?q=${q}`,
  apple: (q) => `https://tv.apple.com/search?term=${q}`,
  mubi: (q) => `https://mubi.com/en/search/films?query=${q}`,
  youtube: (q) => `https://www.youtube.com/results?search_query=${q}`,
  google: (q) => `https://play.google.com/store/search?q=${q}&c=movies`,
};

/** A link that lands the user on (or one click from) the movie on a platform. */
export function searchLink(providerName, movieTitle, year) {
  const q = encodeURIComponent(year ? `${movieTitle} ${year}` : movieTitle);
  const key = normalizeService(providerName);
  const template = SEARCH_TEMPLATES[key];
  if (template) return template(encodeURIComponent(movieTitle));
  // Fallback that works for every platform (Showmax, BritBox, regional
  // services...): a Google search scoped to watching it on that provider.
  return `https://www.google.com/search?q=${encodeURIComponent(`watch "${movieTitle}"${year ? ` ${year}` : ''} on ${providerName}`)}`;
}
