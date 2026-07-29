/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import IssueRoute, { type IssueRouteLine } from './IssueRoute';

afterEach(cleanup);

const LINES: IssueRouteLine[] = [
  { text: 'маршрут: qa → зона Проза →' },
  { text: 'dialogue_units / unit_kira_s2_pier' },
  { text: 'фидбек уедет в previousIssues дубля' },
];

describe('IssueRoute', () => {
  it('показывает каждую строку маршрута', () => {
    render(<IssueRoute lines={LINES} />);

    expect(screen.getByText(/dialogue_units \/ unit_kira_s2_pier/)).toBeTruthy();
    expect(screen.getByText(/фидбек уедет в previousIssues дубля/)).toBeTruthy();
  });

  it('разбивает строку со стрелками на сегменты и декоративные глифы-стрелки', () => {
    const { container } = render(<IssueRoute lines={[{ text: 'маршрут: qa → зона Проза →' }]} />);

    const arrows = Array.from(container.querySelectorAll('[aria-hidden="true"]')).filter(
      node => node.textContent === '→',
    );
    expect(arrows).toHaveLength(2);
    expect(screen.getByText(/маршрут: qa/)).toBeTruthy();
    expect(screen.getByText(/зона Проза/)).toBeTruthy();
  });

  it('строка без стрелок не несёт декоративных глифов', () => {
    const { container } = render(<IssueRoute lines={[{ text: 'dialogue_units / unit_kira_s2_pier' }]} />);

    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(0);
  });

  it('рендерит по строке на элемент lines', () => {
    const { container } = render(<IssueRoute lines={LINES} />);

    expect(container.firstElementChild?.children).toHaveLength(LINES.length);
  });

  it('на тёмном хроме получает отдельный класс', () => {
    const { container: light } = render(<IssueRoute lines={LINES} />);
    const lightClass = light.querySelector('span')?.className ?? '';
    cleanup();

    const { container: dark } = render(<IssueRoute lines={LINES} onDark />);
    expect(dark.querySelector('span')?.className).not.toBe(lightClass);
  });

  it('не рендерит интерактивных элементов', () => {
    render(<IssueRoute lines={LINES} />);

    expect(screen.queryByRole('button')).toBeNull();
  });
});
