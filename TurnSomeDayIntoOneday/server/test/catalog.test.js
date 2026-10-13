'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { cleanTerm, searchMusic, searchMovies, searchTv, browseMovies, browseTv, getMovieProviders, getTvProviders, safeTmdbUrl } = require('../catalog');

const PAGE = fs.readFileSync(path.join(__dirname, '..', '..', 'music.html'), 'utf8');

function jsonResponse(body, ok) {
  return { ok: ok !== false, json: async () => body };
}

test('catalog terms are trimmed and bounded before they reach providers', () => {
  assert.equal(cleanTerm('  Moonlight  '), 'Moonlight');
  assert.equal(cleanTerm('x'.repeat(150)).length, 100);
  assert.equal(cleanTerm('   '), '');
});

test('music search maps Apple results and rejects untrusted outbound URLs', async () => {
  let requested;
  const result = await searchMusic('  Blue Train ', async (url, options) => {
    requested = { url: new URL(url), options };
    return jsonResponse({ results: [
      { trackName: 'Blue Train', artistName: 'John Coltrane', collectionName: 'Blue Train', releaseDate: '1957-09-15T00:00:00Z', trackViewUrl: 'https://music.apple.com/us/album/blue-train/1' },
      { trackName: 'Injected', trackViewUrl: 'javascript:alert(1)' },
      { trackName: 'Misleading host', trackViewUrl: 'https://music.apple.com.attacker.example/track/2' },
      { trackName: 'Credential URL', trackViewUrl: 'https://attacker@music.apple.com/track/3' },
    ] });
  });

  assert.equal(requested.url.origin + requested.url.pathname, 'https://itunes.apple.com/search');
  assert.equal(requested.url.searchParams.get('term'), 'Blue Train');
  assert.equal(requested.url.searchParams.get('media'), 'music');
  assert.equal(requested.url.searchParams.get('entity'), 'song');
  assert.equal(requested.url.searchParams.get('limit'), '24');
  assert.ok(requested.options.signal, 'provider requests have a timeout signal');
  assert.equal(result.results.length, 1);
  assert.deepEqual(result.results[0], {
    title: 'Blue Train', detail: 'John Coltrane · Blue Train', year: '1957',
    source: 'Apple Music', url: 'https://music.apple.com/us/album/blue-train/1',
  });
});

test('movie search uses TMDb, filters adult results, and paginates broad movie matches', async () => {
  let requested;
  const result = await searchMovies('The Matrix & More', async (url, options) => {
    requested = { url: new URL(url), options };
    return jsonResponse({
      total_pages: 620,
      total_results: 12345,
      results: [
        { id: 603, title: 'The Matrix', original_title: 'The Matrix', overview: 'A science fiction action film.', release_date: '1999-03-30', adult: false },
        { id: 'javascript:alert(1)', title: 'Bad identifier' },
        { id: 604, title: '', original_title: '' },
      ],
    });
  }, 700, 'unit-test-token');

  assert.equal(requested.url.origin + requested.url.pathname, 'https://api.themoviedb.org/3/search/movie');
  assert.equal(requested.url.searchParams.get('query'), 'The Matrix & More');
  assert.equal(requested.url.searchParams.get('include_adult'), 'false');
  assert.equal(requested.url.searchParams.get('language'), 'en-US');
  assert.equal(requested.url.searchParams.get('page'), '500', 'pages stay within the provider maximum');
  assert.equal(requested.options.headers.Authorization, 'Bearer unit-test-token');
  assert.ok(requested.options.signal, 'provider requests have a timeout signal');
  assert.equal(result.page, 500);
  assert.equal(result.totalPages, 500);
  assert.equal(result.totalResults, 12345);
  assert.equal(result.results.length, 1);
  assert.deepEqual(result.results[0], {
    id: 603,
    title: 'The Matrix',
    detail: 'A science fiction action film.',
    year: '1999',
    source: 'TMDb',
    posterUrl: '',
    url: 'https://www.themoviedb.org/movie/603',
  });
});

