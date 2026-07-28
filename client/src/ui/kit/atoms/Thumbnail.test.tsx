/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import Thumbnail, { type ThumbnailKind } from './Thumbnail';

afterEach(cleanup);

const KINDS: ThumbnailKind[] = ['sprite', 'location', 'stub'];

describe.each(KINDS)('Thumbnail, вид %s', kind => {
  it('показывает подпись', () => {
    render(<Thumbnail kind={kind} label="идл" />);

    expect(screen.getByText(/идл/)).toBeTruthy();
  });

  it('на тёмном получает отдельный класс', () => {
    const { container: light } = render(<Thumbnail kind={kind} label="идл" />);
    const lightClass = light.firstElementChild?.className ?? '';
    cleanup();

    const { container: dark } = render(<Thumbnail kind={kind} label="идл" onDark />);
    expect(dark.firstElementChild?.className).not.toBe(lightClass);
  });

  it('без onClick рендерит некликабельный элемент', () => {
    render(<Thumbnail kind={kind} label="идл" />);

    expect(screen.queryByRole('button')).toBeNull();
  });

  it('с onClick рендерит кнопку и вызывает колбэк', () => {
    const onClick = vi.fn();
    render(<Thumbnail kind={kind} label="идл" onClick={onClick} />);

    const btn = screen.getByRole('button', { name: 'идл' });
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe('Thumbnail, размер', () => {
  it('спрайт и локация несут разный базовый размер при одном scale', () => {
    const { container: sprite } = render(<Thumbnail kind="sprite" label="идл" scale={1} />);
    const spriteEl = sprite.firstElementChild as HTMLElement;
    cleanup();

    const { container: location } = render(<Thumbnail kind="location" label="пирс" scale={1} />);
    const locationEl = location.firstElementChild as HTMLElement;

    expect(spriteEl.style.width).toBe('32px');
    expect(spriteEl.style.height).toBe('46px');
    expect(locationEl.style.width).toBe('56px');
    expect(locationEl.style.height).toBe('34px');
  });

  it('scale масштабирует размер пропорционально', () => {
    const { container } = render(<Thumbnail kind="sprite" label="идл" scale={2} />);
    const el = container.firstElementChild as HTMLElement;

    expect(el.style.width).toBe('64px');
    expect(el.style.height).toBe('92px');
  });
});

describe('Thumbnail, состояние selected', () => {
  it('selected меняет класс у спрайта/локации', () => {
    const { container: plain } = render(<Thumbnail kind="sprite" label="идл" />);
    const plainClass = plain.firstElementChild?.className ?? '';
    cleanup();

    const { container: selected } = render(<Thumbnail kind="sprite" label="идл" selected />);
    expect(selected.firstElementChild?.className).not.toBe(plainClass);
  });

  it('заглушка selected игнорирует — класс не меняется', () => {
    const { container: plain } = render(<Thumbnail kind="stub" label="+3" />);
    const plainClass = plain.firstElementChild?.className ?? '';
    cleanup();

    const { container: selected } = render(<Thumbnail kind="stub" label="+3" selected />);
    expect(selected.firstElementChild?.className).toBe(plainClass);
  });
});
