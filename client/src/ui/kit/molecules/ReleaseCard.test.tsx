/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import ReleaseCard, { type ReleaseCardTone } from './ReleaseCard';

afterEach(cleanup);

const TONES: ReleaseCardTone[] = ['accent', 'обычная'];

describe.each(TONES)('ReleaseCard, тон %s', tone => {
  it('показывает заголовок', () => {
    render(<ReleaseCard title="Релиз v2 · 14 июля · иммутабельный" tone={tone} />);

    expect(screen.getByText('Релиз v2 · 14 июля · иммутабельный')).toBeTruthy();
  });
});

it('без badge бейдж не рисуется', () => {
  render(<ReleaseCard title="Релиз v2" />);

  expect(screen.queryByText('QA #5 ✓')).toBeNull();
});

it('с badge рисует подпись бейджа', () => {
  render(<ReleaseCard title="Релиз v2" badge="QA #5 ✓" />);

  expect(screen.getByText('QA #5 ✓')).toBeTruthy();
});

it('рисует каждую строку статистики', () => {
  render(<ReleaseCard title="Релиз v2" stats={['слотов 21', 'юнитов 44', 'бандл 412 КБ']} />);

  expect(screen.getByText('слотов 21')).toBeTruthy();
  expect(screen.getByText('юнитов 44')).toBeTruthy();
  expect(screen.getByText('бандл 412 КБ')).toBeTruthy();
});

it('без stats строка статистики не рисуется', () => {
  const { container } = render(<ReleaseCard title="Релиз v2" />);

  expect(container.textContent).toBe('Релиз v2');
});

it('рисует children снизу карточки', () => {
  render(
    <ReleaseCard title="Релиз v2">
      <span>действия релиза</span>
    </ReleaseCard>,
  );

  expect(screen.getByText('действия релиза')).toBeTruthy();
});

it('без onClick рендерится нерактивным контейнером', () => {
  render(<ReleaseCard title="Релиз v2" />);

  expect(screen.queryByRole('button')).toBeNull();
});

it('с onClick рендерится кнопкой и вызывает колбэк по клику', () => {
  const onClick = vi.fn();
  render(<ReleaseCard title="Релиз v2" onClick={onClick} />);

  const trigger = screen.getByRole('button') as HTMLButtonElement;
  expect(trigger.tagName).toBe('BUTTON');
  expect(trigger.type).toBe('button');

  trigger.click();
  expect(onClick).toHaveBeenCalledTimes(1);
});
