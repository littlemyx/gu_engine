import React from 'react';

import ResolveTrace, { type ResolveTraceRow } from './ResolveTrace';

import type { GalleryCase } from '../galleryTypes';

export const title = 'ResolveTrace';

const ROWS: ResolveTraceRow[] = [
  { segments: [{ text: '«нежно» → gentle' }] },
  { segments: [{ text: 'EMOTION_TO_POSE: gentle → ' }, { text: 'soft', accent: true }] },
  { segments: [{ text: 'poseFilenames.soft → mia_soft.png ✓' }] },
];

const FALLBACK_ROWS: ResolveTraceRow[] = [
  { segments: [{ text: '«злобно» → angry' }] },
  { segments: [{ text: 'EMOTION_TO_POSE: angry → ' }, { text: 'нет позы', accent: true }] },
  { segments: [{ text: 'poseFilenames.* → mia_idle.png' }] },
];

export const cases: GalleryCase[] = [
  { title: 'без кикера и фолбэка', node: <ResolveTrace rows={ROWS} /> },
  { title: 'с кикером', node: <ResolveTrace rows={ROWS} kicker="Резолв эмоции → спрайт" /> },
  {
    title: 'с фолбэком',
    node: (
      <ResolveTrace
        rows={FALLBACK_ROWS}
        kicker="Резолв эмоции → спрайт"
        fallback="«злобно» → angry — позы нет → idle (флаг isFallback); строка подсвечивается в QA"
      />
    ),
  },
  {
    title: 'узкая ширина',
    node: <ResolveTrace rows={ROWS} kicker="Резолв эмоции → спрайт" width={260} />,
  },
  {
    title: 'на тёмном · с фолбэком',
    dark: true,
    node: (
      <ResolveTrace
        rows={FALLBACK_ROWS}
        kicker="Резолв эмоции → спрайт"
        fallback="«злобно» → angry — позы нет → idle (флаг isFallback)"
        onDark
      />
    ),
  },
];
