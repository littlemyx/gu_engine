/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import ModalFooter from './ModalFooter';

import styles from './ModalFooter.module.css';

afterEach(cleanup);

describe('ModalFooter, контент', () => {
  it('показывает подписи кнопок по умолчанию', () => {
    render(<ModalFooter onCancel={() => {}} />);

    expect(screen.getByRole('button', { name: 'Сбросить к дефолтам' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Применить' })).toBeTruthy();
  });

  it('кастомные подписи вытесняют дефолтные', () => {
    render(<ModalFooter cancelLabel="Отмена" confirmLabel="Сохранить" onCancel={() => {}} />);

    expect(screen.getByRole('button', { name: 'Отмена' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Сохранить' })).toBeTruthy();
  });

  it('смета печатается в кнопке подтверждения', () => {
    render(<ModalFooter price="120 кр" />);

    expect(screen.getByText('120 кр')).toBeTruthy();
  });

  it('без price сметы в кнопке нет', () => {
    render(<ModalFooter />);

    expect(screen.queryByText('120 кр')).toBeNull();
  });
});

describe('ModalFooter, интерактивность', () => {
  it('клик по кнопке отмены вызывает onCancel', () => {
    const onCancel = vi.fn();
    render(<ModalFooter onCancel={onCancel} />);

    fireEvent.click(screen.getByRole('button', { name: 'Сбросить к дефолтам' }));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('клик по кнопке подтверждения вызывает onConfirm', () => {
    const onConfirm = vi.fn();
    render(<ModalFooter onConfirm={onConfirm} />);

    fireEvent.click(screen.getByRole('button', { name: 'Применить' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('без onCancel кнопка отмены неинтерактивна', () => {
    render(<ModalFooter />);

    expect(screen.queryByRole('button', { name: 'Сбросить к дефолтам' })).toBeNull();
    expect(screen.getByText('Сбросить к дефолтам')).toBeTruthy();
  });

  it('disabled отключает кнопку подтверждения', () => {
    render(<ModalFooter disabled onConfirm={vi.fn()} />);

    const button = screen.getByRole('button', { name: 'Применить' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it('loading не пускает клик на кнопке подтверждения', () => {
    const onConfirm = vi.fn();
    render(<ModalFooter loading onConfirm={onConfirm} />);

    fireEvent.click(screen.getByRole('button', { name: 'Применить' }));

    expect(onConfirm).not.toHaveBeenCalled();
  });
});

describe('ModalFooter, разделитель и размер', () => {
  it('divider (по умолчанию) добавляет класс волосяной черты к корню', () => {
    const { container } = render(<ModalFooter />);
    const root = container.firstElementChild as HTMLElement;

    expect(root.className).toContain(styles.divided);
  });

  it('divider={false} убирает класс волосяной черты', () => {
    const { container } = render(<ModalFooter divider={false} />);
    const root = container.firstElementChild as HTMLElement;

    expect(root.className).not.toContain(styles.divided);
  });

  it('width применяется инлайн-стилем', () => {
    const { container } = render(<ModalFooter width={520} />);
    const root = container.firstElementChild as HTMLElement;

    expect(root.style.width).toBe('520px');
  });
});
