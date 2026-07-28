/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import PreviewStrip, { type PreviewStripKind } from './PreviewStrip';

afterEach(cleanup);

const KINDS: PreviewStripKind[] = ['sprite', 'location'];

describe.each(KINDS)('PreviewStrip, вид %s', kind => {
  it('показывает подпись каждой плитки', () => {
    render(<PreviewStrip kind={kind} tiles={[{ label: 'идл' }, { label: 'joy' }]} />);
    expect(screen.getByText('идл')).toBeTruthy();
    expect(screen.getByText('joy')).toBeTruthy();
  });

  it('без more плитки «+N» нет', () => {
    render(<PreviewStrip kind={kind} tiles={[{ label: 'идл' }]} />);
    expect(screen.queryByText(/^\+/)).toBeNull();
  });

  it('more>0 рисует плитку со счётчиком', () => {
    render(<PreviewStrip kind={kind} tiles={[{ label: 'идл' }]} more={3} />);
    expect(screen.getByText('+3')).toBeTruthy();
  });
});

describe('PreviewStrip, частные случаи', () => {
  it('по умолчанию kind sprite', () => {
    render(<PreviewStrip tiles={[{ label: 'idle' }]} />);
    expect(screen.getByText('idle')).toBeTruthy();
  });

  it('kind=location + more добавляет статусный глиф «не создано»', () => {
    render(<PreviewStrip kind="location" tiles={[{ label: 'пирс' }]} more={2} />);
    expect(screen.getByText('+2')).toBeTruthy();
    expect(screen.getByRole('img', { name: 'none' })).toBeTruthy();
  });

  it('kind=sprite + more не рисует статусный глиф', () => {
    render(<PreviewStrip kind="sprite" tiles={[{ label: 'idle' }]} more={2} />);
    expect(screen.getByText('+2')).toBeTruthy();
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('без onTileClick плитки некликабельны', () => {
    render(<PreviewStrip tiles={[{ label: 'idle' }]} />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('с onTileClick плитка — кнопка, вызывающая колбэк с индексом', () => {
    const clicks: number[] = [];
    render(<PreviewStrip tiles={[{ label: 'idle' }, { label: 'joy' }]} onTileClick={index => clicks.push(index)} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(2);
    fireEvent.click(buttons[1]);
    expect(clicks).toEqual([1]);
  });

  it('плитка «+N» сама по себе не кликабельна', () => {
    render(<PreviewStrip tiles={[{ label: 'idle' }]} more={2} onTileClick={() => {}} />);
    // Кнопки только у тайлов (1), плитка «+N» в их число не входит.
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });
});
