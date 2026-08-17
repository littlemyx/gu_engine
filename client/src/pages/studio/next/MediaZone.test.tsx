/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { useBriefStore } from '@/narrative/briefStore';
import { locationImageKey } from '@/narrative/imageFingerprint';
import { useNarrativeStore } from '@/narrative/narrativeStore';

import MediaZone from './MediaZone';

import type { Brief, WorldModel } from '@/narrative/types';

afterEach(() => {
  cleanup();
  useNarrativeStore.setState({
    worldModel: null,
    images: {},
    characters: {},
    audioBase: null,
    audioMoodBeds: {},
    audioByLi: {},
    spine: null,
    calendarRun: null,
  });
});

// jest-dom в проекте нет — смотрим сам DOM.

const brief = {
  loveInterests: [{ id: 'kira', name: 'Кира' }],
} as unknown as Brief;

const location = (id: string, name: string) =>
  ({ id, name, description: '', pointsOfInterest: [], adjacent: [], mood: 'neutral_calm', specialKind: null } as const);

const world = (): WorldModel => ({ locations: [location('library', 'библиотека')] } as unknown as WorldModel);

describe('MediaZone — пусто', () => {
  it('без мира и брифа честно называет пустоту дорожек', () => {
    useBriefStore.setState({ brief: {} as Brief });
    render(<MediaZone />);

    expect(screen.getByText('Медиа')).toBeTruthy();
    expect(screen.getByText('Мир ещё не собран — фонам пока не из чего взяться.')).toBeTruthy();
    expect(screen.getByText('В брифе нет ни одного love interest — спрайтам некого рисовать.')).toBeTruthy();
  });

  it('дорожка звука не пуста и без данных: база в очереди всегда стоит', () => {
    useBriefStore.setState({ brief: {} as Brief });
    render(<MediaZone />);

    expect(screen.getByText('Звук · 0 из 1')).toBeTruthy();
    expect(screen.getByText('Базовая подложка')).toBeTruthy();
    expect(screen.getByText('в очереди')).toBeTruthy();
  });
});

describe('MediaZone — дорожка фонов', () => {
  it('готовый фон разворачивается инплейс, без фона — заглушка', () => {
    useBriefStore.setState({ brief });
    useNarrativeStore.setState({
      worldModel: world(),
      images: { [locationImageKey('library')]: { status: 'done', filename: 'library.png' } },
    });
    render(<MediaZone />);

    expect(screen.getByText('библиотека')).toBeTruthy();
    expect(screen.getByText('library.png')).toBeTruthy();
    expect(screen.getByText('Фоны · 1 из 1')).toBeTruthy();
  });

  it('фон в процессе генерации — заглушка с текстом состояния', () => {
    useBriefStore.setState({ brief });
    useNarrativeStore.setState({
      worldModel: world(),
      images: { [locationImageKey('library')]: { status: 'generating', batchId: 'b1' } },
    });
    render(<MediaZone />);

    expect(screen.getByText('фон «библиотека» — генерируется…')).toBeTruthy();
  });
});

describe('MediaZone — дорожка спрайтов', () => {
  it('готовый персонаж показывает принятые и ожидающие позы', () => {
    useBriefStore.setState({ brief });
    useNarrativeStore.setState({
      characters: {
        kira: { status: 'done', idleFilename: 'kira_idle.png', poseFilenames: { happy: 'kira_happy.png' } },
      },
    });
    render(<MediaZone />);

    expect(screen.getByText('Кира')).toBeTruthy();
    expect(screen.getByText('идл ✓')).toBeTruthy();
    expect(screen.getByText('радость ✓')).toBeTruthy();
    expect(screen.getByText('грусть ○')).toBeTruthy();
  });

  it('персонаж без генерации — заглушка', () => {
    useBriefStore.setState({ brief });
    render(<MediaZone />);

    expect(screen.getByText('спрайт «Кира» — заглушка')).toBeTruthy();
  });
});

