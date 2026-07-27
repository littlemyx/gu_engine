import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useBriefStore } from '@/narrative/briefStore';
import { EMPTY_NARRATIVE_DATA, useNarrativeStore } from '@/narrative/narrativeStore';

import { useStudioProjectStore } from '../studioProjectStore';

import { applyProject, parseProjectFile } from './parseProject';
import { serializeProject } from './serializeProject';

/**
 * Круг: состояние сторов → .guproj → разбор → применение. Архив собирается
 * настоящим fflate — подменяется только сеть, потому что именно на стыке
 * «сервер переименовал файл» ломается перенос проекта между машинами.
 */

const IMAGE = 'bg_beach.png';
const SPRITE = 'sprite_a.png';
const TRACK = 'base_1.mp3';

/** Сервер ассетов: отдаёт байты, пустой список и НОВОЕ имя на каждый аплоад. */
function stubServers(options: { existing?: string[]; failUpload?: string[]; assetsDown?: boolean } = {}) {
  const existing = options.existing ?? [];
  const failUpload = options.failUpload ?? [];
  const uploads: string[] = [];

  const fetchMock = vi.fn(async (input: unknown, init?: { method?: string; body?: unknown }) => {
    const url = String(input);

    if (init?.method === 'POST') {
      const form = init.body as FormData;
      const file = (form.get('image') ?? form.get('audio')) as File;
      uploads.push(file.name);
      if (failUpload.includes(file.name)) return { ok: false, status: 500 } as Response;
      return { ok: true, json: async () => ({ name: `new_${file.name}` }) } as Response;
    }

    // Листинг: что уже лежит на сервере.
    if (url.endsWith('/images') || url.endsWith('/audio')) {
      return { ok: true, json: async () => existing.map(name => ({ name })) } as Response;
    }

    // Отдача конкретного файла при сохранении.
    if (options.assetsDown) throw new Error('ECONNREFUSED');
    const name = decodeURIComponent(url.split('/').pop() ?? '');
    return { ok: true, arrayBuffer: async () => new TextEncoder().encode(`bytes:${name}`).buffer } as Response;
  });

  vi.stubGlobal('fetch', fetchMock);
  return { uploads, fetchMock };
}

function seedProject() {
  useNarrativeStore.setState({
    ...EMPTY_NARRATIVE_DATA,
    spine: { title: 'Взморье' } as never,
    images: { 'loc:beach': { status: 'done', filename: IMAGE, locationHash: 'h1' } },
    characters: { li_a: { status: 'done', idleFilename: SPRITE } },
    audioBase: { status: 'done', filenames: [TRACK], selected: 0 },
    audioSfx: { happy: 'sfx_happy.mp3' },
    // Черновик прогона живёт только в этой вкладке и в файл ехать не должен.
    calendarRun: { phase: 'spine', progress: { completed: 1, total: 5 } } as never,
  });
  useBriefStore.getState().setBrief({
    ...useBriefStore.getState().brief,
    seed: 4242,
    loveInterests: [{ id: 'li_a', name: 'Аня' }] as never,
  });
  useStudioProjectStore.setState({
    branchAssignment: { bp1: 'out1' },
    prefabProvenance: [{ id: 'pf_1', kind: 'world', name: 'Взморье', version: 2, appliedAt: 1 }],
  });
}

const toFile = (blob: Blob, name = 'project.guproj') => new File([blob], name);

/**
 * Тесты проверяют применение в живые сторы: в node-окружении вкладка не
 * привязана к проекту, и автовыбор ушёл бы в ветку «записать снимок и уйти».
 */
const IN_PLACE = { target: { mode: 'inPlace' } } as const;

