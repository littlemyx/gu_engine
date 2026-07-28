import React from 'react';

import PrefabDiffPanel from './PrefabDiffPanel';

import type { GalleryCase } from '../galleryTypes';

export const title = 'PrefabDiffPanel';

export const cases: GalleryCase[] = [
  {
    title: 'конфликт без мержа',
    node: (
      <PrefabDiffPanel
        title="Кира: v2 (закастована) → v3 (в библиотеке)"
        note="апгрейд — осознанное действие"
        conflict="конфликт speechPattern: ваше «мягче, без иронии» · v3 «суше, ироничнее» — выбираете вы, мержа нет"
        takeLabel="Взять v3, оверрайд решить"
        stayLabel="Остаться на v2"
        onTake={() => {}}
        onStay={() => {}}
      />
    ),
  },
  {
    title: 'кастомное тело диффа',
    node: (
      <PrefabDiffPanel
        title="Ксандер: v1 (закастован) → v2 (в библиотеке)"
        note="изменений в личности нет"
        conflict="конфликт отсутствует"
        takeLabel="Взять v2"
        stayLabel="Остаться на v1"
        onTake={() => {}}
        onStay={() => {}}
      >
        <span>appearance: «серый плащ» → «тёмно-синий плащ» — конфликтов нет</span>
      </PrefabDiffPanel>
    ),
  },
  {
    title: 'со сноской и без колбэка «остаться»',
    node: (
      <PrefabDiffPanel
        title="Мира: v4 (закастована) → v5 (в библиотеке)"
        note="апгрейд — осознанное действие"
        conflict="конфликт backstory: обе версии расходятся необратимо"
        takeLabel="Взять v5, оверрайд решить"
        stayLabel="Остаться на v4"
        footnote="решение необратимо"
        onTake={() => {}}
      />
    ),
  },
];
