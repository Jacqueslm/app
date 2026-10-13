'use strict';

const MUSIC_API = 'https://itunes.apple.com/search';
const TMDB_API = 'https://api.themoviedb.org/3';
const TMDB_SITE = 'https://www.themoviedb.org';
const MAX_TERM_LENGTH = 100;
const MAX_MOVIE_PAGE = 500;

function cleanTerm(value) {
  return String(value || '').trim().slice(0, MAX_TERM_LENGTH);
}

function appleMusicUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port
      || !['music.apple.com', 'itunes.apple.com'].includes(url.hostname)) return '';
    return url.toString();
  } catch (_) {
    return '';
  }
}

async function searchMusic(value, fetcher) {
  const term = cleanTerm(value);
  if (!term) return { error: 'Enter an artist, song, or album name.' };
  const url = new URL(MUSIC_API);
  url.search = new URLSearchParams({ term, country: 'us', media: 'music', entity: 'song', limit: '24' });
  const response = await (fetcher || fetch)(url, { signal: AbortSignal.timeout(7000) });
  if (!response.ok) throw new Error('Music catalog unavailable');
  const data = await response.json();
  const results = (Array.isArray(data.results) ? data.results : []).map((item) => ({
    title: String(item.trackName || 'Untitled track'),
    detail: [item.artistName, item.collectionName].filter(Boolean).map(String).join(' · '),
    year: String(item.releaseDate || '').slice(0, 4),
    source: 'Apple Music',
    url: appleMusicUrl(item.trackViewUrl),
  })).filter((item) => item.url);
  return { results };
}

function tmdbToken(value) {
  const token = String(value || process.env.TMDB_READ_ACCESS_TOKEN || '').trim();
  if (!token) {
    const error = new Error('Movie search is not configured. Add TMDB_READ_ACCESS_TOKEN in Settings → Environment.');
    error.code = 'TMDB_NOT_CONFIGURED';
    throw error;
  }
  return token;
}

async function tmdbGet(pathname, params, fetcher, token) {
  const url = new URL(TMDB_API + pathname);
  url.search = new URLSearchParams(params || {});
  const response = await (fetcher || fetch)(url, {
    headers: { Accept: 'application/json', Authorization: 'Bearer ' + tmdbToken(token) },
    signal: AbortSignal.timeout(7000),
  });
  if (!response.ok) throw new Error('Movie catalog unavailable');
  return response.json();
}

function safeTmdbUrl(value, fallback) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port
      || !['www.themoviedb.org', 'themoviedb.org'].includes(url.hostname)) return fallback;
    return url.toString();
  } catch (_) {
    return fallback;
  }
}

function tmdbResults(data, type) {
  const isTv = type === 'tv';
  const results = (Array.isArray(data.results) ? data.results : []).map((item) => {
    const id = Number(item.id);
    const title = String((isTv ? (item.name || item.original_name) : (item.title || item.original_title)) || '').trim();
    if (!Number.isSafeInteger(id) || id < 1 || !title) return null;
    const posterPath = String(item.poster_path || '');
    const posterUrl = posterPath.startsWith('/') && !posterPath.includes('..')
      ? 'https://image.tmdb.org/t/p/w342' + posterPath : '';
    return {
      id, title,
      detail: String(item.overview || (isTv ? 'Series listing in TMDb' : 'Movie listing in TMDb')).trim(),
      year: String((isTv ? item.first_air_date : item.release_date) || '').slice(0, 4),
      source: 'TMDb',
      posterUrl,
      url: TMDB_SITE + '/' + (isTv ? 'tv/' : 'movie/') + id,
    };
  }).filter(Boolean);
  return {
    results,
    totalPages: Math.max(1, Math.min(MAX_MOVIE_PAGE, Number(data.total_pages) || 1)),
    totalResults: Number(data.total_results) || results.length,
  };
}

function requestedPage(page) {
  return Math.max(1, Math.min(MAX_MOVIE_PAGE, Math.floor(Number(page) || 1)));
}

async function searchTitles(type, value, fetcher, page, token) {
  const isTv = type === 'tv';
  const term = cleanTerm(value);
  if (!term) return { error: isTv ? 'Enter a series title.' : 'Enter a movie title.' };
  const currentPage = requestedPage(page);
  const data = await tmdbGet('/search/' + (isTv ? 'tv' : 'movie'), {
    query: term, include_adult: 'false', language: 'en-US', page: String(currentPage),
  }, fetcher, token);
  return Object.assign(tmdbResults(data, type), { page: currentPage });
}

async function searchMovies(value, fetcher, page, token) {
  return searchTitles('movies', value, fetcher, page, token);
}

async function searchTv(value, fetcher, page, token) {
  return searchTitles('tv', value, fetcher, page, token);
}

async function browseTitles(type, fetcher, page, token) {
  const isTv = type === 'tv';
  const currentPage = requestedPage(page);
  const data = await tmdbGet('/' + (isTv ? 'tv' : 'movie') + '/popular', {
    language: 'en-US', page: String(currentPage),
  }, fetcher, token);
  return Object.assign(tmdbResults(data, type), { page: currentPage });
}

async function browseMovies(fetcher, page, token) {
  return browseTitles('movies', fetcher, page, token);
}

async function browseTv(fetcher, page, token) {
  return browseTitles('tv', fetcher, page, token);
}

async function getProviders(kind, value, fetcher, token) {
  const id = String(value || '');
  if (!/^\d{1,12}$/.test(id) || Number(id) < 1) return { error: 'Choose a valid title first.' };
  const data = await tmdbGet('/' + kind + '/' + id + '/watch/providers', {}, fetcher, token);
  const country = data.results && data.results.US;
  const labels = [
    ['flatrate', 'Subscription'], ['free', 'Free'], ['ads', 'Free with ads'],
    ['rent', 'Rent'], ['buy', 'Buy'],
  ];
  const groups = labels.map(([key, label]) => ({
    label,
    providers: (country && Array.isArray(country[key]) ? country[key] : [])
      .map((provider) => String(provider.provider_name || '').trim()).filter(Boolean),
  })).filter((group) => group.providers.length);
  const fallback = TMDB_SITE + '/' + kind + '/' + id + '/watch?locale=US';
  return {
    groups,
    url: safeTmdbUrl(country && country.link, fallback),
    region: 'US',
  };
}

async function getMovieProviders(value, fetcher, token) {
  return getProviders('movie', value, fetcher, token);
}

async function getTvProviders(value, fetcher, token) {
  return getProviders('tv', value, fetcher, token);
}

module.exports = {
  cleanTerm, searchMusic, searchMovies, searchTv, browseMovies, browseTv,
  getMovieProviders, getTvProviders, safeTmdbUrl,
};