describe('MediaZone — запуск дорожек', () => {
  const launchButton = (name: string) => screen.getByRole('button', { name }) as HTMLButtonElement;
  const spine = { title: 'Маяк', logline: 'возвращение в городок' } as never;

  it('без истории все запуски заперты с причиной', () => {
    useBriefStore.setState({ brief });
    render(<MediaZone />);

    expect(launchButton('Сгенерировать фоны').disabled).toBe(true);
    expect(launchButton('Сгенерировать спрайты').disabled).toBe(true);
    expect(launchButton('Сгенерировать звук').disabled).toBe(true);
    expect(screen.getAllByText('истории ещё нет').length).toBeGreaterThan(0);
  });

  it('с хребтом и миром дорожки можно запускать', () => {
    useBriefStore.setState({ brief });
    useNarrativeStore.setState({ spine, worldModel: world() });
    render(<MediaZone />);

    expect(launchButton('Сгенерировать фоны').disabled).toBe(false);
    expect(launchButton('Сгенерировать спрайты').disabled).toBe(false);
    expect(launchButton('Сгенерировать звук').disabled).toBe(false);
  });

  it('хребет есть, мира нет — заперты только фоны', () => {
    useBriefStore.setState({ brief });
    useNarrativeStore.setState({ spine });
    render(<MediaZone />);

    expect(launchButton('Сгенерировать фоны').disabled).toBe(true);
    expect(screen.getByText('мир ещё не собран')).toBeTruthy();
    expect(launchButton('Сгенерировать спрайты').disabled).toBe(false);
  });

  it('во время прогона истории запуски заперты', () => {
    useBriefStore.setState({ brief });
    useNarrativeStore.setState({ spine, worldModel: world(), calendarRun: { status: 'running' } as never });
    render(<MediaZone />);

    expect(launchButton('Сгенерировать фоны').disabled).toBe(true);
    expect(screen.getAllByText('идёт прогон истории').length).toBeGreaterThan(0);
  });
});

describe('MediaZone — дорожка звука, решения автора', () => {
  it('готовая позиция позволяет выбрать дубль буквой, и это долетает до стора', () => {
    useBriefStore.setState({ brief: {} as Brief });
    useNarrativeStore.setState({
      audioBase: { status: 'done', filenames: ['a.mp3', 'b.mp3'], selected: 0 },
    });
    render(<MediaZone />);

    const letterB = screen.getByRole('button', { name: 'B' });
    fireEvent.click(letterB);

    expect(useNarrativeStore.getState().audioBase).toEqual({
      status: 'done',
      filenames: ['a.mp3', 'b.mp3'],
      selected: 1,
    });
  });

  it('клик по ▶ разворачивает сравнение дублей инплейс, повторный клик сворачивает', () => {
    useBriefStore.setState({ brief: {} as Brief });
    useNarrativeStore.setState({
      audioBase: { status: 'done', filenames: ['a.mp3', 'b.mp3'], selected: 0 },
    });
    render(<MediaZone />);

    expect(screen.queryByText('Вариант A')).toBeFalsy();

    const toggle = screen.getByRole('button', { name: 'прослушать' });
    fireEvent.click(toggle);

    expect(screen.getByText('Вариант A')).toBeTruthy();
    expect(screen.getByText('Вариант Б')).toBeTruthy();

    fireEvent.click(toggle);
    expect(screen.queryByText('Вариант A')).toBeFalsy();
  });

  it('банк эмбиента и вариации по LI появляются позициями своей дорожки', () => {
    useBriefStore.setState({ brief });
    useNarrativeStore.setState({
      audioMoodBeds: { cheerful_warm: { status: 'generating', batchId: 'b1' } },
      audioByLi: { kira: { positive: { status: 'done', filenames: ['w.mp3'], selected: 0 } } },
    });
    render(<MediaZone />);

    expect(screen.getByText('весёлая')).toBeTruthy();
    expect(screen.getByText('Кира · тепло')).toBeTruthy();
    // база(1) + бед(1) + тепло/холодно на LI(2) = 4, готов только тёплый вариант.
    expect(screen.getByText('Звук · 1 из 4')).toBeTruthy();
  });

  it('ошибка генерации звука показана текстом ошибки в строке позиции', () => {
    useBriefStore.setState({ brief: {} as Brief });
    useNarrativeStore.setState({
      audioBase: { status: 'failed', error: 'сервис недоступен' },
    });
    render(<MediaZone />);

    expect(screen.getByText(/сервис недоступен/)).toBeTruthy();
  });
});
