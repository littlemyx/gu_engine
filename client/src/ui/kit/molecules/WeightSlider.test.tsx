/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import WeightSlider from './WeightSlider';

// jsdom не знает PointerEvent — без шима fireEvent.pointerDown теряет clientX/pointerId.
beforeAll(() => {
  if (typeof (window as unknown as { PointerEvent?: unknown }).PointerEvent === 'undefined') {
    class PointerEventPolyfill extends MouseEvent {
      pointerId?: number;
      constructor(
        type: string,
        params: { pointerId?: number; clientX?: number; clientY?: number; bubbles?: boolean } = {},
      ) {
        super(type, params);
        this.pointerId = params.pointerId;
      }
    }
    (window as unknown as { PointerEvent: unknown }).PointerEvent = PointerEventPolyfill;
  }
});

afterEach(cleanup);

describe('WeightSlider', () => {
  it('показывает лейбл и значение в шапке', () => {
    render(<WeightSlider label="агрессия" value={40} />);

    expect(screen.getByText('агрессия')).toBeTruthy();
    expect(screen.getByText('40')).toBeTruthy();
  });

  it('valueText переопределяет отображаемую строку значения', () => {
    render(<WeightSlider label="громкость" value={40} valueText="0.40" />);

    expect(screen.getByText('0.40')).toBeTruthy();
    expect(screen.queryByText('40')).toBeNull();
  });

  it('трек доступен как role=slider с корректными aria-атрибутами', () => {
    render(<WeightSlider label="агрессия" value={65} />);

    const slider = screen.getByRole('slider');
    expect(slider.getAttribute('aria-valuemin')).toBe('0');
    expect(slider.getAttribute('aria-valuemax')).toBe('100');
    expect(slider.getAttribute('aria-valuenow')).toBe('65');
    expect(slider.getAttribute('aria-label')).toBe('агрессия');
  });

  it('без value по умолчанию встаёт на 50', () => {
    render(<WeightSlider label="агрессия" />);

    expect(screen.getByText('50')).toBeTruthy();
    expect(screen.getByRole('slider').getAttribute('aria-valuenow')).toBe('50');
  });

  it('зажимает значение в диапазон 0–100', () => {
    render(<WeightSlider label="агрессия" value={140} />);
    expect(screen.getByRole('slider').getAttribute('aria-valuenow')).toBe('100');

    cleanup();

    render(<WeightSlider label="агрессия" value={-20} />);
    expect(screen.getByRole('slider').getAttribute('aria-valuenow')).toBe('0');
  });

  it('перетаскивание по позиции клика обновляет значение в шапке и вызывает onChange', () => {
    const onChange = vi.fn();
    render(<WeightSlider label="агрессия" value={0} onChange={onChange} />);

    const slider = screen.getByRole('slider');
    vi.spyOn(slider, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      right: 100,
      top: 0,
      bottom: 6,
      width: 100,
      height: 6,
      x: 0,
      y: 0,
      toJSON: () => {},
    } as DOMRect);

    fireEvent.pointerDown(slider, { clientX: 40, pointerId: 1 });

    expect(onChange).toHaveBeenCalledWith(40);
    expect(slider.getAttribute('aria-valuenow')).toBe('40');
    expect(screen.getByText('40')).toBeTruthy();
  });

  it('клавиатура вправо увеличивает значение на 1', () => {
    const onChange = vi.fn();
    render(<WeightSlider label="агрессия" value={50} onChange={onChange} />);

    const slider = screen.getByRole('slider');
    fireEvent.keyDown(slider, { key: 'ArrowRight' });

    expect(onChange).toHaveBeenCalledWith(51);
    expect(screen.getByText('51')).toBeTruthy();
  });

  it('disabled ставит tabIndex -1 и не реагирует на клавиатуру', () => {
    const onChange = vi.fn();
    render(<WeightSlider label="агрессия" value={50} onChange={onChange} disabled />);

    const slider = screen.getByRole('slider');
    expect(slider.getAttribute('tabindex')).toBe('-1');
    expect(slider.getAttribute('aria-disabled')).toBe('true');

    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('на тёмном хроме помечает шапку классом onDark', () => {
    render(<WeightSlider label="агрессия" value={40} onDark />);

    const label = screen.getByText('агрессия');
    expect(label.className).toMatch(/onDark/);

    const value = screen.getByText('40');
    expect(value.className).toMatch(/onDark/);
  });

  it('на светлом хроме (по умолчанию) не помечает шапку классом onDark', () => {
    render(<WeightSlider label="агрессия" value={40} />);

    const label = screen.getByText('агрессия');
    expect(label.className).not.toMatch(/onDark/);
  });
});
