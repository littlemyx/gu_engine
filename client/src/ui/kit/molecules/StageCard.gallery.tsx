import React from 'react';

import StageCard from './StageCard';

import type { GalleryCase } from '../galleryTypes';

export const title = 'StageCard';

export const cases: GalleryCase[] = [
  {
    title: 'active · со сметой',
    dark: true,
    node: <StageCard kicker="2 · ПРОЗА" stats="31 готово · 9 устарело · 4 нет" price="довести ≈$1.36" tone="active" />,
  },
  {
    title: 'default · со сметой',
    dark: true,
    node: (
      <StageCard kicker="1 · ЗАВЯЗКА" stats="12 готово · 0 устарело · 0 нет" price="довести ≈$0.14" tone="default" />
    ),
  },
  {
    title: 'attention · со сметой',
    dark: true,
    node: (
      <StageCard
        kicker="3 · КУЛЬМИНАЦИЯ"
        stats="4 готово · 6 устарело · 2 нет"
        price="довести ≈$0.82"
        tone="attention"
      />
    ),
  },
  {
    title: 'running · со сметой',
    dark: true,
    node: (
      <StageCard kicker="2 · ПРОЗА" stats="18 готово · 2 устарело · 11 нет" price="довести ≈$1.36" tone="running" />
    ),
  },
  {
    title: 'без сметы',
    dark: true,
    node: <StageCard kicker="4 · ФИНАЛ" stats="0 готово · 0 устарело · 6 нет" tone="default" />,
  },
  {
    title: 'смета: тон accent (принудительно)',
    dark: true,
    node: (
      <StageCard
        kicker="2 · ПРОЗА"
        stats="31 готово · 9 устарело · 4 нет"
        price="≈$1.36"
        tone="default"
        priceTone="accent"
      />
    ),
  },
  {
    title: 'смета: тон muted (принудительно)',
    dark: true,
    node: (
      <StageCard
        kicker="2 · ПРОЗА"
        stats="31 готово · 9 устарело · 4 нет"
        price="≈$1.36"
        tone="active"
        priceTone="muted"
      />
    ),
  },
  {
    title: 'смета: тон error (принудительно)',
    dark: true,
    node: (
      <StageCard
        kicker="2 · ПРОЗА"
        stats="31 готово · 9 устарело · 4 нет"
        price="≈$1.36"
        tone="active"
        priceTone="error"
      />
    ),
  },
  {
    title: 'кликабельная (роль button)',
    dark: true,
    node: (
      <StageCard
        kicker="2 · ПРОЗА"
        stats="31 готово · 9 устарело · 4 нет"
        price="довести ≈$1.36"
        tone="active"
        onClick={() => {}}
      />
    ),
  },
  {
    title: 'ширина fill',
    dark: true,
    node: (
      <div style={{ width: 320 }}>
        <StageCard
          kicker="2 · ПРОЗА"
          stats="31 готово · 9 устарело · 4 нет"
          price="довести ≈$1.36"
          tone="active"
          width="fill"
        />
      </div>
    ),
  },
];
