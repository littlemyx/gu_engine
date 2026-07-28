/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import Chip, { type ChipKind } from './Chip';

afterEach(cleanup);

const KINDS: ChipKind[] = ['tinted', 'outline', 'removable', 'add', 'error', 'warn'];

describe.each(KINDS)('Chip, вид %s', kind => {
  it('показывает подпись', () => {
    render(<Chip label="детектив" kind={kind} />);

    expect(screen.getByText(/детектив/)).toBeTruthy();
  });

  it('на тёмном получает отдельный класс', () => {
    const { container: light } = render(<Chip label="детектив" kind={kind} />);
    const lightClass = light.firstElementChild?.className ?? '';
    cleanup();

    const { container: dark } = render(<Chip label="детектив" kind={kind} onDark />);
    expect(dark.firstElementChild?.className).not.toBe(lightClass);
  });
});

describe('Chip, интерактивность', () => {
  it('add — кнопка с плюсом, вызывает onClick', () => {
    const onClick = vi.fn();
    render(<Chip label="жанр" kind="add" onClick={onClick} />);

    const btn = screen.getByRole('button');
    expect(btn.textContent).toContain('+');
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('removable несёт крестик с внятным именем и вызывает onRemove', () => {
    const onRemove = vi.fn();
    render(<Chip label="детектив" kind="removable" onRemove={onRemove} />);

    const remove = screen.getByRole('button', { name: 'Убрать детектив' });
    fireEvent.click(remove);
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('прочие виды кнопок не содержат', () => {
    render(<Chip label="детектив" kind="tinted" />);

    expect(screen.queryByRole('button')).toBeNull();
  });
});
