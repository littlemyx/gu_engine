/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import ProjectRow from './ProjectRow';

import styles from './ProjectRow.module.css';

afterEach(cleanup);

const NAME = 'Осенний семестр';
const META = 'изменён 12 минут назад';

describe('ProjectRow, обычное состояние', () => {
  it('показывает имя и мету, кнопку «Открыть» и триггер «удалить»', () => {
    render(<ProjectRow name={NAME} meta={META} onOpen={() => {}} />);

    expect(screen.getByText(NAME)).toBeTruthy();
    expect(screen.getByText(META)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Открыть' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'удалить' })).toBeTruthy();
  });

  it('без onOpen кнопка «Открыть» не рендерится кликабельной', () => {
    render(<ProjectRow name={NAME} meta={META} />);

    expect(screen.queryByRole('button', { name: 'Открыть' })).toBeNull();
    expect(screen.getByText('Открыть')).toBeTruthy();
  });

  it('с onOpen клик по «Открыть» вызывает колбэк', () => {
    const onOpen = vi.fn();
    render(<ProjectRow name={NAME} meta={META} onOpen={onOpen} />);

    fireEvent.click(screen.getByRole('button', { name: 'Открыть' }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('unnamed красит имя приглушённым классом', () => {
    render(<ProjectRow name="без названия" meta={META} unnamed />);
    const nameEl = screen.getByText('без названия');

    expect(nameEl.className).toContain(styles.nameMuted);
  });

  it('без unnamed приглушённого класса нет', () => {
    render(<ProjectRow name={NAME} meta={META} />);
    expect(screen.getByText(NAME).className).not.toContain(styles.nameMuted);
  });

  it('применяет заданную ширину строки', () => {
    render(<ProjectRow name={NAME} meta={META} width={340} />);

    const root = screen.getByText(NAME).closest(`.${styles.root}`) as HTMLElement;
    expect(root.style.width).toBe('340px');
  });

  it('клик по «удалить» переключает строку на панель подтверждения', () => {
    render(<ProjectRow name={NAME} meta={META} />);

    fireEvent.click(screen.getByRole('button', { name: 'удалить' }));

    expect(screen.getByText(/удалить без возврата\?/)).toBeTruthy();
    expect(screen.queryByText(META)).toBeNull();
  });
});

describe('ProjectRow, панель подтверждения удаления', () => {
  it('state="подтверждение удаления" открывает панель сразу', () => {
    render(<ProjectRow name={NAME} meta={META} state="подтверждение удаления" />);

    expect(screen.getByText(/удалить без возврата\?/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'отмена' })).toBeTruthy();
  });

  it('«отмена» возвращает строку к обычному виду', () => {
    render(<ProjectRow name={NAME} meta={META} state="подтверждение удаления" />);

    fireEvent.click(screen.getByRole('button', { name: 'отмена' }));

    expect(screen.getByText(META)).toBeTruthy();
    expect(screen.queryByText(/удалить без возврата\?/)).toBeNull();
  });

  it('«удалить» в панели вызывает onDelete и закрывает панель', () => {
    const onDelete = vi.fn();
    render(<ProjectRow name={NAME} meta={META} state="подтверждение удаления" onDelete={onDelete} />);

    fireEvent.click(screen.getByRole('button', { name: 'удалить' }));

    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(screen.getByText(META)).toBeTruthy();
  });

  it('без onDelete клик по «удалить» всё равно закрывает панель', () => {
    render(<ProjectRow name={NAME} meta={META} state="подтверждение удаления" />);

    fireEvent.click(screen.getByRole('button', { name: 'удалить' }));

    expect(screen.getByText(META)).toBeTruthy();
  });
});
