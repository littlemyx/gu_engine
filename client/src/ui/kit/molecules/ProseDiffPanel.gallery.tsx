import React from 'react';

import ProseDiffPanel from './ProseDiffPanel';

import type { GalleryCase } from '../galleryTypes';

export const title = 'ProseDiffPanel';

export const cases: GalleryCase[] = [
  {
    title: 'на светлом · без before/after',
    node: (
      <ProseDiffPanel
        oldKicker="ТЕЙК №2"
        oldPrice="$0.021"
        oldText="КИРА: «Впрочем, неважно. Все вы одинаковые.»"
        newKicker="ТЕЙК №3 · ✎ ПРИНЯТ"
        newText="КИРА: [пауза · смотрит на воду]"
      />
    ),
  },
  {
    title: 'на светлом · с before/after',
    node: (
      <ProseDiffPanel
        oldKicker="ТЕЙК №2"
        oldPrice="$0.021"
        oldBefore="Она стояла у самой кромки воды."
        oldText="«Впрочем, неважно. Все вы одинаковые.»"
        oldAfter="И пошла прочь, не оглянувшись."
        newKicker="ТЕЙК №3 · ✎ ПРИНЯТ"
        newBefore="Она стояла у самой кромки воды."
        newText="[пауза · смотрит на воду]"
        newAfter="И пошла прочь, не оглянувшись."
      />
    ),
  },
  {
    title: 'без цены архивного тейка',
    node: (
      <ProseDiffPanel
        oldKicker="ТЕЙК №1"
        oldText="КИРА: «Мне всё равно, что вы думаете.»"
        newKicker="ТЕЙК №3 · ✎ ПРИНЯТ"
        newText="КИРА: [пауза · смотрит на воду]"
      />
    ),
  },
  {
    title: 'узкая панель (360px)',
    node: (
      <ProseDiffPanel
        oldKicker="ТЕЙК №2"
        oldPrice="$0.021"
        oldText="«Впрочем, неважно.»"
        newKicker="ТЕЙК №3 · ✎ ПРИНЯТ"
        newText="[пауза]"
        width={360}
      />
    ),
  },
  {
    title: 'на всю ширину контейнера',
    node: (
      <ProseDiffPanel
        oldKicker="ТЕЙК №2"
        oldPrice="$0.021"
        oldText="«Впрочем, неважно. Все вы одинаковые.»"
        newKicker="ТЕЙК №3 · ✎ ПРИНЯТ"
        newText="[пауза · смотрит на воду]"
        width="fill"
      />
    ),
  },
  {
    title: 'на тёмном',
    dark: true,
    node: (
      <ProseDiffPanel
        oldKicker="ТЕЙК №2"
        oldPrice="$0.021"
        oldText="«Впрочем, неважно. Все вы одинаковые.»"
        newKicker="ТЕЙК №3 · ✎ ПРИНЯТ"
        newText="[пауза · смотрит на воду]"
        onDark
      />
    ),
  },
];
