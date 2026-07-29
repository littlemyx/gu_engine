import React from 'react';

import CandidateRow from './CandidateRow';

import type { GalleryCase } from '../galleryTypes';

export const title = 'CandidateRow';

const noop = () => {
  /* демонстрация в галерее */
};

export const cases: GalleryCase[] = [
  {
    title: 'лидер, на тёмном',
    dark: true,
    node: <CandidateRow label="◈ Б4 «Фестиваль» — бит хребта" outcome="победит" winner onDark />,
  },
  {
    title: 'обычная, на тёмном',
    dark: true,
    node: <CandidateRow label="◇ Б7 «Разговор в порту» — болтовня" outcome="0.34" winner={false} onDark />,
  },
  {
    title: 'лидер, на светлом',
    node: <CandidateRow label="◈ Б4 «Фестиваль» — бит хребта" outcome="победит" winner />,
  },
  {
    title: 'обычная, на светлом',
    node: <CandidateRow label="◇ Б7 «Разговор в порту» — болтовня" outcome="0.34" winner={false} />,
  },
  {
    title: 'лидер, кликабельная, на тёмном',
    dark: true,
    node: <CandidateRow label="◈ Б4 «Фестиваль» — бит хребта" outcome="победит" winner onDark onClick={noop} />,
  },
  {
    title: 'обычная, кликабельная, на светлом',
    node: <CandidateRow label="◇ Б7 «Разговор в порту» — болтовня" outcome="0.34" winner={false} onClick={noop} />,
  },
  {
    title: 'узкая строка (width 220)',
    dark: true,
    node: (
      <CandidateRow
        label="◈ Б12 «Долгое-долгое имя бита, которое обрежется»"
        outcome="0.51"
        winner={false}
        width={220}
        onDark
      />
    ),
  },
];
