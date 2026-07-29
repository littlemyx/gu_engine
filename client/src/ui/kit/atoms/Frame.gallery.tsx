import React from 'react';

import Frame from './Frame';

import type { GalleryCase } from '../galleryTypes';

export const title = 'Frame';

const Content = ({ children }: { children: React.ReactNode }) => (
  <span style={{ fontSize: 11, fontFamily: 'var(--font-body)' }}>{children}</span>
);

export const cases: GalleryCase[] = [
  {
    title: 'светлая',
    node: (
      <Frame tone="light">
        <Content>контент рамки</Content>
      </Frame>
    ),
  },
  {
    title: 'тёмная',
    dark: true,
    node: (
      <Frame tone="dark">
        <Content>
          <span style={{ color: 'var(--gu-ink-85)' }}>контент рамки</span>
        </Content>
      </Frame>
    ),
  },
  {
    title: 'accent',
    node: (
      <Frame tone="accent">
        <Content>контент рамки</Content>
      </Frame>
    ),
  },
  {
    title: 'blueprint-400',
    node: (
      <Frame tone="blueprint-400">
        <Content>тон blueprint-400</Content>
      </Frame>
    ),
  },
  {
    title: 'blueprint-700',
    node: (
      <Frame tone="blueprint-700">
        <Content>тон blueprint-700</Content>
      </Frame>
    ),
  },
  {
    title: 'selected',
    node: (
      <Frame tone="light" selected>
        <Content>выбрана</Content>
      </Frame>
    ),
  },
  {
    title: 'не интерактивна',
    node: (
      <Frame tone="light" interactive={false}>
        <Content>без фокуса и hover</Content>
      </Frame>
    ),
  },
  {
    title: 'dashed — running',
    node: (
      <Frame tone="accent" dashed>
        <Content>идёт генерация</Content>
      </Frame>
    ),
  },
  {
    title: 'dashed — locked',
    node: (
      <Frame tone="blueprint-400" dashed>
        <Content>заблокировано</Content>
      </Frame>
    ),
  },
  {
    title: 'fill: paper — open',
    node: (
      <Frame tone="accent" fill="paper">
        <Content>открыто</Content>
      </Frame>
    ),
  },
  {
    title: 'fill: blueprint — locked',
    node: (
      <Frame tone="blueprint-400" fill="blueprint" dashed>
        <Content>заблокировано</Content>
      </Frame>
    ),
  },
  {
    title: 'fill: paper — failed',
    node: (
      <Frame tone="accent" fill="paper" selected>
        <Content>ошибка генерации</Content>
      </Frame>
    ),
  },
  {
    title: 'асимметричный паддинг 8×10',
    node: (
      <Frame tone="light" paddingY={8} paddingX={10}>
        <Content>8px 10px</Content>
      </Frame>
    ),
  },
  {
    title: 'block — на всю ширину',
    node: (
      <div style={{ width: 220 }}>
        <Frame tone="light" block>
          <Content>display: block</Content>
        </Frame>
      </div>
    ),
  },
  {
    title: 'кликабельная (button)',
    node: (
      <Frame tone="accent" onClick={() => {}}>
        <Content>кликни меня</Content>
      </Frame>
    ),
  },
];
