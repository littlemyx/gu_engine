/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import BeatRow, { type BeatRowActionKind, type BeatRowBadge } from './BeatRow';

afterEach(cleanup);

const BADGES: BeatRowBadge[] = ['none', 'ready', 'stale', 'no-prose', 'generating'];

describe.each(BADGES)('BeatRow, бейдж %s', badge => {
  it('показывает подпись бита', () => {
    render(<BeatRow title="Б5 Ссора" badge={badge} />);
    expect(screen.getByText('Б5 Ссора')).toBeTruthy();
  });
});

describe('BeatRow, бейдж свежести', () => {
  it('badge="none" не рисует статус-глиф', () => {
    render(<BeatRow title="Б5 Ссора" badge="none" />);
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('badge="ready" рисует статус-глиф с меткой fresh', () => {
    render(<BeatRow title="Б5 Ссора" badge="ready" />);
    expect(screen.getByRole('img', { name: 'fresh' })).toBeTruthy();
  });

  it('badge="generating" рисует статус-глиф с меткой run', () => {
    render(<BeatRow title="Б5 Ссора" badge="generating" />);
    expect(screen.getByRole('img', { name: 'run' })).toBeTruthy();
  });
});

describe('BeatRow, состояние выбора', () => {
  it('без onSelect строка не кликабельна', () => {
    render(<BeatRow title="Б5 Ссора" />);
    expect(screen.queryByRole('button', { name: /Б5 Ссора/ })).toBeNull();
  });

  it('с onSelect строка кликабельна и переключает выбор кликом', () => {
    let lastSelected: boolean | null = null;
    render(
      <BeatRow
        title="Б5 Ссора"
        selected={false}
        onSelect={value => {
          lastSelected = value;
        }}
      />,
    );
    const row = screen.getByRole('button', { name: /Б5 Ссора/ });
    expect(row.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(row);
    expect(lastSelected).toBe(true);
  });

  it('Enter на строке тоже переключает выбор', () => {
    let lastSelected: boolean | null = null;
    render(
      <BeatRow
        title="Б5 Ссора"
        selected
        onSelect={value => {
          lastSelected = value;
        }}
      />,
    );
    const row = screen.getByRole('button', { name: /Б5 Ссора/ });
    fireEvent.keyDown(row, { key: 'Enter' });
    expect(lastSelected).toBe(false);
  });

  it('выбранная строка несёт aria-pressed="true"', () => {
    render(<BeatRow title="Б5 Ссора" selected onSelect={() => {}} />);
    expect(screen.getByRole('button', { name: /Б5 Ссора/ }).getAttribute('aria-pressed')).toBe('true');
  });
});

describe('BeatRow, действия', () => {
  it('без selected и actions действия не рисуются', () => {
    render(<BeatRow title="Б5 Ссора" />);
    expect(screen.queryByRole('button', { name: 'играть отсюда' })).toBeNull();
  });

  it('actions=true раскрывает действия у невыбранной строки', () => {
    render(<BeatRow title="Б5 Ссора" actions />);
    expect(screen.getByRole('button', { name: 'играть отсюда' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'дубль с заметкой' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'ещё' })).toBeTruthy();
  });

  it('selected раскрывает действия и без actions', () => {
    render(<BeatRow title="Б5 Ссора" selected />);
    expect(screen.getByRole('button', { name: 'играть отсюда' })).toBeTruthy();
  });

  it('без stale действие «в ведомость» не рисуется', () => {
    render(<BeatRow title="Б5 Ссора" selected stale={false} />);
    expect(screen.queryByRole('button', { name: 'в ведомость' })).toBeNull();
  });

  it('stale добавляет действие «в ведомость»', () => {
    render(<BeatRow title="Б5 Ссора" selected stale />);
    expect(screen.getByRole('button', { name: 'в ведомость' })).toBeTruthy();
  });

  it('клик по действию вызывает onAction с нужным kind и не переключает выбор', () => {
    const kinds: BeatRowActionKind[] = [];
    let selectCalls = 0;
    render(
      <BeatRow
        title="Б5 Ссора"
        selected
        stale
        onSelect={() => {
          selectCalls += 1;
        }}
        onAction={kind => kinds.push(kind)}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'играть отсюда' }));
    fireEvent.click(screen.getByRole('button', { name: 'дубль с заметкой' }));
    fireEvent.click(screen.getByRole('button', { name: 'ещё' }));
    fireEvent.click(screen.getByRole('button', { name: 'в ведомость' }));

    expect(kinds).toEqual(['play', 'retake', 'more', 'sheet']);
    expect(selectCalls).toBe(0);
  });
});

describe('BeatRow, хэндл драга', () => {
  it('drag по умолчанию рисует хэндл ⠿', () => {
    render(<BeatRow title="Б5 Ссора" />);
    expect(screen.getByText('⠿')).toBeTruthy();
  });

  it('drag=false прячет хэндл', () => {
    render(<BeatRow title="Б5 Ссора" drag={false} />);
    expect(screen.queryByText('⠿')).toBeNull();
  });
});
