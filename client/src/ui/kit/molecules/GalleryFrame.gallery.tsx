import React from 'react';

import GalleryFrame from './GalleryFrame';

import type { GalleryCase } from '../galleryTypes';

export const title = 'GalleryFrame';

export const cases: GalleryCase[] = [
  {
    title: 'с тенью lg (по умолчанию) + meta + содержимое',
    node: (
      <GalleryFrame kicker="ГАЛЕРЕЯ · dialogue_units / …" title="Проза · diff тейков" meta="14 из 20">
        <span>содержимое галереи…</span>
      </GalleryFrame>
    ),
  },
  {
    title: 'без meta',
    node: (
      <GalleryFrame kicker="ГАЛЕРЕЯ · sprite_cells / …" title="Кадры · спрайт-лист">
        <span>содержимое галереи…</span>
      </GalleryFrame>
    ),
  },
  {
    title: 'без содержимого (только шапка)',
    node: <GalleryFrame kicker="ГАЛЕРЕЯ · beat_rows / …" title="Партитура · биты" meta="0 из 6" />,
  },
  {
    title: 'elevation md',
    node: (
      <GalleryFrame kicker="ГАЛЕРЕЯ · audio_takes / …" title="Аудио · дубли" meta="3 из 3" elevation="md">
        <span>содержимое галереи…</span>
      </GalleryFrame>
    ),
  },
  {
    title: 'elevation sm',
    node: (
      <GalleryFrame kicker="ГАЛЕРЕЯ · role_cards / …" title="Роли · карточки" elevation="sm">
        <span>содержимое галереи…</span>
      </GalleryFrame>
    ),
  },
  {
    title: 'elevation none (плоская)',
    node: (
      <GalleryFrame kicker="ГАЛЕРЕЯ · flags_seed / …" title="Флаги · сид" elevation="none">
        <span>содержимое галереи…</span>
      </GalleryFrame>
    ),
  },
  {
    title: 'узкая (180px)',
    node: (
      <GalleryFrame kicker="ШАГ 2 ИЗ 4" title="Seed" width={180}>
        <span>91427</span>
      </GalleryFrame>
    ),
  },
  {
    title: 'широкая (420px)',
    node: (
      <GalleryFrame kicker="ЭКСПОРТ" title="Сборка истории" meta="4 акта · 37 сцен" width={420}>
        <span>содержимое галереи…</span>
      </GalleryFrame>
    ),
  },
  {
    title: 'на тёмном фоне (панель конвейера)',
    dark: true,
    node: (
      <GalleryFrame kicker="ГАЛЕРЕЯ · dialogue_units / …" title="Проза · diff тейков" meta="14 из 20">
        <span>содержимое галереи…</span>
      </GalleryFrame>
    ),
  },
];
