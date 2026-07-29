/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import SfxTimeline, { type SfxTimelineClip } from './SfxTimeline';

afterEach(cleanup);

const CLIPS: SfxTimelineClip[] = [
  { label: 'скрип досок', left: 12, width: 90, bound: true },
  { label: 'шаги', left: 55, width: 70, bound: false },
];

describe('SfxTimeline', () => {
  it('показывает подписи всех клипов дорожки', () => {
    render(<SfxTimeline clips={CLIPS} />);

    expect(screen.getByText('скрип досок')).toBeTruthy();
    expect(screen.getByText('шаги')).toBeTruthy();
  });

  it('без onClipClick клипы не кликабельны', () => {
    render(<SfxTimeline clips={CLIPS} />);

    expect(screen.queryByRole('button', { name: 'скрип досок' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'шаги' })).toBeNull();
  });

  it('с onClipClick каждый клип — кнопка, зовущая колбэк со своим индексом', () => {
    const onClipClick = vi.fn();
    render(<SfxTimeline clips={CLIPS} onClipClick={onClipClick} />);

    (screen.getByRole('button', { name: 'скрип досок' }) as HTMLButtonElement).click();
    expect(onClipClick).toHaveBeenCalledWith(0);

    (screen.getByRole('button', { name: 'шаги' }) as HTMLButtonElement).click();
    expect(onClipClick).toHaveBeenCalledWith(1);
    expect(onClipClick).toHaveBeenCalledTimes(2);
  });

  it('привязанный клип получает тонированную подложку, обычный — нет', () => {
    render(<SfxTimeline clips={CLIPS} onClipClick={() => {}} />);

    // clipSlot = frameLayer(<button>) [+ fillLayer с ToneSurface, если клип привязан].
    const boundButton = screen.getByRole('button', { name: 'скрип досок' });
    const boundSlot = boundButton.closest('span')?.parentElement as HTMLElement;
    expect(boundSlot.children.length).toBe(2);

    const plainButton = screen.getByRole('button', { name: 'шаги' });
    const plainSlot = plainButton.closest('span')?.parentElement as HTMLElement;
    expect(plainSlot.children.length).toBe(1);
  });

  it('плейхед виден по умолчанию и позиционирован по проценту', () => {
    const { container } = render(<SfxTimeline clips={CLIPS} playhead={70} />);

    const hidden = Array.from(container.querySelectorAll('[aria-hidden="true"]')) as HTMLElement[];
    const atPosition = hidden.find(el => el.style.left === '70%');
    expect(atPosition).toBeTruthy();
  });

  it('плейхед скрыт при отрицательном значении', () => {
    const { container } = render(<SfxTimeline clips={CLIPS} playhead={-1} />);

    const hidden = Array.from(container.querySelectorAll('[aria-hidden="true"]')) as HTMLElement[];
    const atNegative = hidden.find(el => el.style.left === '-1%');
    expect(atNegative).toBeUndefined();
  });

  it('выбранный клип помечается через selected по индексу', () => {
    render(<SfxTimeline clips={CLIPS} selected={0} onClipClick={() => {}} />);

    const selectedButton = screen.getByRole('button', { name: 'скрип досок' }) as HTMLButtonElement;
    const otherButton = screen.getByRole('button', { name: 'шаги' }) as HTMLButtonElement;
    expect(selectedButton.className).not.toBe(otherButton.className);
  });
});
