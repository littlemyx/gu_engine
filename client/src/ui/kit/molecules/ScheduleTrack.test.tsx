/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import ScheduleTrack from './ScheduleTrack';

afterEach(cleanup);

describe('ScheduleTrack', () => {
  it('показывает подпись строки', () => {
    render(<ScheduleTrack label="Асель" />);

    expect(screen.getByText('Асель')).toBeTruthy();
  });

  it('по умолчанию рисует спаны присутствия, встреч и якорей одним набором', () => {
    const { container } = render(<ScheduleTrack label="Асель" />);

    // 4 диапазона присутствия + 3 встречи + 1 якорь = 8 спанов.
    const spans = container.querySelectorAll('[title]');
    expect(spans.length).toBe(8);
  });

  it('диапазон присутствия растягивается на нужные колонки грида', () => {
    const { container } = render(
      <ScheduleTrack label="Асель" presence={[{ from: 1, to: 3 }]} meetings={[]} anchors={[]} />,
    );

    const span = container.querySelector('[title]') as HTMLElement;
    expect(span.style.gridColumn).toBe('1 / 4');
    expect(span.title).toBe('в локации по расписанию');
  });

  it('одиночный слот встречи/якоря занимает одну колонку', () => {
    const { container } = render(<ScheduleTrack label="Асель" presence={[]} meetings={[5]} anchors={[9]} />);

    const spans = Array.from(container.querySelectorAll('[title]')) as HTMLElement[];
    expect(spans).toHaveLength(2);
    expect(spans[0].style.gridColumn).toBe('5 / 6');
    expect(spans[0].title).toBe('встреча — диалоговый юнит');
    expect(spans[1].style.gridColumn).toBe('9 / 10');
    expect(spans[1].title).toBe('якорный бит');
  });

  it('кастомные подсказки заменяют дефолтные', () => {
    const { container } = render(
      <ScheduleTrack label="Асель" presence={[{ from: 1, to: 2 }]} meetings={[]} anchors={[]} presenceTip="занята" />,
    );

    const span = container.querySelector('[title]') as HTMLElement;
    expect(span.title).toBe('занята');
  });

  it('число слотов и ширина подписи пробрасываются в стили грида', () => {
    const { container } = render(<ScheduleTrack label="Асель" slots={12} labelWidth={90} width={400} />);

    const root = container.firstChild as HTMLElement;
    expect(root.style.width).toBe('400px');

    const label = screen.getByText('Асель') as HTMLElement;
    expect(label.style.width).toBe('90px');

    const grid = label.nextSibling as HTMLElement;
    expect(grid.style.gridTemplateColumns).toBe('repeat(12, 1fr)');
  });

  it('без слотов не рисует ни одного спана', () => {
    const { container } = render(<ScheduleTrack label="Асель" presence={[]} meetings={[]} anchors={[]} />);

    expect(container.querySelectorAll('[title]').length).toBe(0);
  });
});
