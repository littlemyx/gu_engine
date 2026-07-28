import React from 'react';

import DashedFrame from './DashedFrame';

import type { GalleryCase } from '../galleryTypes';

export const title = 'DashedFrame';

const Content = ({ children, dark = false }: { children: React.ReactNode; dark?: boolean }) => (
  <span style={{ fontSize: 11, fontFamily: 'var(--font-body)', color: dark ? 'var(--gu-ink-60)' : 'var(--gu-muted)' }}>
    {children}
  </span>
);

export const cases: GalleryCase[] = [
  {
    title: 'add',
    node: <DashedFrame kind="add">{<Content>+ добавить</Content>}</DashedFrame>,
  },
  {
    title: 'note',
    node: <DashedFrame kind="note">{<Content>заметка режиссёру</Content>}</DashedFrame>,
  },
  {
    title: 'missing',
    node: <DashedFrame kind="missing">{<Content>нет данных</Content>}</DashedFrame>,
  },
  {
    title: 'add · на тёмном',
    dark: true,
    node: (
      <DashedFrame kind="add" onDark>
        <Content dark>+ добавить</Content>
      </DashedFrame>
    ),
  },
  {
    title: 'note · на тёмном',
    dark: true,
    node: (
      <DashedFrame kind="note" onDark>
        <Content dark>заметка режиссёру</Content>
      </DashedFrame>
    ),
  },
  {
    title: 'missing · на тёмном',
    dark: true,
    node: (
      <DashedFrame kind="missing" onDark>
        <Content dark>нет данных</Content>
      </DashedFrame>
    ),
  },
  {
    title: 'не интерактивна',
    node: (
      <DashedFrame kind="add" interactive={false}>
        <Content>без фокуса и hover</Content>
      </DashedFrame>
    ),
  },
];
