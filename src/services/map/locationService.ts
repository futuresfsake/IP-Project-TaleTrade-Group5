import { PermissionsAndroid, Platform } from 'react-native';
import type { Permission } from 'react-native';
import { LocationManager } from '@maplibre/maplibre-react-native';

/**
 * Foreground-only location, used to centre the map and sort spots by distance.
 * Nothing here persists or logs a position: callers keep it in memory (component
 * state) only. It is never written to Firestore, AsyncStorage or logs.
 */

export interface Coords {
  lat: number;
  lng: number;
}

export type LocationPermission = 'granted' | 'denied' | 'blocked';
export type LocationResult =
  | { status: 'ok'; coords: Coords }
  | { status: 'denied' | 'blocked' | 'unavailable' };

const EARTH_RADIUS_KM = 6371;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance between two points, in kilometres. */
export const haversineKm = (a: Coords, b: Coords): number => {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
};

/** "850 m" under a kilometre, otherwise "1.2 km". */
export const formatDistance = (km: number): string =>
  km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;

/** Returns a new array ordered nearest-first by the distance returned for each item. */
export const sortByDistance = <T>(items: T[], distanceOf: (item: T) => number): T[] =>
  [...items].sort((x, y) => distanceOf(x) - distanceOf(y));

const FINE = PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION as Permission;
const COARSE = PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION as Permission;

/** Approximate-only grants (Android 12+) count: either permission is enough. */
const hasLocationPermission = async (): Promise<boolean> => {
  const [fine, coarse] = await Promise.all([
    PermissionsAndroid.check(FINE),
    PermissionsAndroid.check(COARSE),
  ]);
  return fine || coarse;
};

/**
 * Shows the system prompt only if permission isn't already granted.
 * 'blocked' means "never ask again": prompting again does nothing, so callers
 * should offer Linking.openSettings() instead.
 */
export const requestLocationPermission = async (): Promise<LocationPermission> => {
  if (Platform.OS !== 'android') return 'denied';
  if (await hasLocationPermission()) return 'granted';

  const result = await PermissionsAndroid.requestMultiple([FINE, COARSE]);
  const values = Object.values(result);
  if (values.some(v => v === PermissionsAndroid.RESULTS.GRANTED)) return 'granted';
  if (values.every(v => v === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN)) return 'blocked';
  return 'denied';
};

/** The position only if access was already granted: never shows a permission prompt. */
export const getUserLocationIfAllowed = async (): Promise<Coords | null> => {
  try {
    if (Platform.OS !== 'android' || !(await hasLocationPermission())) return null;
    const position = await LocationManager.getCurrentPosition();
    return position ? { lat: position.coords.latitude, lng: position.coords.longitude } : null;
  } catch {
    return null;
  }
};

/**
 * One-shot read of the device's last known position (no tracking, no background
 * updates). Resolves 'unavailable' when the device has no fix yet.
 */
export const getUserLocation = async (): Promise<LocationResult> => {
  const permission = await requestLocationPermission();
  if (permission !== 'granted') return { status: permission };

  try {
    const position = await LocationManager.getCurrentPosition();
    if (!position) return { status: 'unavailable' };
    return {
      status: 'ok',
      coords: { lat: position.coords.latitude, lng: position.coords.longitude },
    };
  } catch {
    return { status: 'unavailable' };
  }
};
