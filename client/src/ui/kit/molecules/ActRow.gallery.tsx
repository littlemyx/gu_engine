import React from 'react';

import ActRow from './ActRow';

import type { GalleryCase } from '../galleryTypes';

export const title = 'ActRow';

export const cases: GalleryCase[] = [
  {
    title: 'развёрнуто · заметка «ошибка»',
    dark: true,
    node: <ActRow title="Акт II · Сближение · д4–5" note="1 устарел" noteTone="error" expanded />,
  },
  {
    title: 'заметка «предупреждение»',
    dark: true,
    node: <ActRow title="Акт I · Завязка · д1–3" note="2 без озвучки" noteTone="warn" expanded />,
  },
  {
    title: 'заметка «тихая»',
    dark: true,
    node: <ActRow title="Акт III · Развязка · д9–10" note="набросок" noteTone="neutral" expanded />,
  },
  {
    title: 'свёрнуто · без заметки',
    dark: true,
    node: <ActRow title="Акт IV · Эпилог · д11" expanded={false} />,
  },
  {
    title: 'кликабельная строка',
    dark: true,
    node: (
      <ActRow
        title="Акт II · Сближение · д4–5"
        note="1 устарел"
        expanded
        onToggle={() => {
          /* демонстрация в галерее */
        }}
      />
    ),
  },
];
