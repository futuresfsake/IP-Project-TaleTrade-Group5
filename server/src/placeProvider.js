/* eslint-env node */
/**
 * Turns coordinates into a place name for locations pinned on the map. MapTiler is only the
 * upstream data source: the app asks TaleTrade's API, and the key stays on the server.
 */
const { haversineKm } = require('./geo');

// A point of interest is used only when the pin is practically on it.
const POI_MAX_KM = 0.075;

const createMapTilerProvider = ({ apiKey, fetchImpl = fetch, maxEntries = 500 } = {}) => {
  const cache = new Map();

  const lookup = async (lat, lng, query) => {
    const url = `https://api.maptiler.com/geocoding/${lng},${lat}.json?${query}key=${encodeURIComponent(apiKey)}`;
    const response = await fetchImpl(url, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error(`MapTiler responded ${response.status}`);
    return (await response.json()).features || [];
  };

  return {
    configured: Boolean(apiKey),

    /** Resolves { name, address } or null when nothing is known there; throws on upstream failure. */
    async reverse({ lat, lng }) {
      const key = `${lat.toFixed(5)},${lng.toFixed(5)}`;
      if (cache.has(key)) return cache.get(key);

      let place = null;
      const [poi] = await lookup(lat, lng, 'types=poi&limit=1&');
      if (poi && poi.text && poi.center && haversineKm({ lat, lng }, { lng: poi.center[0], lat: poi.center[1] }) <= POI_MAX_KM) {
        place = { name: poi.text, address: poi.place_name || null };
      } else {
        const features = await lookup(lat, lng, '');
        const street = features.find(f => (f.place_type || []).includes('address'));
        const area = features.find(f => (f.place_type || []).includes('place'));
        const best = street || area || features[0];
        if (best && best.text) {
          const name = street && area ? `${street.text}, ${area.text}` : best.text;
          place = { name, address: best.place_name || null };
        }
      }

      if (cache.size >= maxEntries) cache.delete(cache.keys().next().value);
      cache.set(key, place);
      return place;
    },
  };
};

module.exports = { createMapTilerProvider };
