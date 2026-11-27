/* eslint-env node */
/**
 * Book metadata source. Google Books is used as an upstream *data* provider only: the
 * client never talks to it for Feed/details, the API key stays on the server, responses
 * are normalised into TaleTrade's own Book shape, and results are cached so a slow or
 * rate-limited upstream does not take the feature down.
 */

const stripHtml = text =>
  typeof text === 'string'
    ? text
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .trim()
    : '';

/** Google Books volume -> TaleTrade Book. */
const normalizeVolume = item => {
  const v = (item && item.volumeInfo) || {};
  const identifiers = v.industryIdentifiers || [];
  const isbn = (identifiers.find(i => i.type === 'ISBN_13') || identifiers.find(i => i.type === 'ISBN_10') || {})
    .identifier;
  const image = v.imageLinks && (v.imageLinks.thumbnail || v.imageLinks.smallThumbnail);

  return {
    id: item.id,
    title: v.title || 'Untitled',
    authors: Array.isArray(v.authors) && v.authors.length > 0 ? v.authors : ['Unknown Author'],
    publisher: v.publisher || null,
    description: stripHtml(v.description),
    thumbnail: image ? image.replace(/^http:/, 'https:') : null,
    isbn: isbn || null,
    publishedDate: v.publishedDate || null,
    pageCount: v.pageCount || null,
    categories: Array.isArray(v.categories) ? v.categories : [],
    language: v.language || null,
    source: 'google-books',
  };
};

const createGoogleBooksProvider = ({
  apiKey,
  fetchImpl = fetch,
  ttlMs = 10 * 60 * 1000,
  maxEntries = 500,
  now = Date.now,
} = {}) => {
  const cache = new Map();

  return {
    /** Resolves a normalised Book, null when the volume does not exist, or throws on upstream failure. */
    async getBook(id) {
      const hit = cache.get(id);
      if (hit && hit.expiresAt > now()) return hit.book;

      const url = `https://www.googleapis.com/books/v1/volumes/${encodeURIComponent(id)}${
        apiKey ? `?key=${encodeURIComponent(apiKey)}` : ''
      }`;
      const response = await fetchImpl(url, { signal: AbortSignal.timeout(8000) });
      if (response.status === 404) return null;
      if (!response.ok) throw new Error(`Google Books responded ${response.status}`);

      const book = normalizeVolume(await response.json());
      if (cache.size >= maxEntries) cache.delete(cache.keys().next().value);
      cache.set(id, { book, expiresAt: now() + ttlMs });
      return book;
    },
  };
};

module.exports = { createGoogleBooksProvider, normalizeVolume, stripHtml };
