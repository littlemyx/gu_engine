/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import GalleryActions from './GalleryActions';

afterEach(cleanup);

const buttons = () => screen.getAllByRole('button') as HTMLButtonElement[];
const dubButton = (label = 'Дубль с заметкой · ≈$0.08') => buttons().find(b => b.textContent === label)!;

describe('GalleryActions, состав', () => {
  it('печатает подписи по умолчанию', () => {
    render(<GalleryActions onAccept={() => {}} onDub={() => {}} />);

    expect(screen.getByRole('button', { name: 'Сделать №2 принятым' })).toBeTruthy();
    expect(dubButton()).toBeTruthy();
  });

  it('принимает свои тексты и смету дубля пропсами', () => {
    render(
      <GalleryActions
        acceptLabel="Принять кадр"
        dubLabel="Ещё один дубль"
        dubPrice="≈$0.12"
        onAccept={() => {}}
        onDub={() => {}}
      />,
    );

    expect(screen.getByRole('button', { name: 'Принять кадр' })).toBeTruthy();
    expect(dubButton('Ещё один дубль · ≈$0.12')).toBeTruthy();
  });

  it('без сметы подпись дубля печатается без разделителя', () => {
    render(<GalleryActions dubLabel="Ещё дубль" dubPrice="" onAccept={() => {}} onDub={() => {}} />);

    expect(dubButton('Ещё дубль')).toBeTruthy();
  });
});

describe('GalleryActions, колбэки', () => {
  it('клик по кнопке принятия вызывает onAccept', () => {
    const onAccept = vi.fn();
    render(<GalleryActions onAccept={onAccept} onDub={() => {}} />);

    fireEvent.click(screen.getByRole('button', { name: 'Сделать №2 принятым' }));
    expect(onAccept).toHaveBeenCalledTimes(1);
  });

  it('клик по кнопке дубля вызывает onDub', () => {
    const onDub = vi.fn();
    render(<GalleryActions onAccept={() => {}} onDub={onDub} />);

    fireEvent.click(dubButton());
    expect(onDub).toHaveBeenCalledTimes(1);
  });

  // OutlineButton (атом кнопки дубля) без колбэка рендерит неинтерактивный
  // <span> — так уже устроен сам атом, молекула этого не переопределяет.
  it('без onDub кнопка дубля не интерактивна', () => {
    render(<GalleryActions onAccept={() => {}} />);

    expect(screen.queryByRole('button', { name: 'Дубль с заметкой · ≈$0.08' })).toBeNull();
    expect(screen.getByText('Дубль с заметкой · ≈$0.08')).toBeTruthy();
  });
});

describe('GalleryActions, состояние disabled', () => {
  it('запирает обе кнопки и не пускает клики', () => {
    const onAccept = vi.fn();
    const onDub = vi.fn();
    render(<GalleryActions disabled onAccept={onAccept} onDub={onDub} />);

    const accept = screen.getByRole('button', { name: 'Сделать №2 принятым' }) as HTMLButtonElement;
    const dub = dubButton();

    expect(accept.disabled).toBe(true);
    expect(dub.disabled).toBe(true);

    fireEvent.click(accept);
    fireEvent.click(dub);

    expect(onAccept).not.toHaveBeenCalled();
    expect(onDub).not.toHaveBeenCalled();
  });
});
