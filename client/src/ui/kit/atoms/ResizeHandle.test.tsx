/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import ResizeHandle, { type ResizeHandleOrientation } from './ResizeHandle';

// jsdom не знает PointerEvent — без шима fireEvent.pointerDown теряет clientX/clientY/pointerId.
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

const ORIENTATIONS: ResizeHandleOrientation[] = ['vertical', 'horizontal'];

describe.each(ORIENTATIONS)('ResizeHandle, ориентация %s', orientation => {
  it('доступен как role=separator с корректной aria-ориентацией', () => {
    render(<ResizeHandle orientation={orientation} split={40} />);

    const handle = screen.getByRole('separator');
    expect(handle.getAttribute('aria-orientation')).toBe(orientation);
    expect(handle.getAttribute('aria-valuenow')).toBe('40');
    expect(handle.getAttribute('aria-valuemin')).toBe('15');
    expect(handle.getAttribute('aria-valuemax')).toBe('85');
    expect(handle.getAttribute('tabindex')).toBe('0');
  });
});

describe('ResizeHandle, ориентация визуально отличает класс корня', () => {
  it('vertical и horizontal получают разные классы', () => {
    const { container: vertical } = render(<ResizeHandle orientation="vertical" />);
    const verticalClass = vertical.firstElementChild?.className ?? '';
    cleanup();

    const { container: horizontal } = render(<ResizeHandle orientation="horizontal" />);
    const horizontalClass = horizontal.firstElementChild?.className ?? '';

    expect(horizontalClass).not.toBe(verticalClass);
  });
});

describe('ResizeHandle, значение по умолчанию', () => {
  it('без пропа split берёт 50', () => {
    render(<ResizeHandle />);

    expect(screen.getByRole('separator').getAttribute('aria-valuenow')).toBe('50');
  });
});

describe('ResizeHandle, клавиатура', () => {
  it('вертикальный: стрелка вправо увеличивает split на 2 и вызывает onResize', () => {
    const onResize = vi.fn();
    render(<ResizeHandle orientation="vertical" split={50} onResize={onResize} />);

    const handle = screen.getByRole('separator');
    fireEvent.keyDown(handle, { key: 'ArrowRight' });

    expect(onResize).toHaveBeenCalledWith(52);
    expect(handle.getAttribute('aria-valuenow')).toBe('52');
  });

  it('вертикальный: стрелка влево уменьшает split на 2', () => {
    const onResize = vi.fn();
    render(<ResizeHandle orientation="vertical" split={50} onResize={onResize} />);

    fireEvent.keyDown(screen.getByRole('separator'), { key: 'ArrowLeft' });

    expect(onResize).toHaveBeenCalledWith(48);
  });

  it('горизонтальный: вертикальные стрелки двигают split, горизонтальные — игнорируются', () => {
    const onResize = vi.fn();
    render(<ResizeHandle orientation="horizontal" split={50} onResize={onResize} />);

    const handle = screen.getByRole('separator');
    fireEvent.keyDown(handle, { key: 'ArrowRight' });
    expect(onResize).not.toHaveBeenCalled();

    fireEvent.keyDown(handle, { key: 'ArrowDown' });
    expect(onResize).toHaveBeenCalledWith(52);
  });

  it('не уходит ниже 15', () => {
    render(<ResizeHandle split={15} />);

    fireEvent.keyDown(screen.getByRole('separator'), { key: 'ArrowLeft' });

    expect(screen.getByRole('separator').getAttribute('aria-valuenow')).toBe('15');
  });

  it('не уходит выше 85', () => {
    render(<ResizeHandle split={85} />);

    fireEvent.keyDown(screen.getByRole('separator'), { key: 'ArrowRight' });

    expect(screen.getByRole('separator').getAttribute('aria-valuenow')).toBe('85');
  });

  it('получает фокус по клавиатуре (для :focus-visible через CSS)', () => {
    render(<ResizeHandle />);

    const handle = screen.getByRole('separator');
    (handle as HTMLElement).focus();

    expect(document.activeElement).toBe(handle);
  });
});

describe('ResizeHandle, указатель', () => {
  it('вертикальный: перетаскивание замеряет родительский бокс и вызывает onResize', () => {
    const onResize = vi.fn();
    const { container } = render(<ResizeHandle orientation="vertical" split={50} onResize={onResize} />);

    vi.spyOn(container, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      right: 200,
      top: 0,
      bottom: 100,
      width: 200,
      height: 100,
      x: 0,
      y: 0,
      toJSON: () => {},
    } as DOMRect);

    const handle = screen.getByRole('separator');
    fireEvent.pointerDown(handle, { clientX: 60, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 60, clientY: 0, pointerId: 1 });

    expect(onResize).toHaveBeenCalledWith(30);
    expect(handle.getAttribute('aria-valuenow')).toBe('30');
  });

  it('без нажатия pointermove ничего не меняет', () => {
    const onResize = vi.fn();
    render(<ResizeHandle orientation="vertical" split={50} onResize={onResize} />);

    fireEvent.pointerMove(screen.getByRole('separator'), { clientX: 999, clientY: 999, pointerId: 1 });

    expect(onResize).not.toHaveBeenCalled();
  });

  it('после pointerup перестаёт реагировать на движение', () => {
    const onResize = vi.fn();
    const { container } = render(<ResizeHandle orientation="vertical" split={50} onResize={onResize} />);

    vi.spyOn(container, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      right: 200,
      top: 0,
      bottom: 100,
      width: 200,
      height: 100,
      x: 0,
      y: 0,
      toJSON: () => {},
    } as DOMRect);

    const handle = screen.getByRole('separator');
    fireEvent.pointerDown(handle, { clientX: 60, clientY: 0, pointerId: 1 });
    fireEvent.pointerUp(handle, { pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 180, clientY: 0, pointerId: 1 });

    expect(onResize).not.toHaveBeenCalled();
  });
});
