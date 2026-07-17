import { describe, expect, it } from 'vitest';
import { imageIsStale, locationFingerprint, locationImageKey, reconcileImagesForWorld } from './imageFingerprint';
import type { ImageGenState } from './narrativeStore';
import type { WorldModel } from './types';

const loc = (id: string, description: string, poi: string[] = []) =>
  ({ id, name: id, description, pointsOfInterest: poi } as WorldModel['locations'][number]);

const world = (locations: WorldModel['locations']): WorldModel => ({ locations, anchorLocations: {} } as WorldModel);

const done = (filename: string, locationHash?: string): ImageGenState => ({ status: 'done', filename, locationHash });

describe('locationFingerprint', () => {
  it('меняется при переписывании локации и не меняется без причины', () => {
    const cafe = loc('cafe', 'тёплое кафе у реки', ['витрина']);
    expect(locationFingerprint(cafe)).toBe(locationFingerprint(loc('cafe', 'тёплое кафе у реки', ['витрина'])));
    expect(locationFingerprint(cafe)).not.toBe(locationFingerprint(loc('cafe', 'заброшенное кафе', ['витрина'])));
    expect(locationFingerprint(cafe)).not.toBe(locationFingerprint(loc('cafe', 'тёплое кафе у реки', ['стойка'])));
  });
});

describe('imageIsStale', () => {
  const fingerprint = locationFingerprint(loc('cafe', 'кафе'));

  it('протух только готовый фон с чужим отпечатком', () => {
    expect(imageIsStale(done('a.png', fingerprint), fingerprint)).toBe(false);
    expect(imageIsStale(done('a.png', 'другой'), fingerprint)).toBe(true);
    // Легаси-запись без отпечатка (миграция проставляет его существующим фонам).
    expect(imageIsStale(done('a.png'), fingerprint)).toBe(true);
    expect(imageIsStale({ status: 'pending' }, fingerprint)).toBe(false);
    expect(imageIsStale(undefined, fingerprint)).toBe(false);
  });
});

describe('reconcileImagesForWorld', () => {
  const cafe = loc('cafe', 'тёплое кафе у реки');
  const park = loc('park', 'парк');

  it('оставляет актуальные, выбрасывает сирот, возвращает в очередь переписанные', () => {
    const images: Record<string, ImageGenState> = {
      [locationImageKey('cafe')]: done('cafe.png', locationFingerprint(cafe)),
      [locationImageKey('park')]: done('park.png', 'отпечаток-старого-парка'),
      [locationImageKey('ghost')]: done('ghost.png', 'x'),
      legacy_anchor: done('anchor.png'),
    };

    const next = reconcileImagesForWorld(images, world([cafe, park]));

    expect(next[locationImageKey('cafe')]).toEqual(done('cafe.png', locationFingerprint(cafe)));
    expect(next[locationImageKey('park')]).toEqual({ status: 'pending' });
    expect(next[locationImageKey('ghost')]).toBeUndefined();
    // Легаси-ключи (голые anchorId) миру не принадлежат — не трогаем.
    expect(next.legacy_anchor).toEqual(done('anchor.png'));
  });

  it('без мира кэш не трогается', () => {
    const images = { [locationImageKey('cafe')]: done('cafe.png') };
    expect(reconcileImagesForWorld(images, null)).toBe(images);
  });
});
