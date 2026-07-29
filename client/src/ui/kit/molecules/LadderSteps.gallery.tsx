import React from 'react';

import LadderSteps from './LadderSteps';

import type { GalleryCase } from '../galleryTypes';

export const title = 'LadderSteps';

export const cases: GalleryCase[] = [
  {
    title: 'на светлом',
    node: (
      <LadderSteps
        count={5}
        done={2}
        current={3}
        prefix="С"
        note="2 сыграно · С3 открыта · С4–С5 заперты полом Д5/Д7"
      />
    ),
  },
  {
    title: 'на тёмном',
    node: (
      <LadderSteps
        count={5}
        done={2}
        current={3}
        prefix="С"
        note="2 сыграно · С3 открыта · С4–С5 заперты полом Д5/Д7"
        onDark
      />
    ),
    dark: true,
  },
  {
    title: 'кликабельная (onStep задан)',
    node: <LadderSteps count={5} done={2} current={3} note="" onStep={() => {}} onDark />,
    dark: true,
  },
  {
    title: 'ничего не сыграно, ничего не открыто',
    node: <LadderSteps count={4} done={0} current={0} note="" onDark />,
    dark: true,
  },
  {
    title: 'всё сыграно (done = count)',
    node: <LadderSteps count={4} done={4} current={4} note="4 сыграно" onDark />,
    dark: true,
  },
  {
    title: 'без заметки',
    node: <LadderSteps count={5} done={1} current={2} note="" />,
  },
  {
    title: 'другой префикс и много ступеней',
    node: <LadderSteps count={8} done={3} current={4} prefix="Д" note="" />,
  },
];
