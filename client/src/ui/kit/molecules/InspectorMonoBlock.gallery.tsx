import React from 'react';

import InspectorMonoBlock from './InspectorMonoBlock';

import type { GalleryCase } from '../galleryTypes';

export const title = 'InspectorMonoBlock';

const PROVENANCE = ['рождён прогоном #9 · промпт v3', 'вход: beatText Б4 · окно Д5в', 'цена $0.021 · отпечаток 4f2a…'];

const CAST_REF = ['актёр: Марта Свенссон', 'роль: доверенное лицо · слот 2', 'привязка: seed 771204'];

export const cases: GalleryCase[] = [
  { title: 'на тёмном · в рамке', dark: true, node: <InspectorMonoBlock lines={PROVENANCE} /> },
  { title: 'на тёмном · без рамки', dark: true, node: <InspectorMonoBlock lines={PROVENANCE} framed={false} /> },
  { title: 'на светлом · в рамке', node: <InspectorMonoBlock lines={CAST_REF} onDark={false} /> },
  { title: 'на светлом · без рамки', node: <InspectorMonoBlock lines={CAST_REF} onDark={false} framed={false} /> },
  { title: 'фиксированная ширина 240px', dark: true, node: <InspectorMonoBlock lines={PROVENANCE} width={240} /> },
];
