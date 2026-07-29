/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import ResizeHandle, { NUDGE_STEP, NUDGE_STEP_FAST, type ResizeHandleOrientation } from './ResizeHandle';

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
  it('доступен как role=separator с корректной aria-ориентацией и подписью', () => {
    render(<ResizeHandle orientation={orientation} label="Ширина иерархии" valueNow={258} />);

    const handle = screen.getByRole('separator');
    expect(handle.getAttribute('aria-orientation')).toBe(orientation);
    expect(handle.getAttribute('aria-label')).toBe('Ширина иерархии');
    expect(handle.getAttribute('aria-valuenow')).toBe('258');
    expect(handle.getAttribute('tabindex')).toBe('0');
  });
});

describe('ResizeHandle, размером не владеет', () => {
  it('без valueNow не выставляет aria-valuenow — размер знает только механизм', () => {
    render(<ResizeHandle />);

    expect(screen.getByRole('separator').hasAttribute('aria-valuenow')).toBe(false);
  });

  it('перетаскивание не меняет собственный aria-valuenow: значение приходит снаружи', () => {
    render(<ResizeHandle orientation="vertical" valueNow={258} />);

    const handle = screen.getByRole('separator');
    fireEvent.pointerDown(handle, { clientX: 100, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 160, clientY: 0, pointerId: 1 });

    expect(handle.getAttribute('aria-valuenow')).toBe('258');
  });

  it('vertical и horizontal получают разные классы', () => {
    const { container: vertical } = render(<ResizeHandle orientation="vertical" />);
    const verticalClass = vertical.firstElementChild?.className ?? '';
    cleanup();

    const { container: horizontal } = render(<ResizeHandle orientation="horizontal" />);

    expect(horizontal.firstElementChild?.className ?? '').not.toBe(verticalClass);
  });

  it('пробрасывает className потребителя — раскладка остаётся за механизмом', () => {
    const { container } = render(<ResizeHandle className="seam" />);

    expect(container.firstElementChild?.className).toContain('seam');
  });
});

describe('ResizeHandle, указатель', () => {
  it('вертикальный: отдаёт дельту от точки нажатия в пикселях', () => {
    const onDrag = vi.fn();
    const onDragStart = vi.fn();
    render(<ResizeHandle orientation="vertical" onDrag={onDrag} onDragStart={onDragStart} />);

    const handle = screen.getByRole('separator');
    fireEvent.pointerDown(handle, { clientX: 100, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 160, clientY: 0, pointerId: 1 });

    expect(onDragStart).toHaveBeenCalledTimes(1);
    expect(onDrag).toHaveBeenCalledWith(60);
  });

  it('дельта отсчитывается от нажатия, а не от предыдущего кадра', () => {
    const onDrag = vi.fn();
    render(<ResizeHandle orientation="vertical" onDrag={onDrag} />);

    const handle = screen.getByRole('separator');
    fireEvent.pointerDown(handle, { clientX: 100, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 120, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 150, clientY: 0, pointerId: 1 });

    expect(onDrag).toHaveBeenNthCalledWith(1, 20);
    expect(onDrag).toHaveBeenNthCalledWith(2, 50);
  });

  it('горизонтальный: считает по вертикальной оси', () => {
    const onDrag = vi.fn();
    render(<ResizeHandle orientation="horizontal" onDrag={onDrag} />);

    const handle = screen.getByRole('separator');
    fireEvent.pointerDown(handle, { clientX: 0, clientY: 200, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 999, clientY: 170, pointerId: 1 });

    expect(onDrag).toHaveBeenCalledWith(-30);
  });

  it('без нажатия pointermove ничего не отдаёт', () => {
    const onDrag = vi.fn();
    render(<ResizeHandle orientation="vertical" onDrag={onDrag} />);

    fireEvent.pointerMove(screen.getByRole('separator'), { clientX: 999, clientY: 999, pointerId: 1 });

    expect(onDrag).not.toHaveBeenCalled();
  });

  it('после pointerup перестаёт реагировать на движение и зовёт onDragEnd', () => {
    const onDrag = vi.fn();
    const onDragEnd = vi.fn();
    render(<ResizeHandle orientation="vertical" onDrag={onDrag} onDragEnd={onDragEnd} />);

    const handle = screen.getByRole('separator');
    fireEvent.pointerDown(handle, { clientX: 100, clientY: 0, pointerId: 1 });
    fireEvent.pointerUp(handle, { pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 180, clientY: 0, pointerId: 1 });

    expect(onDragEnd).toHaveBeenCalledTimes(1);
    expect(onDrag).not.toHaveBeenCalled();
  });

  it('pointercancel тоже завершает перетаскивание — иначе полоска залипает', () => {
    const onDrag = vi.fn();
    const onDragEnd = vi.fn();
    render(<ResizeHandle orientation="vertical" onDrag={onDrag} onDragEnd={onDragEnd} />);

    const handle = screen.getByRole('separator');
    fireEvent.pointerDown(handle, { clientX: 100, clientY: 0, pointerId: 1 });
    fireEvent.pointerCancel(handle, { pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 180, clientY: 0, pointerId: 1 });

    expect(onDragEnd).toHaveBeenCalledTimes(1);
    expect(onDrag).not.toHaveBeenCalled();
  });

  it('работает без pointer capture — браузер может его не дать', () => {
    const onDrag = vi.fn();
    render(<ResizeHandle orientation="vertical" onDrag={onDrag} />);

    const handle = screen.getByRole('separator') as HTMLElement;
    handle.setPointerCapture = () => {
      throw new Error('no capture');
    };

    fireEvent.pointerDown(handle, { clientX: 100, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 130, clientY: 0, pointerId: 1 });

    expect(onDrag).toHaveBeenCalledWith(30);
  });
});

describe('ResizeHandle, клавиатура и сброс', () => {
  it('вертикальный: стрелки отдают ±16px, Shift ускоряет до 48px', () => {
    const onNudge = vi.fn();
    render(<ResizeHandle orientation="vertical" onNudge={onNudge} />);

    const handle = screen.getByRole('separator');
    fireEvent.keyDown(handle, { key: 'ArrowRight' });
    fireEvent.keyDown(handle, { key: 'ArrowLeft' });
    fireEvent.keyDown(handle, { key: 'ArrowRight', shiftKey: true });

    expect(onNudge).toHaveBeenNthCalledWith(1, NUDGE_STEP);
    expect(onNudge).toHaveBeenNthCalledWith(2, -NUDGE_STEP);
    expect(onNudge).toHaveBeenNthCalledWith(3, NUDGE_STEP_FAST);
  });

  it('горизонтальный: реагирует на вертикальные стрелки, горизонтальные игнорирует', () => {
    const onNudge = vi.fn();
    render(<ResizeHandle orientation="horizontal" onNudge={onNudge} />);

    const handle = screen.getByRole('separator');
    fireEvent.keyDown(handle, { key: 'ArrowRight' });
    expect(onNudge).not.toHaveBeenCalled();

    fireEvent.keyDown(handle, { key: 'ArrowDown' });
    expect(onNudge).toHaveBeenCalledWith(NUDGE_STEP);
  });

  it('двойной клик зовёт onReset', () => {
    const onReset = vi.fn();
    render(<ResizeHandle onReset={onReset} />);

    fireEvent.doubleClick(screen.getByRole('separator'));

    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it('получает фокус по клавиатуре (для :focus-visible через CSS)', () => {
    render(<ResizeHandle />);

    const handle = screen.getByRole('separator');
    (handle as HTMLElement).focus();

    expect(document.activeElement).toBe(handle);
  });
});
