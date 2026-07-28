/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import PanelSpine, { type PanelSpineSide } from './PanelSpine';

afterEach(cleanup);

const SIDES: PanelSpineSide[] = ['left', 'right'];

describe.each(SIDES)('PanelSpine, сторона %s', side => {
  it('показывает заголовок панели', () => {
    render(<PanelSpine title="Иерархия" side={side} onExpand={() => {}} />);

    expect(screen.getByRole('button', { name: 'Иерархия' })).toBeTruthy();
  });

  it('без onExpand рендерится неинтерактивным', () => {
    render(<PanelSpine title="Иерархия" side={side} />);

    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('Иерархия')).toBeTruthy();
  });
});

describe('PanelSpine, клик', () => {
  it('вызывает onExpand при клике', () => {
    const onExpand = vi.fn();
    render(<PanelSpine title="Партитура" onExpand={onExpand} />);

    fireEvent.click(screen.getByRole('button', { name: 'Партитура' }));
    expect(onExpand).toHaveBeenCalledTimes(1);
  });

  it('подсказка кнопки называет разворачиваемую панель', () => {
    render(<PanelSpine title="Инспектор" onExpand={() => {}} />);

    const btn = screen.getByRole('button', { name: 'Инспектор' }) as HTMLButtonElement;
    expect(btn.title).toBe('Развернуть панель «Инспектор»');
  });
});

describe('PanelSpine, notify', () => {
  it('notify=true рендерит на один скрытый элемент больше, чем notify=false', () => {
    const { container: withoutNotify } = render(<PanelSpine title="Карта мира" onExpand={() => {}} notify={false} />);
    const baseline = withoutNotify.querySelectorAll('span[aria-hidden="true"]').length;
    cleanup();

    const { container: withNotify } = render(<PanelSpine title="Карта мира" onExpand={() => {}} notify />);
    expect(withNotify.querySelectorAll('span[aria-hidden="true"]').length).toBe(baseline + 1);
  });
});

describe('PanelSpine, высота', () => {
  it('переносит height на кликабельный элемент', () => {
    render(<PanelSpine title="Иерархия" onExpand={() => {}} height={240} />);

    const btn = screen.getByRole('button', { name: 'Иерархия' }) as HTMLButtonElement;
    expect(btn.style.height).toBe('240px');
  });
});
