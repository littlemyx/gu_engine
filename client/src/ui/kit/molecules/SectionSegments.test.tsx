/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import SectionSegments, { type SectionSegmentsItem } from './SectionSegments';

afterEach(cleanup);

const SECTIONS: SectionSegmentsItem[] = [{ label: 'Акты' }, { label: 'Персонажи' }, { label: 'Мир' }];

describe('SectionSegments', () => {
  it('показывает все разделы и подсвечивает активный', () => {
    render(<SectionSegments sections={SECTIONS} active="Персонажи" onPick={() => {}} />);

    expect((screen.getByRole('button', { name: 'Акты' }) as HTMLButtonElement).className).not.toContain('selected');
    expect((screen.getByRole('button', { name: 'Персонажи' }) as HTMLButtonElement).className).toContain('selected');
    expect((screen.getByRole('button', { name: 'Мир' }) as HTMLButtonElement).className).not.toContain('selected');
  });

  it('по умолчанию активен первый раздел', () => {
    render(<SectionSegments sections={SECTIONS} onPick={() => {}} />);

    expect((screen.getByRole('button', { name: 'Акты' }) as HTMLButtonElement).className).toContain('selected');
  });

  it('клик по разделу зовёт onPick с его меткой', () => {
    const onPick = vi.fn();
    render(<SectionSegments sections={SECTIONS} active="Акты" onPick={onPick} />);

    fireEvent.click(screen.getByRole('button', { name: 'Мир' }));

    expect(onPick).toHaveBeenCalledWith('Мир');
  });

  it('без onPick разделы не кликабельны', () => {
    render(<SectionSegments sections={SECTIONS} active="Акты" />);

    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('Акты')).toBeTruthy();
    expect(screen.getByText('Персонажи')).toBeTruthy();
    expect(screen.getByText('Мир')).toBeTruthy();
  });
});