test('movie search reports missing credentials instead of making an unauthenticated request', async () => {
  const previous = process.env.TMDB_READ_ACCESS_TOKEN;
  delete process.env.TMDB_READ_ACCESS_TOKEN;
  try {
    await assert.rejects(() => searchMovies('The Matrix', async () => {
      throw new Error('fetch must not run');
    }), (error) => error.code === 'TMDB_NOT_CONFIGURED');
  } finally {
    if (previous === undefined) delete process.env.TMDB_READ_ACCESS_TOKEN;
    else process.env.TMDB_READ_ACCESS_TOKEN = previous;
  }
});

test('series search maps series fields, poster art, and safe TMDb detail links', async () => {
  let requested;
  const result = await searchTv('The Bear', async (url, options) => {
    requested = { url: new URL(url), options };
    return jsonResponse({ total_pages: 2, total_results: 21, results: [
      { id: 123, name: 'The Bear', overview: 'A chef returns home.', first_air_date: '2022-06-23', poster_path: '/poster.jpg' },
      { id: 124, name: 'Unsafe art', poster_path: 'https://evil.test/poster.jpg' },
    ] });
  }, 1, 'unit-test-token');
  assert.equal(requested.url.pathname, '/3/search/tv');
  assert.equal(requested.url.searchParams.get('query'), 'The Bear');
  assert.equal(requested.options.headers.Authorization, 'Bearer unit-test-token');
  assert.equal(result.results.length, 2);
  assert.deepEqual(result.results[0], {
    id: 123, title: 'The Bear', detail: 'A chef returns home.', year: '2022', source: 'TMDb',
    posterUrl: 'https://image.tmdb.org/t/p/w342/poster.jpg', url: 'https://www.themoviedb.org/tv/123',
  });
  assert.equal(result.results[1].posterUrl, '');
});

test('popular movie and series shelves call the right safe TMDb endpoints', async () => {
  for (const [browse, type, expectedPath, expectedTitle, expectedUrl] of [
    [browseMovies, 'movies', '/3/movie/popular', 'Popular film', 'https://www.themoviedb.org/movie/44'],
    [browseTv, 'tv', '/3/tv/popular', 'Popular series', 'https://www.themoviedb.org/tv/45'],
  ]) {
    let requested;
    const result = await browse(async (url, options) => {
      requested = { url: new URL(url), options };
      return jsonResponse({ results: [{ id: type === 'tv' ? 45 : 44, title: 'Popular film', name: 'Popular series' }] });
    }, 1, 'unit-test-token');
    assert.equal(requested.url.pathname, expectedPath);
    assert.equal(requested.options.headers.Authorization, 'Bearer unit-test-token');
    assert.equal(result.results[0].title, expectedTitle);
    assert.equal(result.results[0].url, expectedUrl);
  }
});

test('US series provider details use the TV listing endpoint', async () => {
  let requested;
  const result = await getTvProviders(123, async (url) => {
    requested = new URL(url);
    return jsonResponse({ results: { US: { link: 'https://www.themoviedb.org/tv/123/watch?locale=US', flatrate: [{ provider_name: 'Stream+' }] } } });
  }, 'unit-test-token');
  assert.equal(requested.pathname, '/3/tv/123/watch/providers');
  assert.equal(result.region, 'US');
  assert.equal(result.url, 'https://www.themoviedb.org/tv/123/watch?locale=US');
  assert.deepEqual(result.groups, [{ label: 'Subscription', providers: ['Stream+'] }]);
});

