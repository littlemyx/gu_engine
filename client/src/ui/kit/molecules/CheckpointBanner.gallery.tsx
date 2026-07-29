import React from 'react';

import CheckpointBanner from './CheckpointBanner';

import type { GalleryCase } from '../galleryTypes';

export const title = 'CheckpointBanner';

export const cases: GalleryCase[] = [
  {
    title: 'обычная, без действия',
    node: <CheckpointBanner label="Чекпоинт сохранён" note="можно продолжать конвейер" />,
  },
  {
    title: 'обычная, с действием',
    node: (
      <CheckpointBanner
        glyph="⏸"
        label="Пауза после порции 2 включена"
        note="конвейер остановится, замок отпустится"
        action="снять паузу"
        actionTone="accent"
      />
    ),
  },
  {
    title: 'предупреждение, с действием',
    node: (
      <CheckpointBanner
        glyph="⚠"
        label="Смета почти исчерпана"
        note="ещё 2 порции до лимита"
        tone="warn"
        action="остановить"
        actionTone="danger"
      />
    ),
  },
];
