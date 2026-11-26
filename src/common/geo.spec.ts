import { distanceMeters, fromPoint, snapToGrid, toPoint } from './geo.js';

describe('geo helpers', () => {
  const plazaDeMayo = { lat: -34.60837, lng: -58.37224 };

  it('moves the point, but by no more than half a cell diagonal', () => {
    const snapped = snapToGrid(plazaDeMayo);
    expect(snapped).not.toEqual(plazaDeMayo);
    // Half the diagonal of a 300 m cell is ~212 m.
    expect(distanceMeters(plazaDeMayo, snapped)).toBeLessThanOrEqual(215);
  });

  it('is deterministic, so repeated edits cannot be averaged out', () => {
    expect(snapToGrid(plazaDeMayo)).toEqual(snapToGrid(plazaDeMayo));
  });

  it('maps nearby points in the same cell to the same public point', () => {
    const a = snapToGrid({ lat: -34.6, lng: -58.4 });
    const b = snapToGrid({ lat: -34.6 + 0.0001, lng: -58.4 + 0.0001 });
    expect(a).toEqual(b);
  });

  it('round-trips GeoJSON points as [lng, lat]', () => {
    const point = toPoint(plazaDeMayo);
    expect(point.coordinates).toEqual([plazaDeMayo.lng, plazaDeMayo.lat]);
    expect(fromPoint(point)).toEqual(plazaDeMayo);
  });

  it('computes haversine distances', () => {
    // Obelisco to Plaza de Mayo is roughly 1.1 km.
    const obelisco = { lat: -34.60372, lng: -58.38159 };
    expect(distanceMeters(obelisco, plazaDeMayo)).toBeGreaterThan(900);
    expect(distanceMeters(obelisco, plazaDeMayo)).toBeLessThan(1300);
  });
});
