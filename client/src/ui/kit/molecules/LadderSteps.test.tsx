/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import LadderSteps from './LadderSteps';

afterEach(cleanup);

describe('LadderSteps, состав ряда', () => {
  it('по умолчанию рисует count=5 ступеней с префиксом «С»', () => {
    render(<LadderSteps />);

    ['С1', 'С2', 'С3', 'С4', 'С5'].forEach(label => {
      expect(screen.getByText(label)).toBeTruthy();
    });
  });

  it('count управляет числом ступеней, prefix — их буквой', () => {
    render(<LadderSteps count={3} prefix="Д" />);

    expect(screen.getByText('Д1')).toBeTruthy();
    expect(screen.getByText('Д2')).toBeTruthy();
    expect(screen.getByText('Д3')).toBeTruthy();
    expect(screen.queryByText('Д4')).toBeNull();
  });
});

describe('LadderSteps, состояния ступеней', () => {
  it('без onStep ни одна ступень не кликабельна', () => {
    render(<LadderSteps count={5} done={2} current={3} />);

    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('с onStep каждая ступень — кнопка, доступное имя совпадает с подписью', () => {
    render(<LadderSteps count={5} done={2} current={3} onStep={() => {}} />);

    expect(screen.getAllByRole('button')).toHaveLength(5);
    ['С1', 'С2', 'С3', 'С4', 'С5'].forEach(label => {
      expect(screen.getByRole('button', { name: label })).toBeTruthy();
    });
  });

  it('клик по сыгранной ступени (1..done) зовёт onStep с её номером', () => {
    const onStep = vi.fn();
    render(<LadderSteps count={5} done={2} current={3} onStep={onStep} />);

    fireEvent.click(screen.getByRole('button', { name: 'С1' }));
    expect(onStep).toHaveBeenCalledWith(1);
  });

  it('клик по открытой ступени (current) зовёт onStep с её номером', () => {
    const onStep = vi.fn();
    render(<LadderSteps count={5} done={2} current={3} onStep={onStep} />);

    fireEvent.click(screen.getByRole('button', { name: 'С3' }));
    expect(onStep).toHaveBeenCalledWith(3);
  });

  it('клик по запертой ступени зовёт onStep с её номером', () => {
    const onStep = vi.fn();
    render(<LadderSteps count={5} done={2} current={3} onStep={onStep} />);

    fireEvent.click(screen.getByRole('button', { name: 'С5' }));
    expect(onStep).toHaveBeenCalledWith(5);
    expect(onStep).toHaveBeenCalledTimes(1);
  });

  it('done=0 — ни одна ступень не сыграна, current=0 — ни одна не открыта', () => {
    render(<LadderSteps count={3} done={0} current={0} onStep={() => {}} />);

    expect(screen.getAllByRole('button')).toHaveLength(3);
  });
});

describe('LadderSteps, заметка под рядом', () => {
  it('note не пустая — строка рисуется', () => {
    render(<LadderSteps note="2 сыграно · С3 открыта" />);

    expect(screen.getByText('2 сыграно · С3 открыта')).toBeTruthy();
  });

  it('note пустая по умолчанию — строки нет', () => {
    render(<LadderSteps note="" />);

    expect(screen.queryByText(/сыграно/)).toBeNull();
  });
});
