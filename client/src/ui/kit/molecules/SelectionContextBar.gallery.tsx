import React from 'react';

import SelectionContextBar from './SelectionContextBar';

import type { GalleryCase } from '../galleryTypes';

export const title = 'SelectionContextBar';

export const cases: GalleryCase[] = [
  {
    title: 'базовый — без заметки',
    node: (
      <SelectionContextBar
        path="Акт II › слот Д5в › Б5 «Ссора»"
        playLabel="▶ Играть отсюда"
        retakeLabel="⟳ Дубль ≈$0.02"
        onPlay={() => {}}
        onRetake={() => {}}
      />
    ),
  },
  {
    title: 'с заметкой о состоянии кадра',
    node: (
      <SelectionContextBar
        path="Акт II › слот Д5в › Б5 «Ссора»"
        note="кадр не сгенерирован"
        playLabel="▶ Играть отсюда"
        retakeLabel="⟳ Дубль ≈$0.02"
        onPlay={() => {}}
        onRetake={() => {}}
      />
    ),
  },
  {
    title: 'кастомный префикс, длинный путь',
    node: (
      <SelectionContextBar
        prefix="Курсор:"
        path="Акт I › слот А2а › А2 «Знакомство у пирса» › реплика 7"
        note="черновик, не проигран"
        playLabel="▶ Играть отсюда"
        retakeLabel="⟳ Дубль ≈$0.05"
        onPlay={() => {}}
        onRetake={() => {}}
      />
    ),
  },
  {
    title: 'без колбэков — кнопки неинтерактивны',
    node: (
      <SelectionContextBar
        path="Акт III › слот К1в › Ф1 «Финал»"
        playLabel="▶ Играть отсюда"
        retakeLabel="⟳ Дубль ≈$0.02"
      />
    ),
  },
];
