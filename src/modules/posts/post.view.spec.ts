import { toPoint } from '../../common/geo.js';
import type { Post } from './post.entity.js';
import { toPostView } from './post.view.js';

const post = {
  id: 'p1',
  authorId: 'author',
  author: { id: 'author', displayName: 'Ana' },
  type: 'FOUND',
  status: 'OPEN',
  title: 'Billetera marrón',
  description: 'Encontrada en un banco de la plaza',
  categoryId: 1,
  category: { id: 1, slug: 'billeteras', name: 'Billeteras y carteras' },
  attributes: { color: 'marrón' },
  occurredAt: new Date('2026-11-20T15:00:00Z'),
  location: toPoint({ lat: -34.60837, lng: -58.37224 }),
  publicLocation: toPoint({ lat: -34.6085, lng: -58.3725 }),
  radiusM: 50,
  locationLabel: 'Plaza de Mayo',
  createdAt: new Date(),
  updatedAt: new Date(),
} as unknown as Post;

describe('toPostView', () => {
  it('hides the exact location from other users and anonymous visitors', () => {
    for (const viewer of [undefined, 'someone-else']) {
      const view = toPostView(post, viewer);
      expect(view.isOwner).toBe(false);
      expect(view).not.toHaveProperty('location');
      expect(view).not.toHaveProperty('radiusM');
      expect(view.approximateLocation).toEqual({ lat: -34.6085, lng: -58.3725 });
    }
  });

  it('never reports a public radius smaller than the grid cell', () => {
    expect(toPostView(post).approximateRadiusM).toBe(300);
  });

  it('shows the exact location to the author', () => {
    const view = toPostView(post, 'author');
    expect(view.isOwner).toBe(true);
    expect(view.location).toEqual({ lat: -34.60837, lng: -58.37224 });
    expect(view.radiusM).toBe(50);
  });

  it('does not leak author fields beyond id and display name', () => {
    expect(Object.keys(toPostView(post).author)).toEqual(['id', 'displayName']);
  });
});
