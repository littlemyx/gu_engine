/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import GameViewport, { type GameViewportOverlay } from './GameViewport';

afterEach(cleanup);

describe('GameViewport', () => {
  it('в обычном показе рисует фон, персонажа и диалог', () => {
    render(<GameViewport bg="закат на пирсе" charName="Кира" line="Ты пришёл." />);

    expect(screen.getByText('закат на пирсе')).toBeTruthy();
    expect(screen.getByText('Кира', { selector: 'span' })).toBeTruthy();
    expect(screen.getByText('«Ты пришёл.»')).toBeTruthy();
  });

  it('скрывает персонажа, когда showChar=false', () => {
    render(<GameViewport showChar={false} charName="Кира-невидимка" />);

    expect(screen.queryByText('Кира-невидимка', { exact: false })).toBeNull();
  });

  it('скрывает диалог, когда showDialogue=false', () => {
    render(<GameViewport showDialogue={false} line="Реплика не должна появиться" />);

    expect(screen.queryByText('«Реплика не должна появиться»')).toBeNull();
  });

  it('без колбэка ряд выборов нерактивен', () => {
    render(<GameViewport choices={['Первый', 'Второй']} />);

    expect(screen.queryByRole('button', { name: 'Первый' })).toBeNull();
    expect(screen.getByText('Первый')).toBeTruthy();
  });

  it('с колбэком клик по варианту сообщает его индекс', () => {
    const onChoicePick = vi.fn();
    render(<GameViewport choices={['Первый', 'Второй', 'Третий']} onChoicePick={onChoicePick} />);

    fireEvent.click(screen.getByRole('button', { name: 'Второй' }));

    expect(onChoicePick).toHaveBeenCalledWith(1);
  });

  const OVERLAYS: GameViewportOverlay[] = ['нет', 'строгий', 'пересборка'];

  describe.each(OVERLAYS)('оверлей %s', overlay => {
    it('показывает соответствующее состояние кадра', () => {
      render(
        <GameViewport
          overlay={overlay}
          charName="Кира-персонаж"
          line="Реплика видна только без оверлея"
          banner="идёт тихая пересборка"
          overlayTitle="Строгий режим включён"
        />,
      );

      if (overlay === 'строгий') {
        expect(screen.getByText('Строгий режим включён')).toBeTruthy();
        // Строгий режим гасит персонажа и диалог вместе с оверлеем.
        expect(screen.queryByText('Кира-персонаж', { exact: false })).toBeNull();
        expect(screen.queryByText('«Реплика видна только без оверлея»')).toBeNull();
      } else {
        expect(screen.queryByText('Строгий режим включён')).toBeNull();
      }

      if (overlay === 'пересборка') {
        expect(screen.getByText('идёт тихая пересборка')).toBeTruthy();
      } else {
        expect(screen.queryByText('идёт тихая пересборка')).toBeNull();
      }
    });
  });

  it('применяет заданные размеры кадра', () => {
    const { container } = render(<GameViewport width={640} height={320} />);
    const root = container.firstElementChild as HTMLDivElement;

    expect(root.style.width).toBe('640px');
    expect(root.style.height).toBe('320px');
  });
});
