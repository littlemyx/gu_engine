/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { blankBrief, useBriefStore } from '@/narrative/briefStore';

import { useStudioProjectStore } from '../studioProjectStore';
import PreviewZone from './PreviewZone';

afterEach(() => {
  cleanup();
  useBriefStore.setState({ brief: blankBrief() });
  useStudioProjectStore.getState().resetBranches();
});

describe('PreviewZone', () => {
  it('честно объясняет, что движка ещё нет, и не запускает превью', () => {
    render(<PreviewZone />);

    expect(screen.getByText('Движок ещё не встроен')).toBeTruthy();
    expect(screen.getByText('Кнопка запуска пока недоступна: движок ещё не встроен.', { exact: false })).toBeTruthy();
    // Заглушка не выдаёт себя за рабочую кнопку: без колбэка EmptyState
    // рендерит невзаимодействующий span, а не <button>.
    expect(screen.queryByRole('button', { name: 'Запустить превью' })).toBeNull();
  });

  it('пустые данные: seed не выбран, ветки не назначены', () => {
    render(<PreviewZone />);

    expect(screen.getByText('seed — · новый на каждой генерации')).toBeTruthy();
    expect(screen.getByText('развилки не назначены — по умолчанию', { exact: false })).toBeTruthy();
  });

  it('заполненные данные: seed и назначенные ветки видны в параметрах запуска', () => {
    useBriefStore.setState(s => ({ brief: { ...s.brief, seed: 4242 } }));
    useStudioProjectStore.setState({
      branchAssignment: { storm_choice: 'stayed', kira_secret: 'revealed' },
    });

    render(<PreviewZone />);

    expect(screen.getByText('назначено вручную: 2', { exact: false })).toBeTruthy();
    expect(screen.getByText('seed 4242 · фиксирован')).toBeTruthy();
    expect(screen.getByText('storm_choice → stayed')).toBeTruthy();
    expect(screen.getByText('kira_secret → revealed')).toBeTruthy();
  });

  it('контролы запуска показаны, но недоступны — экран ничего не запускает', () => {
    render(<PreviewZone />);

    // Ни один из трёх контролов PreviewControls не получил колбэка — все три
    // рендерятся немыми <span>, ни один не долетает до реестра кнопок.
    expect(screen.queryByRole('button', { name: /Перезапуск с промоткой/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /ветка:/i })).toBeNull();
    expect(screen.queryByRole('button', { name: 'переролл' })).toBeNull();
  });

  it('строгий режим — единственная реально переключаемая ручка на экране', () => {
    render(<PreviewZone />);

    const toggle = screen.getByRole('switch', { name: /строгий режим/i });
    expect(toggle.getAttribute('aria-checked')).toBe('false');

    fireEvent.click(toggle);

    expect(toggle.getAttribute('aria-checked')).toBe('true');
  });
});
