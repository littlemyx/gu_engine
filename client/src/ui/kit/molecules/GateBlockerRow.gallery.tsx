import React from 'react';

import GateBlockerRow from './GateBlockerRow';

import type { GalleryCase } from '../galleryTypes';

export const title = 'GateBlockerRow';

export const cases: GalleryCase[] = [
  {
    title: 'активный · с действием',
    node: <GateBlockerRow text="QA-отчёт #7 устарел — прогнан до правки Б5 · гейту нужен свежий" onAction={() => {}} />,
  },
  {
    title: 'активный · без onAction (неинтерактивно)',
    node: <GateBlockerRow text="QA-отчёт #7 устарел — прогнан до правки Б5 · гейту нужен свежий" />,
  },
  {
    title: 'решён',
    node: (
      <GateBlockerRow
        text="QA-отчёт #7 устарел — прогнан до правки Б5 · гейту нужен свежий"
        state="решён"
        onAction={() => {}}
      />
    ),
  },
  {
    title: 'свои текст и подпись действия',
    node: (
      <GateBlockerRow
        text="скрипт озвучки не тронут после правки диалога"
        action="перегенерировать ≈$1.20"
        onAction={() => {}}
      />
    ),
  },
  {
    title: 'action="" — действие скрыто',
    node: <GateBlockerRow text="справочно: гейт не требует действия" action="" />,
  },
];
