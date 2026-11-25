/* eslint-env node */
const { badRequest } = require('./errors');

const STATUSES = ['available', 'reserved', 'unavailable'];
const CONDITIONS = ['like_new', 'good', 'fair', 'well_loved'];
const EXCHANGES = ['trade', 'lend', 'give_away'];
const FILTERS = ['all', 'available', 'nearby', 'wishlist'];
const MAX_SPOTS = 3;
const MAX_TIMES = 80;
const MAX_NOTE = 280;

const isPlainObject = v => v !== null && typeof v === 'object' && !Array.isArray(v);

const cleanText = (value, field, max) => {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') throw badRequest(`${field} must be a string.`);
  const text = value.trim().replace(/\s+/g, ' ');
  if (text.length > max) throw badRequest(`${field} must be at most ${max} characters.`);
  return text;
};

const oneOf = (value, allowed, field) => {
  if (!allowed.includes(value)) throw badRequest(`${field} must be one of: ${allowed.join(', ')}.`);
  return value;
};

const stringList = (value, field, { min, max, allowed }) => {
  if (!Array.isArray(value)) throw badRequest(`${field} must be an array.`);
  const unique = Array.from(new Set(value));
  if (unique.some(v => typeof v !== 'string' || !v)) {
    throw badRequest(`${field} must contain non-empty strings.`);
  }
  if (allowed && unique.some(v => !allowed.includes(v))) {
    throw badRequest(`${field} may only contain: ${allowed.join(', ')}.`);
  }
  if (unique.length < min || unique.length > max) {
    throw badRequest(`${field} must have between ${min} and ${max} items.`);
  }
  return unique;
};

const bookIdOf = value => {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(value)) {
    throw badRequest('bookId must be a valid book id.');
  }
  return value;
};

/** Validates a POST /v1/listings body. Returns a clean object or throws ApiError(400). */
const validateCreateListing = body => {
  if (!isPlainObject(body)) throw badRequest('Request body must be a JSON object.');
  return {
    bookId: bookIdOf(body.bookId),
    status: body.status === undefined ? 'available' : oneOf(body.status, STATUSES, 'status'),
    condition: oneOf(body.condition, CONDITIONS, 'condition'),
    exchange: stringList(body.exchange, 'exchange', { min: 1, max: EXCHANGES.length, allowed: EXCHANGES }),
    spotIds: stringList(body.spotIds, 'spotIds', { min: 1, max: MAX_SPOTS }),
    availableTimes: cleanText(body.availableTimes, 'availableTimes', MAX_TIMES),
    note: cleanText(body.note, 'note', MAX_NOTE),
  };
};

/** Validates a PATCH /v1/listings/:id body: only the supplied fields are returned. */
const validateUpdateListing = body => {
  if (!isPlainObject(body)) throw badRequest('Request body must be a JSON object.');
  const patch = {};
  if (body.status !== undefined) patch.status = oneOf(body.status, STATUSES, 'status');
  if (body.condition !== undefined) patch.condition = oneOf(body.condition, CONDITIONS, 'condition');
  if (body.exchange !== undefined) {
    patch.exchange = stringList(body.exchange, 'exchange', { min: 1, max: EXCHANGES.length, allowed: EXCHANGES });
  }
  if (body.spotIds !== undefined) {
    patch.spotIds = stringList(body.spotIds, 'spotIds', { min: 1, max: MAX_SPOTS });
  }
  if (body.availableTimes !== undefined) {
    patch.availableTimes = cleanText(body.availableTimes, 'availableTimes', MAX_TIMES);
  }
  if (body.note !== undefined) patch.note = cleanText(body.note, 'note', MAX_NOTE);
  if (Object.keys(patch).length === 0) throw badRequest('Send at least one field to update.');
  return patch;
};

const parseNumber = (raw, field, min, max) => {
  const n = Number(raw);
  if (raw === '' || !Number.isFinite(n) || n < min || n > max) {
    throw badRequest(`${field} must be a number between ${min} and ${max}.`);
  }
  return n;
};

/** Optional lat/lng pair from a query string. Both or neither. */
const parseCoords = query => {
  const hasLat = query.lat !== undefined;
  const hasLng = query.lng !== undefined;
  if (!hasLat && !hasLng) return null;
  if (hasLat !== hasLng) throw badRequest('Send both lat and lng, or neither.');
  return {
    lat: parseNumber(query.lat, 'lat', -90, 90),
    lng: parseNumber(query.lng, 'lng', -180, 180),
  };
};

const parseFeedQuery = query => {
  const filter = query.filter === undefined ? 'all' : oneOf(query.filter, FILTERS, 'filter');
  const coords = parseCoords(query);
  if (filter === 'nearby' && !coords) throw badRequest('The nearby filter needs lat and lng.');
  return {
    filter,
    coords,
    radiusKm: query.radiusKm === undefined ? 10 : parseNumber(query.radiusKm, 'radiusKm', 1, 50),
    limit: query.limit === undefined ? 20 : Math.floor(parseNumber(query.limit, 'limit', 1, 50)),
    cursor:
      query.cursor === undefined ? null : parseNumber(query.cursor, 'cursor', 0, Number.MAX_SAFE_INTEGER),
  };
};

module.exports = {
  STATUSES,
  CONDITIONS,
  EXCHANGES,
  FILTERS,
  MAX_SPOTS,
  validateCreateListing,
  validateUpdateListing,
  parseCoords,
  parseFeedQuery,
  bookIdOf,
};
