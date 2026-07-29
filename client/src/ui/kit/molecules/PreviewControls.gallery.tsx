import React from 'react';

import PreviewControls from './PreviewControls';

import type { GalleryCase } from '../galleryTypes';

export const title = 'PreviewControls';

export const cases: GalleryCase[] = [
  {
    title: 'интерактивная, все колбэки заданы',
    node: <PreviewControls onRestart={() => {}} onBranch={() => {}} onReroll={() => {}} />,
    dark: true,
  },
  {
    title: 'disabled — идёт прогон, превью гасится',
    node: <PreviewControls disabled onRestart={() => {}} onBranch={() => {}} onReroll={() => {}} />,
    dark: true,
  },
  {
    title: 'без колбэков — все три контрола немые',
    node: <PreviewControls />,
    dark: true,
  },
  {
    title: 'свои подписи, ветка и сид',
    node: (
      <PreviewControls
        restartLabel="Перемотка к началу"
        branch="месть"
        seed="7f3a91"
        rerollLabel="ещё раз"
        onRestart={() => {}}
        onBranch={() => {}}
        onReroll={() => {}}
      />
    ),
    dark: true,
  },
];
