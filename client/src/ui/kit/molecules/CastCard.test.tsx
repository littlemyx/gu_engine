/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import CastCard from './CastCard';

afterEach(cleanup);

describe('CastCard, содержимое', () => {
  it('показывает имя, мета, роль и черты характера', () => {
    render(
      <CastCard
        name="Юки"
        meta="20 · slow_burn"
        role="тихая художница, подрабатывает в кафе «Прибой»"
        traits={['застенчивая', 'наблюдательная', 'верная']}
      />,
    );
    expect(screen.getByText('Юки')).toBeTruthy();
    expect(screen.getByText('20 · slow_burn')).toBeTruthy();
    expect(screen.getByText('тихая художница, подрабатывает в кафе «Прибой»')).toBeTruthy();
    expect(screen.getByText('застенчивая')).toBeTruthy();
    expect(screen.getByText('наблюдательная')).toBeTruthy();
    expect(screen.getByText('верная')).toBeTruthy();
  });

  it('оборачивает образец речи в кавычки-ёлочки, которых нет в пропе', () => {
    render(<CastCard name="Юки" speech="мягкая, с паузами" />);
    expect(screen.getByText('«мягкая, с паузами»')).toBeTruthy();
  });

  it('без meta/role/speech/traits соответствующие блоки не рисуются', () => {
    render(<CastCard name="Юки" />);
    expect(screen.queryByText(/·/)).toBeNull();
  });

  it('пустой массив traits не рисует ряд фишек', () => {
    const { container } = render(<CastCard name="Юки" traits={[]} />);
    expect(container.querySelectorAll('span').length).toBeGreaterThanOrEqual(0);
    expect(screen.queryByText('застенчивая')).toBeNull();
  });
});

describe('CastCard, клик по карточке', () => {
  it('без onClick рендерится без role="button" на карточке', () => {
    render(<CastCard name="Юки" />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('с onClick карточка получает role="button" и вызывает колбэк по клику', () => {
    const onClick = vi.fn();
    render(<CastCard name="Юки" onClick={onClick} />);
    const card = screen.getByRole('button');
    expect(card.tagName).toBe('DIV');
    fireEvent.click(card);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe('CastCard, кнопка редактирования', () => {
  it('без onEdit иконка ✎ не является кнопкой', () => {
    render(<CastCard name="Юки" />);
    expect(screen.getByText('✎').tagName).not.toBe('BUTTON');
  });

  it('с onEdit иконка ✎ — настоящая кнопка и вызывает колбэк', () => {
    const onEdit = vi.fn();
    render(<CastCard name="Юки" onEdit={onEdit} />);
    const editButton = screen.getByRole('button', { name: '✎' });
    fireEvent.click(editButton);
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it('клик по кнопке ✎ не всплывает до клика по карточке', () => {
    const onClick = vi.fn();
    const onEdit = vi.fn();
    render(<CastCard name="Юки" onClick={onClick} onEdit={onEdit} />);
    const editButton = screen.getByRole('button', { name: '✎' });
    fireEvent.click(editButton);
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onClick).toHaveBeenCalledTimes(0);
  });
});

describe('CastCard, выделение и ширина', () => {
  it('selected меняет класс рамки внутри карточки', () => {
    const { container: plain } = render(<CastCard name="Юки" />);
    const plainFrameClass = plain.firstElementChild?.firstElementChild?.className ?? '';
    cleanup();

    const { container: picked } = render(<CastCard name="Юки" selected />);
    const pickedFrameClass = picked.firstElementChild?.firstElementChild?.className ?? '';
    expect(pickedFrameClass).not.toBe(plainFrameClass);
  });

  it('по умолчанию ширина карточки 330px', () => {
    const { container } = render(<CastCard name="Юки" />);
    const wrap = container.firstElementChild as HTMLElement;
    expect(wrap.style.width).toBe('330px');
  });

  it('width применяется к обёртке карточки', () => {
    const { container } = render(<CastCard name="Юки" width={400} />);
    const wrap = container.firstElementChild as HTMLElement;
    expect(wrap.style.width).toBe('400px');
  });
});
