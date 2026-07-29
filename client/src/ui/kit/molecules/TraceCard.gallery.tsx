import React from 'react';

import TraceCard from './TraceCard';

import type { GalleryCase } from '../galleryTypes';

export const title = 'TraceCard';

export const cases: GalleryCase[] = [
  {
    title: 'выбран',
    node: <TraceCard id="enc_kira_pier" meta="выбран · салиенс 8.4 · ярус A · жребий 1 из 2" kind="выбран" />,
    dark: true,
  },
  {
    title: 'отклонён',
    node: <TraceCard id="enc_dan_market" meta="guard: rel(Дан) ≥ 20 — сейчас 18" kind="отклонён" />,
    dark: true,
  },
  {
    title: 'выбран · кликабельна',
    node: (
      <TraceCard
        id="enc_kira_pier"
        meta="выбран · салиенс 8.4 · ярус A · жребий 1 из 2"
        kind="выбран"
        onClick={() => {}}
      />
    ),
    dark: true,
  },
  {
    title: 'отклонён · кликабельна',
    node: <TraceCard id="enc_dan_market" meta="guard: rel(Дан) ≥ 20 — сейчас 18" kind="отклонён" onClick={() => {}} />,
    dark: true,
  },
];
