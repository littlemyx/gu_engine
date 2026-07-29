/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import TraceCard, { type TraceCardKind } from './TraceCard';

afterEach(cleanup);

const KINDS: TraceCardKind[] = ['выбран', 'отклонён'];

describe.each(KINDS)('TraceCard, состояние %s', kind => {
  it('показывает id и meta', () => {
    render(<TraceCard id="enc_kira_pier" meta="салиенс 8.4" kind={kind} />);

    expect(screen.getByText('салиенс 8.4')).toBeTruthy();
    expect(
      screen.getByText(
        (_, node) => node?.tagName === 'SPAN' && node.textContent === `${kind === 'выбран' ? '✓' : '✗'} enc_kira_pier`,
      ),
    ).toBeTruthy();
  });

  it('без onClick рендерится нерактивным контейнером', () => {
    render(<TraceCard id="enc_kira_pier" meta="салиенс 8.4" kind={kind} />);

    expect(screen.queryByRole('button')).toBeNull();
  });

  it('с onClick рендерится кнопкой и вызывает колбэк по клику', () => {
    const onClick = vi.fn();
    render(<TraceCard id="enc_kira_pier" meta="салиенс 8.4" kind={kind} onClick={onClick} />);

    const trigger = screen.getByRole('button') as HTMLButtonElement;
    expect(trigger.tagName).toBe('BUTTON');
    expect(trigger.type).toBe('button');

    trigger.click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

it('по умолчанию kind — «выбран»', () => {
  render(<TraceCard id="enc_kira_pier" meta="салиенс 8.4" />);

  expect(
    screen.getByText((_, node) => node?.tagName === 'SPAN' && node.textContent === '✓ enc_kira_pier'),
  ).toBeTruthy();
});
