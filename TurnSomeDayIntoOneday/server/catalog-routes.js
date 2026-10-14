'use strict';

const catalog = require('./catalog');

function mount(app, options) {
  const o = options || {};
  const limiter = o.limiter || ((req, res, next) => next());
  const authorize = o.authorize || ((req, res, next) => next());
  const searchMusic = o.searchMusic || catalog.searchMusic;
  const searchMovies = o.searchMovies || catalog.searchMovies;
  const searchTv = o.searchTv || catalog.searchTv;
  const browseMovies = o.browseMovies || catalog.browseMovies;
  const browseTv = o.browseTv || catalog.browseTv;
  const getMovieProviders = o.getMovieProviders || catalog.getMovieProviders;
  const getTvProviders = o.getTvProviders || catalog.getTvProviders;
  const tmdbToken = o.tmdbToken;

  function route(search, readInput) {
    return async (req, res) => {
      res.set('Cache-Control', 'no-store');
      try {
        const result = await search.apply(null, readInput(req));
        if (result.error) return res.status(400).json(result);
        return res.json(result);
      } catch (error) {
        if (error && error.code === 'TMDB_NOT_CONFIGURED') {
          return res.status(503).json({ error: error.message });
        }
        return res.status(502).json({ error: 'Catalog search is unavailable right now. Try again shortly.' });
      }
    };
  }

  app.get('/api/catalog/music', limiter, authorize, route(searchMusic, (req) => [req.query && req.query.term]));
  app.get('/api/catalog/movies', limiter, authorize, route(
    (term, unused, page) => searchMovies(term, undefined, page, tmdbToken),
    (req) => [req.query && req.query.term, undefined, req.query && req.query.page],
  ));
  app.get('/api/catalog/tv', limiter, authorize, route(
    (term, unused, page) => searchTv(term, undefined, page, tmdbToken),
    (req) => [req.query && req.query.term, undefined, req.query && req.query.page],
  ));
  app.get('/api/catalog/browse/:type', limiter, authorize, route(
    (type, page) => {
      if (type !== 'tv' && type !== 'movies') return Promise.resolve({ error: 'Choose movies or series.' });
      return type === 'tv' ? browseTv(undefined, page, tmdbToken) : browseMovies(undefined, page, tmdbToken);
    },
    (req) => [req.params && req.params.type, req.query && req.query.page],
  ));
  app.get('/api/catalog/movies/:id/providers', limiter, authorize, route(
    (id) => getMovieProviders(id, undefined, tmdbToken),
    (req) => [req.params && req.params.id],
  ));
  app.get('/api/catalog/tv/:id/providers', limiter, authorize, route(
    (id) => getTvProviders(id, undefined, tmdbToken),
    (req) => [req.params && req.params.id],
  ));
}

module.exports = { mount };
