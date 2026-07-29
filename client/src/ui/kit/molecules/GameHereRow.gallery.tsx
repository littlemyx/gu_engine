import React from 'react';

import GameHereRow from './GameHereRow';

import type { GalleryCase } from '../galleryTypes';

export const title = 'GameHereRow';

export const cases: GalleryCase[] = [
  {
    title: 'активная · кликабельная кнопка «играть отсюда»',
    dark: true,
    node: (
      <GameHereRow
        glyph="◈"
        label="Б3 Шторм"
        hint="игра здесь"
        onPlay={() => {
          /* демонстрация в галерее */
        }}
      />
    ),
  },
  {
    title: 'активная · без onPlay (неинтерактивная кнопка)',
    dark: true,
    node: <GameHereRow glyph="◈" label="Б3 Шторм" hint="игра здесь" />,
  },
  {
    title: 'неактивная · соседний бит без подсветки',
    dark: true,
    node: <GameHereRow glyph="◇" label="Б2 Затишье перед бурей" hint="игра здесь" active={false} />,
  },
  {
    title: 'длинная подпись обрезается многоточием',
    dark: true,
    node: (
      <GameHereRow
        glyph="◈"
        label="Б7 Возвращение в порт после долгого шторма и починки такелажа"
        hint="игра здесь"
        onPlay={() => {
          /* демонстрация в галерее */
        }}
      />
    ),
  },
];
