/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import AudioTrackRow from './AudioTrackRow';

afterEach(cleanup);

describe('AudioTrackRow, содержимое', () => {
  it('показывает имя трека и длительность по умолчанию', () => {
    render(<AudioTrackRow trackName="тема_главная.mp3" />);
    expect(screen.getByText('тема_главная.mp3')).toBeTruthy();
    expect(screen.getByText('2:14')).toBeTruthy();
  });

  it('принимает произвольную длительность', () => {
    render(<AudioTrackRow trackName="эмбиент.mp3" duration="0:47" />);
    expect(screen.getByText('0:47')).toBeTruthy();
  });

  it('без override пометки нет', () => {
    render(<AudioTrackRow trackName="тема_главная.mp3" />);
    expect(screen.queryByText('· заменён вами (оверрайд)')).toBeNull();
  });

  it('с override=true показывает пометку', () => {
    render(<AudioTrackRow trackName="тема_главная.mp3" override />);
    expect(screen.getByText('· заменён вами (оверрайд)')).toBeTruthy();
  });
});

describe('AudioTrackRow, состояние playing', () => {
  it('playing=false рисует глиф паузы ▸', () => {
    render(<AudioTrackRow trackName="тема_главная.mp3" playing={false} />);
    expect(screen.getByText('▸')).toBeTruthy();
    expect(screen.queryByText('▶')).toBeNull();
  });

  it('playing=true рисует глиф проигрывания ▶', () => {
    render(<AudioTrackRow trackName="тема_главная.mp3" playing />);
    expect(screen.getByText('▶')).toBeTruthy();
    expect(screen.queryByText('▸')).toBeNull();
  });
});

describe('AudioTrackRow, интерактивность', () => {
  it('без onClick рендерит нейтральный элемент без кнопки', () => {
    render(<AudioTrackRow trackName="тема_главная.mp3" />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('с onClick рендерит кнопку и вызывает колбэк по клику', () => {
    let clicks = 0;
    render(<AudioTrackRow trackName="тема_главная.mp3" onClick={() => (clicks += 1)} />);
    const button = screen.getByRole('button');
    fireEvent.click(button);
    expect(clicks).toBe(1);
  });

  it('доступное имя кнопки включает имя трека и длительность', () => {
    render(<AudioTrackRow trackName="тема_главная.mp3" duration="2:14" onClick={() => {}} />);
    expect(screen.getByRole('button', { name: /тема_главная\.mp3.*2:14/ })).toBeTruthy();
  });
});
