import React from 'react';

import PoseTile from './PoseTile';

import type { GalleryCase } from '../galleryTypes';

export const title = 'PoseTile';

export const cases: GalleryCase[] = [
  {
    title: 'обычная',
    node: <PoseTile name="happy" state="normal" />,
  },
  {
    title: 'обычная, кликабельна',
    node: <PoseTile name="happy" state="normal" onClick={() => {}} />,
  },
  {
    title: 'выбрана',
    node: <PoseTile name="happy" state="selected" badge="ВЫБРАНА" onClick={() => {}} />,
  },
  {
    title: 'выбрана, без бейджа',
    node: <PoseTile name="happy" state="selected" onClick={() => {}} />,
  },
  {
    title: 'генерация',
    node: <PoseTile name="happy" state="generating" generatingLabel="генерация…" />,
  },
  {
    title: 'нет в poseFilenames',
    node: (
      <PoseTile
        name="happy"
        state="missing"
        missingNote="нет в poseFilenames"
        generateLabel="Догенерировать"
        onClick={() => {}}
        onGenerate={() => {}}
      />
    ),
  },
  {
    title: 'нет в poseFilenames, некликабельна',
    node: <PoseTile name="happy" state="missing" missingNote="нет в poseFilenames" />,
  },
  {
    title: 'узкая плитка (width 80)',
    node: <PoseTile name="joy" state="normal" width={80} onClick={() => {}} />,
  },
  {
    title: 'широкая плитка (width 200)',
    node: <PoseTile name="сидит" state="selected" badge="ВЫБРАНА" width={200} onClick={() => {}} />,
  },
];
