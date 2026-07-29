/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import MoodBedRow, { type MoodBedRowState } from './MoodBedRow';

afterEach(cleanup);

describe('MoodBedRow, состояние choice', () => {
  it('показывает имя, код и обе буквы', () => {
    render(<MoodBedRow label="весёлая" code="cheerful_warm" state="choice" onPick={() => {}} />);
    expect(screen.getByText('весёлая')).toBeTruthy();
    expect(screen.getByText('cheerful_warm')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'A' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'B' })).toBeTruthy();
  });

  it('без onPick буквы не кликабельны', () => {
    render(<MoodBedRow label="весёлая" code="cheerful_warm" state="choice" />);
    expect(screen.queryByRole('button', { name: 'A' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'B' })).toBeNull();
  });

  it('клик по букве вызывает onPick с этой буквой', () => {
    const onPick = vi.fn();
    render(<MoodBedRow label="весёлая" code="cheerful_warm" state="choice" onPick={onPick} />);
    fireEvent.click(screen.getByRole('button', { name: 'B' }));
    expect(onPick).toHaveBeenCalledWith('B');
  });

  it('без onPlay кнопка прослушивания не рендерится', () => {
    render(<MoodBedRow label="весёлая" code="cheerful_warm" state="choice" onPick={() => {}} />);
    expect(screen.queryByRole('button', { name: 'прослушать' })).toBeNull();
  });

  it('клик по кнопке ▶ вызывает onPlay', () => {
    const onPlay = vi.fn();
    render(<MoodBedRow label="весёлая" code="cheerful_warm" state="choice" onPlay={onPlay} playHint="слушать" />);
    fireEvent.click(screen.getByRole('button', { name: 'слушать' }));
    expect(onPlay).toHaveBeenCalledTimes(1);
  });
});

describe('MoodBedRow, состояние generating', () => {
  it('показывает текст «генерируется…»', () => {
    render(<MoodBedRow label="тревожная" code="tense_low" state="generating" />);
    expect(screen.getByText('генерируется…')).toBeTruthy();
  });
});

describe('MoodBedRow, состояние queue', () => {
  it('показывает текст «в очереди»', () => {
    render(<MoodBedRow label="торжественная" code="triumph_full" state="queue" />);
    expect(screen.getByText('в очереди')).toBeTruthy();
  });
});

describe('MoodBedRow, состояние note', () => {
  it('показывает переданный текст примечания', () => {
    render(<MoodBedRow label="базовая" code="base_ambient" state="note" note="= базовая подложка" />);
    expect(screen.getByText('= базовая подложка')).toBeTruthy();
  });
});

describe('MoodBedRow, состояние noLocations', () => {
  it('показывает переданный текст примечания', () => {
    render(<MoodBedRow label="общая" code="shared_bed" state="noLocations" note="нет привязанных локаций" />);
    expect(screen.getByText('нет привязанных локаций')).toBeTruthy();
  });
});

describe.each<MoodBedRowState>(['choice', 'generating', 'queue', 'note', 'noLocations'])(
  'MoodBedRow, состояние %s не рендерит буквы и кнопку вне choice',
  state => {
    it('буквы A/B видны только в choice', () => {
      render(<MoodBedRow label="test" code="test_code" state={state} note="заметка" />);
      const letterA = screen.queryByText('A');
      if (state === 'choice') {
        expect(letterA).toBeTruthy();
      } else {
        expect(letterA).toBeNull();
      }
    });
  },
);
