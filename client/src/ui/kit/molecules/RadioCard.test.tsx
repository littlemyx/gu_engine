/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import RadioCard from './RadioCard';

afterEach(cleanup);

describe('RadioCard', () => {
  it('показывает заголовок и описание', () => {
    render(<RadioCard title="Пустой проект" desc="чистый бриф, генерация с нуля" />);

    expect(screen.getByText('Пустой проект')).toBeTruthy();
    expect(screen.getByText('чистый бриф, генерация с нуля')).toBeTruthy();
  });

  it('без onSelect — немой индикатор, а не кнопка', () => {
    render(<RadioCard title="Пустой проект" desc="описание" selected />);

    expect(screen.queryByRole('button')).toBeNull();

    const radio = screen.getByRole('radio');
    expect(radio.tagName).toBe('SPAN');
    expect(radio.getAttribute('aria-checked')).toBe('true');
  });

  it('невыбранная карточка сообщает aria-checked=false', () => {
    render(<RadioCard title="Из шаблона" desc="описание" selected={false} />);

    expect(screen.getByRole('radio').getAttribute('aria-checked')).toBe('false');
  });

  it('с onSelect рендерится кнопкой и вызывает колбэк по клику', () => {
    const onSelect = vi.fn();
    render(<RadioCard title="Пустой проект" desc="описание" selected={false} onSelect={onSelect} />);

    const radio = screen.getByRole('radio') as HTMLButtonElement;
    expect(radio.tagName).toBe('BUTTON');

    fireEvent.click(radio);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('выбранная карточка с onSelect остаётся кнопкой и помечена aria-checked=true', () => {
    render(<RadioCard title="Пустой проект" desc="описание" selected onSelect={() => {}} />);

    const radio = screen.getByRole('radio') as HTMLButtonElement;
    expect(radio.tagName).toBe('BUTTON');
    expect(radio.getAttribute('aria-checked')).toBe('true');
  });
});
