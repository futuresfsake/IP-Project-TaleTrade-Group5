/* eslint-env node */
const express = require('express');
const { ApiError } = require('./errors');
const { createAuthMiddleware } = require('./auth');
const { createRateLimiter } = require('./rateLimit');
const { createService } = require('./service');
const { parseCoords, parseFeedQuery } = require('./validation');
const { ApiError: HttpError } = require('./errors');
const { badRequest } = require('./errors');

const TYPES = ['mall', 'library', 'bookstore', 'cafe', 'campus', 'other'];

const wrap = handler => (req, res, next) => Promise.resolve(handler(req, res)).catch(next);

/**
 * Builds the Express app. Dependencies are injected:
 *   store         - data layer (firestoreStore in production, memoryStore in tests)
 *   bookProvider  - { getBook(id) } upstream book metadata
 *   verifyToken   - (idToken) => Promise<{ uid }>; Firebase Admin's verifyIdToken in production
 */
const createApp = ({ store, bookProvider, placeProvider, verifyToken, now = Date.now, rateLimit = {} }) => {
  const service = createService({ store, bookProvider, now });
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '10kb' }));

  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  const v1 = express.Router();
  v1.use(createRateLimiter({ now, ...rateLimit })); // coarse per-IP guard before auth work
  v1.use(createAuthMiddleware(verifyToken));
  v1.use(createRateLimiter({ now, ...rateLimit })); // per-user guard once the uid is known

  // ---- Locations
  v1.get('/spots', wrap(async (req, res) => {
    const type = req.query.type;
    if (type !== undefined && !TYPES.includes(type)) throw badRequest(`type must be one of: ${TYPES.join(', ')}.`);
    res.json({ items: await service.listSpots({ coords: parseCoords(req.query), type }) });
  }));

  v1.get('/spots/:id', wrap(async (req, res) => {
    res.json(await service.getSpot(req.params.id, { uid: req.user.uid, coords: parseCoords(req.query) }));
  }));

  /** Name of the place at a coordinate (used for pins dropped on the map). */
  v1.get('/places/reverse', wrap(async (req, res) => {
    const coords = parseCoords(req.query);
    if (!coords) throw badRequest('Send lat and lng.');
    if (!placeProvider || !placeProvider.configured) {
      throw new HttpError(503, 'places_unavailable', 'Place names are not configured on this server.');
    }
    let place;
    try {
      place = await placeProvider.reverse(coords);
    } catch {
      throw new HttpError(502, 'place_provider_unavailable', 'Place names are temporarily unavailable.');
    }
    if (!place) throw new HttpError(404, 'place_not_found', 'No known place there.');
    res.json(place);
  }));

  // ---- Readers
  v1.get('/users/:id/listings', wrap(async (req, res) => {
    res.json({ items: await service.userListings(req.user.uid, req.params.id, { coords: parseCoords(req.query) }) });
  }));

  /** Who has which book, and where. Search badges and Book Detail both read this. */
  v1.get('/availability', wrap(async (_req, res) => {
    res.json(await service.availability());
  }));

  // ---- Books
  v1.get('/books/:id', wrap(async (req, res) => {
    res.json(await service.getBook(req.params.id, { uid: req.user.uid, coords: parseCoords(req.query) }));
  }));

  // ---- Feed
  v1.get('/feed', wrap(async (req, res) => {
    res.json(await service.feed(req.user.uid, parseFeedQuery(req.query)));
  }));

  v1.get('/me/listings', wrap(async (req, res) => {
    res.json(await service.myListings(req.user.uid, { coords: parseCoords(req.query) }));
  }));

  v1.get('/me/books', wrap(async (req, res) => {
    res.json({ items: await service.myBooks(req.user.uid) });
  }));

  v1.post('/listings', wrap(async (req, res) => {
    res.status(201).json(await service.createListing(req.user.uid, req.body));
  }));

  v1.patch('/listings/:id', wrap(async (req, res) => {
    res.json(await service.updateListing(req.user.uid, req.params.id, req.body));
  }));

  v1.delete('/listings/:id', wrap(async (req, res) => {
    await service.deleteListing(req.user.uid, req.params.id);
    res.status(204).end();
  }));

  app.use('/v1', v1);

  app.use((_req, res) => res.status(404).json({ error: { code: 'not_found', message: 'Unknown endpoint.' } }));

  app.use((err, _req, res, _next) => {
    if (err instanceof ApiError) {
      return res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
    }
    if (err && err.type === 'entity.parse.failed') {
      return res.status(400).json({ error: { code: 'invalid_request', message: 'Body must be valid JSON.' } });
    }
    if (err && err.type === 'entity.too.large') {
      return res.status(413).json({ error: { code: 'payload_too_large', message: 'Request body is too large.' } });
    }
    console.error('Unhandled API error:', err && err.message);
    return res.status(500).json({ error: { code: 'internal_error', message: 'Something went wrong.' } });
  });

  return app;
};

module.exports = { createApp };
