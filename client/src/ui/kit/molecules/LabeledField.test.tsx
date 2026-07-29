/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import LabeledField, { type LabeledFieldArrow } from './LabeledField';

afterEach(cleanup);

const ARROWS: LabeledFieldArrow[] = ['down', 'updown', 'none'];

describe.each(ARROWS)('LabeledField, стрелка %s', arrow => {
  it('рисует стрелку по варианту', () => {
    const { container } = render(<LabeledField label="Эпоха" arrow={arrow} />);

    const glyph = container.querySelector('[aria-hidden="true"]');
    if (arrow === 'none') {
      expect(glyph).toBeNull();
    } else {
      expect(glyph?.textContent).toBe(arrow === 'down' ? '▾' : '▴▾');
    }
  });
});

describe('LabeledField, частности', () => {
  it('показывает лейбл кикером', () => {
    render(<LabeledField label="Эпоха" />);

    expect(screen.getByText('Эпоха')).toBeTruthy();
  });

  it('добавляет «*» к обязательному полю', () => {
    render(<LabeledField label="Эпоха" required />);

    expect(screen.getByText('Эпоха *')).toBeTruthy();
  });

  it('несёт начальное значение в поле', () => {
    render(<LabeledField label="Эпоха" value="Современность" />);

    const input = screen.getByDisplayValue('Современность') as HTMLInputElement;
    expect(input.value).toBe('Современность');
  });

  it('вызывает onChange со значением поля', () => {
    const onChange = vi.fn();
    render(<LabeledField label="Эпоха" onChange={onChange} />);

    const input = document.querySelector('input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Средневековье' } });

    expect(onChange).toHaveBeenCalledWith('Средневековье');
  });

  it('показывает подсказку MutedText в обычном состоянии', () => {
    render(<LabeledField label="Эпоха" hint="можно оставить пустым" />);

    expect(screen.getByText('можно оставить пустым')).toBeTruthy();
  });

  it('без подсказки ничего не рисует под полем', () => {
    const { container } = render(<LabeledField label="Эпоха" />);

    const hint = container.querySelector('div:last-child');
    expect(container.textContent).not.toContain('обязательное поле');
    expect(hint).toBeTruthy();
  });

  it('в состоянии ошибки красит рамку поля', () => {
    render(<LabeledField label="Эпоха" error />);

    const input = document.querySelector('input') as HTMLInputElement;
    expect(input.className).toMatch(/error/);
  });

  it('в состоянии ошибки без hint и errorHint показывает фолбэк', () => {
    render(<LabeledField label="Эпоха" error />);

    expect(screen.getByText('обязательное поле')).toBeTruthy();
  });

  it('errorHint приоритетнее обычного hint в состоянии ошибки', () => {
    render(<LabeledField label="Эпоха" error hint="обычная подсказка" errorHint="без этого не посчитать слоты" />);

    expect(screen.getByText('без этого не посчитать слоты')).toBeTruthy();
    expect(screen.queryByText('обычная подсказка')).toBeNull();
  });

  it('в состоянии ошибки без значения показывает плейсхолдер «—»', () => {
    render(<LabeledField label="Эпоха" error />);

    const input = screen.getByPlaceholderText('—') as HTMLInputElement;
    expect(input.value).toBe('');
  });

  it('применяет ширину как inline-стиль', () => {
    const { container } = render(<LabeledField label="Эпоха" width={320} />);

    expect((container.firstChild as HTMLElement).style.width).toBe('320px');
  });
});
