/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import CornerMarks, { type CornerMarksTone } from './CornerMarks';

afterEach(cleanup);

const TONES: CornerMarksTone[] = ['plain', 'accent'];

describe.each(TONES)('CornerMarks, тон %s', tone => {
  it('рисует ровно четыре репера и не съедает содержимое', () => {
    const { container } = render(
      <CornerMarks tone={tone}>
        <span>объект</span>
      </CornerMarks>,
    );

    expect(container.querySelectorAll('i').length).toBe(4);
    expect(screen.getByText('объект')).toBeTruthy();
  });

  it('реперы скрыты от скринридера', () => {
    const { container } = render(<CornerMarks tone={tone} />);

    const marks = [...container.querySelectorAll('i')];
    expect(marks.every(m => m.getAttribute('aria-hidden') === 'true')).toBe(true);
  });
});

describe('CornerMarks на тёмном', () => {
  it('получает отдельный класс, а не тот же, что на светлом', () => {
    const { container: light } = render(<CornerMarks />);
    const lightClass = light.firstElementChild?.className ?? '';
    cleanup();

    const { container: dark } = render(<CornerMarks onDark />);
    const darkClass = dark.firstElementChild?.className ?? '';

    expect(darkClass).not.toBe(lightClass);
  });
});
