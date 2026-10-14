'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const catalogRoutes = require('../catalog-routes');

let server;
let base;
before(async () => {
  const app = express();
  app.set('trust proxy', 1);
  catalogRoutes.mount(app, {
    authorize(req, res, next) {
      if (req.get('x-test-auth') !== 'allowed') return res.status(401).json({ error: 'Not signed in.' });
      next();
    },
    searchMusic: async (term) => ({ results: [{ title: 'Test track', term }] }),
    searchMovies: async (term, unused, page) => {
      if (term === 'provider failure') throw new Error('private upstream detail');
      return term ? { results: [{ title: 'Test film', term }], page: Number(page) || 1, totalPages: 3, totalResults: 61 } : { error: 'Enter a movie title.' };
    },
    searchTv: async (term, unused, page) => ({ results: [{ id: 321, title: 'Test series', term, kind: 'tv' }], page: Number(page) || 1, totalPages: 1, totalResults: 1 }),
    browseMovies: async (unused, page) => ({ results: [{ id: 123, title: 'Popular film' }], page: Number(page) || 1, totalPages: 1, totalResults: 1 }),
    browseTv: async (unused, page) => ({ results: [{ id: 321, title: 'Popular series' }], page: Number(page) || 1, totalPages: 1, totalResults: 1 }),
    getMovieProviders: async (id) => ({ region: 'US', groups: [{ label: 'Subscription', providers: ['Test Video'] }], url: 'https://www.themoviedb.org/movie/' + id + '/watch?locale=US' }),
    getTvProviders: async (id) => ({ region: 'US', groups: [{ label: 'Subscription', providers: ['Test Series Video'] }], url: 'https://www.themoviedb.org/tv/' + id + '/watch?locale=US' }),
    tmdbToken: 'unit-test-token',
  });
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server && server.close());

test('both catalog endpoints require authorization before querying providers', async () => {
  for (const route of [
    '/api/catalog/music?term=track',
    '/api/catalog/movies?term=film',
    '/api/catalog/tv?term=series',
    '/api/catalog/browse/movies',
    '/api/catalog/tv/603/providers',
    '/api/catalog/movies/603/providers',
  ]) {
    const response = await fetch(base + route);
    assert.equal(response.status, 401, route);
    assert.deepEqual(await response.json(), { error: 'Not signed in.' });
  }
});

test('authorized music and movie searches return JSON without shared caching', async () => {
  for (const [route, title] of [['music', 'Test track'], ['movies', 'Test film']]) {
    const response = await fetch(`${base}/api/catalog/${route}?term=sample`, {
      headers: { 'x-test-auth': 'allowed' },
    });
    assert.equal(response.status, 200, route);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const body = await response.json();
    if (route === 'movies') {
      assert.deepEqual(body, { results: [{ title, term: 'sample' }], page: 1, totalPages: 3, totalResults: 61 });
    } else assert.deepEqual(body, { results: [{ title, term: 'sample' }] });
  }
});

test('empty input is a client error, and upstream errors are generic', async () => {
  const headers = { 'x-test-auth': 'allowed' };
  const empty = await fetch(`${base}/api/catalog/movies`, { headers });
  assert.equal(empty.status, 400);
  assert.deepEqual(await empty.json(), { error: 'Enter a movie title.' });

  const failed = await fetch(`${base}/api/catalog/movies?term=provider%20failure`, { headers });
  assert.equal(failed.status, 502);
  assert.deepEqual(await failed.json(), {
    error: 'Catalog search is unavailable right now. Try again shortly.',
  });

  const tv = await fetch(`${base}/api/catalog/tv?term=series&page=2`, { headers });
  assert.equal(tv.status, 200);
  assert.deepEqual(await tv.json(), { results: [{ id: 321, title: 'Test series', term: 'series', kind: 'tv' }], page: 2, totalPages: 1, totalResults: 1 });

  const popular = await fetch(`${base}/api/catalog/browse/movies?page=1`, { headers });
  assert.equal(popular.status, 200);
  assert.deepEqual(await popular.json(), { results: [{ id: 123, title: 'Popular film' }], page: 1, totalPages: 1, totalResults: 1 });

  const invalidBrowse = await fetch(`${base}/api/catalog/browse/other`, { headers });
  assert.equal(invalidBrowse.status, 400);
  assert.deepEqual(await invalidBrowse.json(), { error: 'Choose movies or series.' });

  const seriesProviders = await fetch(`${base}/api/catalog/tv/321/providers`, { headers });
  assert.equal(seriesProviders.status, 200);
  assert.deepEqual(await seriesProviders.json(), {
    region: 'US', groups: [{ label: 'Subscription', providers: ['Test Series Video'] }],
    url: 'https://www.themoviedb.org/tv/321/watch?locale=US',
  });

  const providers = await fetch(`${base}/api/catalog/movies/123/providers`, { headers });
  assert.equal(providers.status, 200);
  assert.deepEqual(await providers.json(), {
    region: 'US', groups: [{ label: 'Subscription', providers: ['Test Video'] }],
    url: 'https://www.themoviedb.org/movie/123/watch?locale=US',
  });
});