test('US provider results identify subscription, free, ads, rental and purchase options', async () => {
  let requested;
  const result = await getMovieProviders(603, async (url, options) => {
    requested = { url: new URL(url), options };
    return jsonResponse({ results: { US: {
      link: 'https://www.themoviedb.org/movie/603/watch?locale=US',
      flatrate: [{ provider_name: 'Stream+ ' }],
      free: [{ provider_name: 'FreeTV' }],
      ads: [{ provider_name: 'AdVideo' }],
      rent: [{ provider_name: 'Rent Store' }],
      buy: [{ provider_name: 'Buy Store' }],
      unknown: [{ provider_name: 'Do not show' }],
    } } });
  }, 'unit-test-token');

  assert.equal(requested.url.pathname, '/3/movie/603/watch/providers');
  assert.equal(requested.options.headers.Authorization, 'Bearer unit-test-token');
  assert.deepEqual(result, {
    region: 'US',
    groups: [
      { label: 'Subscription', providers: ['Stream+'] },
      { label: 'Free', providers: ['FreeTV'] },
      { label: 'Free with ads', providers: ['AdVideo'] },
      { label: 'Rent', providers: ['Rent Store'] },
      { label: 'Buy', providers: ['Buy Store'] },
    ],
    url: 'https://www.themoviedb.org/movie/603/watch?locale=US',
  });
});

test('invalid movie IDs and foreign watch-provider links are rejected', async () => {
  let called = false;
  assert.deepEqual(await getMovieProviders('NaN', async () => { called = true; }, 'unit-test-token'), { error: 'Choose a valid title first.' });
  assert.equal(called, false);
  const fallback = 'https://www.themoviedb.org/movie/603/watch?locale=US';
  assert.equal(safeTmdbUrl('javascript:alert(1)', fallback), fallback);
  assert.equal(safeTmdbUrl('https://themoviedb.org/movie/603/watch', fallback), 'https://themoviedb.org/movie/603/watch');
  assert.equal(safeTmdbUrl('https://themoviedb.org.attacker.example/watch', fallback), fallback);
});

test('empty searches stop before calling an external catalog', async () => {
  let calls = 0;
  const fetcher = async () => { calls += 1; return jsonResponse({}); };
  assert.deepEqual(await searchMusic('  ', fetcher), { error: 'Enter an artist, song, or album name.' });
  assert.deepEqual(await searchMovies('', fetcher, 1, 'unit-test-token'), { error: 'Enter a movie title.' });
  assert.deepEqual(await searchTv('', fetcher, 1, 'unit-test-token'), { error: 'Enter a series title.' });
  assert.equal(calls, 0);
});

test('provider HTTP failures are surfaced to the route rather than treated as no matches', async () => {
  await assert.rejects(() => searchMusic('anything', async () => jsonResponse({}, false)), /catalog unavailable/i);
  await assert.rejects(() => searchMovies('anything', async () => jsonResponse({}, false), 1, 'unit-test-token'), /catalog unavailable/i);
  await assert.rejects(() => getMovieProviders(603, async () => jsonResponse({}, false), 'unit-test-token'), /catalog unavailable/i);
  await assert.rejects(() => searchTv('anything', async () => jsonResponse({}, false), 1, 'unit-test-token'), /catalog unavailable/i);
  await assert.rejects(() => browseMovies(async () => jsonResponse({}, false), 1, 'unit-test-token'), /catalog unavailable/i);
});

test('Music presents broad US movie search and legal provider controls safely', () => {
  assert.match(PAGE, /id="tab-discover"[^>]*>Discover<\/button>/);
  assert.match(PAGE, /id="panel-discover"[^>]*hidden/);
  assert.match(PAGE, /id="catalogType"/);
  assert.match(PAGE, /value="tv">Series/);
  assert.match(PAGE, /id="catalogTerm" maxlength="100"/);
  assert.match(PAGE, /fetch\('\/api\/catalog\/'/);
  assert.match(PAGE, /\/providers/);
  assert.match(PAGE, /showSavedTitles\.addEventListener/);
  assert.match(PAGE, /browsePopular\(\)/);
  assert.match(PAGE, /poster\.loading = 'lazy'/);
  assert.match(PAGE, /movieNext\.addEventListener\('click'/);
  assert.match(PAGE, /main\.rel = 'noopener noreferrer'/);
  assert.match(PAGE, /link\.rel = 'noopener noreferrer'/);
  assert.match(PAGE, /node\.textContent = text/);
  assert.match(PAGE, /TMDb terms and attribution/);
  assert.match(PAGE, /not endorsed or certified by TMDb/);
  assert.doesNotMatch(PAGE, /catalogResults\.innerHTML\s*=/);
});