beforeEach(() => {
  useNarrativeStore.setState({ ...EMPTY_NARRATIVE_DATA });
  useStudioProjectStore.setState({ branchAssignment: {}, prefabProvenance: [] });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('круг сохранение → открытие', () => {
  it('переносит состояние и переписывает имена ассетов на выданные сервером', async () => {
    stubServers();
    seedProject();

    const saved = await serializeProject();
    expect(saved.suggestedName.endsWith('.guproj')).toBe(true);
    expect(saved.images).toBe(2);
    expect(saved.audio).toBe(2);
    expect(saved.missingImages).toEqual([]);

    // Начинаем с чистого редактора: применение обязано восстановить всё само.
    useNarrativeStore.setState({ ...EMPTY_NARRATIVE_DATA });
    useStudioProjectStore.setState({ branchAssignment: {}, prefabProvenance: [] });

    const parsed = await parseProjectFile(toFile(saved.blob));
    expect(parsed).not.toHaveProperty('error');
    if ('error' in parsed) return;

    expect(parsed.summary).toMatchObject({ name: 'Взморье', images: 2, audio: 2, hasSpine: true, prefabs: 1 });

    const result = await applyProject(parsed, IN_PLACE);
    expect(result).toMatchObject({ ok: true, failedUploads: [], uploaded: 4, reusedExisting: 0 });

    const narrative = useNarrativeStore.getState();
    expect(narrative.images['loc:beach']).toMatchObject({ filename: `new_${IMAGE}`, locationHash: 'h1' });
    expect(narrative.characters.li_a).toMatchObject({ idleFilename: `new_${SPRITE}` });
    expect(narrative.audioBase).toMatchObject({ filenames: [`new_${TRACK}`] });
    expect(narrative.audioSfx).toEqual({ happy: 'new_sfx_happy.mp3' });
    expect(narrative.spine).toMatchObject({ title: 'Взморье' });

    expect(useBriefStore.getState().brief.seed).toBe(4242);
    expect(useBriefStore.getState().brief.loveInterests).toHaveLength(1);
    expect(useStudioProjectStore.getState().branchAssignment).toEqual({ bp1: 'out1' });
    expect(useStudioProjectStore.getState().prefabProvenance).toHaveLength(1);
  });

  it('не тащит в файл черновик прогона', async () => {
    stubServers();
    seedProject();
    const saved = await serializeProject();

    const parsed = await parseProjectFile(toFile(saved.blob));
    if ('error' in parsed) throw new Error(parsed.error);
    expect(parsed.project.stores.narrative.state).not.toHaveProperty('calendarRun');

    await applyProject(parsed, IN_PLACE);
    expect(useNarrativeStore.getState().calendarRun).toBeNull();
  });

  it('не перезаливает файлы, которые уже лежат на сервере', async () => {
    stubServers();
    seedProject();
    const saved = await serializeProject();

    const parsed = await parseProjectFile(toFile(saved.blob));
    if ('error' in parsed) throw new Error(parsed.error);

    // Тот же проект на той же машине: сервер знает все четыре файла.
    const { uploads } = stubServers({ existing: [IMAGE, SPRITE, TRACK, 'sfx_happy.mp3'] });
    const result = await applyProject(parsed, IN_PLACE);

    expect(uploads).toEqual([]);
    expect(result).toMatchObject({ ok: true, uploaded: 0, reusedExisting: 4 });
    // Имена не менялись — ссылки в состоянии остались прежними.
    expect(useNarrativeStore.getState().images['loc:beach']).toMatchObject({ filename: IMAGE });
  });

  it('открывает проект даже когда часть ассетов не залилась', async () => {
    stubServers();
    seedProject();
    const saved = await serializeProject();
    const parsed = await parseProjectFile(toFile(saved.blob));
    if ('error' in parsed) throw new Error(parsed.error);

    stubServers({ failUpload: [SPRITE] });
    const result = await applyProject(parsed, IN_PLACE);

    expect(result).toMatchObject({ ok: true, failedUploads: [SPRITE] });
    // Спрайт остаётся под старым именем: он не залился, но история цела.
    expect(useNarrativeStore.getState().characters.li_a).toMatchObject({ idleFilename: SPRITE });
    expect(useNarrativeStore.getState().images['loc:beach']).toMatchObject({ filename: `new_${IMAGE}` });
  });

  it('обнуляет поля, которых нет в открываемом файле', async () => {
    stubServers();
    seedProject();
    const saved = await serializeProject();
    const parsed = await parseProjectFile(toFile(saved.blob));
    if ('error' in parsed) throw new Error(parsed.error);

    // В редакторе была своя история с эпилогами — от неё не должно остаться следа.
    useNarrativeStore.setState({ endings: { normal: { text: 'старый эпилог' } as never } });
    await applyProject(parsed, IN_PLACE);

    expect(useNarrativeStore.getState().endings).toEqual({});
  });
});

describe('сохранение при недоступном сервере ассетов', () => {
  it('всё равно собирает архив и перечисляет непойманные ассеты', async () => {
    stubServers({ assetsDown: true });
    seedProject();

    const saved = await serializeProject();

    expect(saved.images).toBe(0);
    expect(saved.audio).toBe(0);
    expect([...saved.missingImages].sort()).toEqual([IMAGE, SPRITE].sort());
    expect([...saved.missingAudio].sort()).toEqual([TRACK, 'sfx_happy.mp3'].sort());
    expect(saved.blob.size).toBeGreaterThan(0);

    // Такой файл открывается: состояние на месте, а про дыру сказано вслух.
    const parsed = await parseProjectFile(toFile(saved.blob));
    if ('error' in parsed) throw new Error(parsed.error);
    expect(parsed.problems.join(' ')).toContain('нет 4 ассетов');
    expect(parsed.summary.hasSpine).toBe(true);
  });
});

describe('разбор чужого файла', () => {
  it('не бросает на не-архиве', async () => {
    const result = await parseProjectFile(new File([new TextEncoder().encode('не zip')], 'x.guproj'));
    expect(result).toHaveProperty('error');
  });
});
