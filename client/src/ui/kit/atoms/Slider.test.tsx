/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import Slider, { type SliderSize } from './Slider';

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

const SIZES: SliderSize[] = ['regular', 'mini'];

describe.each(SIZES)('Slider, размер %s', size => {
  it('показывает подпись и значение', () => {
    render(<Slider label="вес" value={30} size={size} />);

    expect(screen.getByText('вес')).toBeTruthy();
    expect(screen.getByText('30')).toBeTruthy();
  });

  it('трек доступен как role=slider с корректными aria-атрибутами', () => {
    render(<Slider label="вес" value={65} size={size} />);

    const slider = screen.getByRole('slider');
    expect(slider.getAttribute('aria-valuemin')).toBe('0');
    expect(slider.getAttribute('aria-valuemax')).toBe('100');
    expect(slider.getAttribute('aria-valuenow')).toBe('65');
    expect(slider.getAttribute('aria-label')).toBe('вес');
  });
});

describe('Slider, размер визуально отличает трек', () => {
  it('mini и regular получают разные классы корня', () => {
    const { container: regular } = render(<Slider label="вес" size="regular" />);
    const regularClass = regular.firstElementChild?.className ?? '';
    cleanup();

    const { container: mini } = render(<Slider label="вес" size="mini" />);
    const miniClass = mini.firstElementChild?.className ?? '';

    expect(miniClass).not.toBe(regularClass);
  });
});

describe('Slider, скрытая подпись', () => {
  it('showLabel=false не рендерит строку подписи и значения', () => {
    render(<Slider label="вес" value={40} showLabel={false} />);

    expect(screen.queryByText('вес')).toBeNull();
    expect(screen.queryByText('40')).toBeNull();
    expect(screen.getByRole('slider')).toBeTruthy();
  });
});

describe('Slider, клавиатура', () => {
  it('стрелка вправо увеличивает значение на 1 и вызывает onChange', () => {
    const onChange = vi.fn();
    render(<Slider label="вес" value={50} onChange={onChange} />);

    const slider = screen.getByRole('slider');
    fireEvent.keyDown(slider, { key: 'ArrowRight' });

    expect(onChange).toHaveBeenCalledWith(51);
    expect(slider.getAttribute('aria-valuenow')).toBe('51');
  });

  it('Shift+стрелка влево уменьшает значение на 10', () => {
    const onChange = vi.fn();
    render(<Slider label="вес" value={50} onChange={onChange} />);

    const slider = screen.getByRole('slider');
    fireEvent.keyDown(slider, { key: 'ArrowLeft', shiftKey: true });

    expect(onChange).toHaveBeenCalledWith(40);
  });

  it('не уходит ниже 0', () => {
    render(<Slider label="вес" value={0} />);

    const slider = screen.getByRole('slider');
    fireEvent.keyDown(slider, { key: 'ArrowLeft' });

    expect(slider.getAttribute('aria-valuenow')).toBe('0');
  });

  it('не уходит выше 100', () => {
    render(<Slider label="вес" value={100} />);

    const slider = screen.getByRole('slider');
    fireEvent.keyDown(slider, { key: 'ArrowRight' });

    expect(slider.getAttribute('aria-valuenow')).toBe('100');
  });

  it('получает фокус по клавиатуре (для focus-visible через CSS)', () => {
    render(<Slider label="вес" value={50} />);

    const slider = screen.getByRole('slider');
    slider.focus();

    expect(document.activeElement).toBe(slider);
  });
});

describe('Slider, указатель', () => {
  it('перетаскивание по позиции клика вызывает onChange', () => {
    const onChange = vi.fn();
    render(<Slider label="вес" value={0} onChange={onChange} />);

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
  });
});

describe('Slider, disabled', () => {
  it('получает tabIndex -1 и aria-disabled', () => {
    render(<Slider label="вес" value={50} disabled />);

    const slider = screen.getByRole('slider');
    expect(slider.getAttribute('tabindex')).toBe('-1');
    expect(slider.getAttribute('aria-disabled')).toBe('true');
  });

  it('не реагирует на клавиатуру', () => {
    const onChange = vi.fn();
    render(<Slider label="вес" value={50} onChange={onChange} disabled />);

    const slider = screen.getByRole('slider');
    fireEvent.keyDown(slider, { key: 'ArrowRight' });

    expect(onChange).not.toHaveBeenCalled();
    expect(slider.getAttribute('aria-valuenow')).toBe('50');
  });

  it('не реагирует на указатель', () => {
    const onChange = vi.fn();
    render(<Slider label="вес" value={50} onChange={onChange} disabled />);

    const slider = screen.getByRole('slider');
    fireEvent.pointerDown(slider, { clientX: 90, pointerId: 1 });

    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('Slider, на тёмном', () => {
  it('получает отдельный класс корня', () => {
    const { container: light } = render(<Slider label="вес" />);
    const lightClass = light.firstElementChild?.className ?? '';
    cleanup();

    const { container: dark } = render(<Slider label="вес" onDark />);
    const darkClass = dark.firstElementChild?.className ?? '';

    expect(darkClass).not.toBe(lightClass);
  });
});
