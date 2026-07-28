import React from 'react';

import ToolbarStatus from './ToolbarStatus';

import type { GalleryCase } from '../galleryTypes';

export const title = 'ToolbarStatus';

export const cases: GalleryCase[] = [
  { title: 'обычный', dark: true, node: <ToolbarStatus text="▶ идёт · на заглушках" tone="normal" /> },
  { title: 'инфо', dark: true, node: <ToolbarStatus text="ждём фазу 8/10" tone="info" /> },
  { title: 'ошибка', dark: true, node: <ToolbarStatus text="QA нашёл 3 проблемы" tone="error" /> },
  { title: 'тихий', dark: true, node: <ToolbarStatus text="автосохранено" tone="quiet" /> },
  {
    title: 'end · прижато к правому краю',
    dark: true,
    node: (
      <div style={{ display: 'flex', width: 260 }}>
        <ToolbarStatus text="ветка: все" tone="quiet" />
        <ToolbarStatus text="сборка 12" tone="normal" end />
      </div>
    ),
  },
];
