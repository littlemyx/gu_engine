/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import DialogueBox, { type DialogueChoice } from './DialogueBox';

afterEach(cleanup);

const CHOICES: DialogueChoice[] = [
  { id: 'c1', text: 'Меня пугаешь только ты.' },
  { id: 'c2', text: '[молча смотреть]' },
];

describe('DialogueBox', () => {
  it('показывает имя говорящего и реплику в кавычках', () => {
    render(<DialogueBox speaker="Кира" line="Ты всё-таки пришёл." choices={CHOICES} />);
    expect(screen.getByText('Кира')).toBeTruthy();
    expect(screen.getByText('«Ты всё-таки пришёл.»')).toBeTruthy();
  });

  it('показывает все варианты ответа', () => {
    render(<DialogueBox speaker="Кира" line="Реплика" choices={CHOICES} />);
    expect(screen.getByText('Меня пугаешь только ты.')).toBeTruthy();
    expect(screen.getByText('[молча смотреть]')).toBeTruthy();
  });

  it('без onPick рисует варианты нерактивными (без role=button)', () => {
    render(<DialogueBox speaker="Кира" line="Реплика" choices={CHOICES} />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('с onPick рисует кнопки и вызывает колбэк с индексом выбранного варианта', () => {
    let picked: number | null = null;
    render(
      <DialogueBox
        speaker="Кира"
        line="Реплика"
        choices={CHOICES}
        onPick={index => {
          picked = index;
        }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '[молча смотреть]' }));
    expect(picked).toBe(1);

    fireEvent.click(screen.getByRole('button', { name: 'Меня пугаешь только ты.' }));
    expect(picked).toBe(0);
  });

  it('без выбранного индекса ни один вариант не помечен как выбранный', () => {
    render(<DialogueBox speaker="Кира" line="Реплика" choices={CHOICES} onPick={() => {}} />);
    const button = screen.getByRole('button', { name: 'Меня пугаешь только ты.' });
    expect(button.parentElement?.className).not.toMatch(/run/);
  });

  it('подсвечивает выбранный вариант тонированной подложкой', () => {
    render(<DialogueBox speaker="Кира" line="Реплика" choices={CHOICES} selectedIndex={1} onPick={() => {}} />);
    const button = screen.getByRole('button', { name: '[молча смотреть]' });
    expect(button.parentElement?.className).toMatch(/run/);
  });

  it('пустой список вариантов не рисует ни одной кнопки', () => {
    render(<DialogueBox speaker="Кира" line="Реплика" choices={[]} onPick={() => {}} />);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });
});
