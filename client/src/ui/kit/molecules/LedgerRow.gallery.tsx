import React from 'react';

import LedgerRow from './LedgerRow';

import type { GalleryCase } from '../galleryTypes';

export const title = 'LedgerRow';

export const cases: GalleryCase[] = [
  { title: 'готово', node: <LedgerRow artifact="unit_kira_s2_cafe" state="готово" /> },
  { title: 'пишется', node: <LedgerRow artifact="unit_kira_s2_cafe" state="пишется" /> },
  { title: 'очередь', node: <LedgerRow artifact="unit_kira_s2_cafe" state="очередь" /> },
  {
    title: 'префаб-вариант · рендер',
    node: <LedgerRow artifact="prefab_cast_kira" state="пишется" source="▣ префаб" take="черновик" price="…" />,
  },
  {
    title: 'expanded (без нижней рамки, часть группы)',
    node: <LedgerRow artifact="unit_kira_s2_cafe" state="готово" expanded />,
  },
  {
    title: 'кликабельная строка',
    node: <LedgerRow artifact="unit_kira_s2_cafe" state="готово" onClick={() => {}} />,
  },
  {
    title: 'узкие колонки',
    node: <LedgerRow artifact="unit_kira_s2_cafe" state="готово" colWidths={[70, 60, 40, 44]} />,
  },
];
