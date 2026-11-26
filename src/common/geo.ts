import type { Point } from 'typeorm';

export interface LatLng {
  lat: number;
  lng: number;
}

const METERS_PER_DEGREE_LAT = 111_320;

/** Size of the grid cell used to hide exact locations. */
export const PUBLIC_LOCATION_CELL_METERS = 300;

/**
 * Snaps a coordinate to the centre of a ~`cellMeters` grid cell.
 * It is deterministic on purpose: random jitter could be averaged out
 * by editing a post many times, a fixed grid cannot.
 */
export function snapToGrid(
  { lat, lng }: LatLng,
  cellMeters = PUBLIC_LOCATION_CELL_METERS,
): LatLng {
  const latStep = cellMeters / METERS_PER_DEGREE_LAT;
  const snappedLat = Math.floor(lat / latStep) * latStep + latStep / 2;

  // Longitude degrees shrink towards the poles; size the cell on the snapped latitude
  // so every point inside the same row uses the same step.
  const cos = Math.max(Math.cos((snappedLat * Math.PI) / 180), 0.01);
  const lngStep = cellMeters / (METERS_PER_DEGREE_LAT * cos);
  const snappedLng = Math.floor(lng / lngStep) * lngStep + lngStep / 2;

  return { lat: round(snappedLat), lng: round(snappedLng) };
}

export function toPoint({ lat, lng }: LatLng): Point {
  return { type: 'Point', coordinates: [lng, lat] };
}

export function fromPoint(point: Point): LatLng {
  const [lng, lat] = point.coordinates;
  return { lat, lng };
}

/** Haversine distance in meters. */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const R = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function round(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}
