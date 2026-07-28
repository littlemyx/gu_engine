import React from 'react';

import HierarchyRow from './HierarchyRow';

import type { GalleryCase } from '../galleryTypes';

export const title = 'HierarchyRow';

export const cases: GalleryCase[] = [
  {
    title: 'normal',
    dark: true,
    node: <HierarchyRow label="порция 2 · ступень 2 · Кира" meta="4/9" icon="●" state="normal" depth={1} />,
  },
  {
    title: 'selected',
    dark: true,
    node: <HierarchyRow label="порция 2 · ступень 2 · Кира" meta="4/9" icon="●" state="selected" depth={1} />,
  },
  {
    title: 'failed',
    dark: true,
    node: <HierarchyRow label="порция 3 · ступень 1 · Дэн" meta="2/6" icon="✗" state="failed" depth={1} />,
  },
  {
    title: 'running',
    dark: true,
    node: <HierarchyRow label="порция 2 · ступень 2 · Кира" meta="4/9" icon="⟳" state="running" depth={1} />,
  },
  {
    title: 'dim',
    dark: true,
    node: <HierarchyRow label="порция 1 · ступень 4 · пролог" meta="9/9" icon="✓" state="dim" depth={1} />,
  },
  {
    title: 'глубина 0 · без счётчика · без клика',
    dark: true,
    node: <HierarchyRow label="ветка А" icon="▾" depth={0} />,
  },
  {
    title: 'глубина 3 · кликабельная строка',
    dark: true,
    node: (
      <HierarchyRow
        label="слот 12 · Кира приходит на порог"
        meta="1/1"
        icon="●"
        depth={3}
        onClick={() => {
          /* демонстрация в галерее */
        }}
      />
    ),
  },
];
