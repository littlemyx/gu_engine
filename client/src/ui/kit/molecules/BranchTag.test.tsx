/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import BranchTag, { type BranchTagTone } from './BranchTag';

afterEach(cleanup);

const TONES: BranchTagTone[] = ['обычная', 'активная', 'тихая'];

describe.each(TONES)('BranchTag, тон %s', tone => {
  it('показывает название ветки', () => {
    render(<BranchTag label="ПРИМИРЕНИЕ" tone={tone} />);

    expect(screen.getByText('ПРИМИРЕНИЕ')).toBeTruthy();
  });

  it('не рендерит кнопку — метка не кликабельна', () => {
    render(<BranchTag label="ПРИМИРЕНИЕ" tone={tone} />);

    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('BranchTag, процент прохождения', () => {
  it('без percent счётчик не рисуется', () => {
    render(<BranchTag label="ПРИМИРЕНИЕ" />);

    expect(screen.queryByText('·')).toBeNull();
    expect(screen.queryByText(/%/)).toBeNull();
  });

  it('с percent показывает разделитель и значение', () => {
    render(<BranchTag label="ПРИМИРЕНИЕ" percent={68} />);

    expect(screen.getByText('·')).toBeTruthy();
    expect(screen.getByText('68%')).toBeTruthy();
  });

  it('percent=0 всё ещё считается заданным и показывается', () => {
    render(<BranchTag label="ФИНАЛ" percent={0} />);

    expect(screen.getByText('0%')).toBeTruthy();
  });
});

describe('BranchTag, тоны различаются визуально', () => {
  it('обычная и активная получают разный класс контейнера', () => {
    const { container: plain } = render(<BranchTag label="А" tone="обычная" />);
    const plainClass = plain.firstElementChild?.className ?? '';
    cleanup();

    const { container: active } = render(<BranchTag label="А" tone="активная" />);
    expect(active.firstElementChild?.className).not.toBe(plainClass);
  });
});
