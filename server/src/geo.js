/* eslint-env node */
const EARTH_RADIUS_KM = 6371;
const toRad = deg => (deg * Math.PI) / 180;

/** Great-circle distance between two { lat, lng } points, in kilometres. */
const haversineKm = (a, b) => {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
};

const round1 = n => Math.round(n * 10) / 10;

module.exports = { haversineKm, round1 };
