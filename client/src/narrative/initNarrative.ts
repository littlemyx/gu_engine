import { useNarrativeStore } from './narrativeStore';
import { isCalendarRunActive, resumeCalendarRun } from './calendarRunner';
import type { CalendarRunState } from './calendarRunState';
import type { AudioTrackState, CharacterGenState, ImageGenState, LiAudioState } from './narrativeStore';
import { locationFingerprint, locationImageKey } from './imageFingerprint';
import { pollUntilDone } from './useBulkImageGeneration';
import { pollUntilAllDone } from './useBulkCharacterGeneration';
import { pollBatch, pollBatchById } from './useBulkAudioGeneration';

/**
 * Init-система нарративного стора: единственная точка, которая после
 * регидрации из localStorage сверяет персистнутое состояние с серверами
 * генерации и передаёт стору реконсилированный результат.
 *
 * Зачем не в UI: генерации живут дольше одного маунта. Раньше batchId умирал
 * вместе с промисом в замыкании хука, и перезагрузка страницы посреди прогона
 * стоила пользователю всей истории. Теперь batchId персистится, а разбираться
 * с ним — работа init-системы; компоненты только читают состояние из стора.
 *
 * Политика асимметрична и это намеренно:
 *   • календарный прогон ПРОДОЛЖАЕТСЯ (resumeCalendarRun) — запуск был явным
 *     намерением автора, прогон помнит, где оборвался, и дожимает остаток;
 *   • медиа-батчи только ДОЖИМАЮТСЯ по уже выданным batchId — новых генераций
 *     init не запускает (деньги тратятся только по кнопке).
 *
 * Батчи серверов живут в памяти процесса: reload страницы они переживают,
 * рестарт сервиса — нет. Потерянный батч (404 / недоступный сервер) помечается
 * failed с внятным текстом; кнопки генерации перезапускают только failed.
 */

type NarrativeInitializer = {
  name: string;
  init: () => Promise<void>;
};

export const NARRATIVE_STORE_KEY = 'gu-narrative-state';

export type InitAction = 'resume' | 'noop';

/** Решение по календарному прогону из персистнутого состояния (чистая функция). */
export function decideInitAction(run: CalendarRunState | null | undefined): InitAction {
  return run?.status === 'running' ? 'resume' : 'noop';
}

/** Ключ медиа-записи → batchId, который надо дожать (чистая функция). */
export type MediaBatchRef =
  | { kind: 'image'; key: string; batchId: string }
  | { kind: 'character'; liId: string; batchId: string }
  | { kind: 'audioBase'; batchId: string }
  | { kind: 'audioMoodBed'; mood: string; batchId: string }
  | { kind: 'audioSpecialBed'; specialKind: string; batchId: string }
  | { kind: 'audioVariation'; liId: string; tone: 'positive' | 'negative'; batchId: string }
  | { kind: 'audioSfx'; batchId: string };

const generatingBatchId = (state: { status: string; batchId?: string } | undefined | null): string | null =>
  state && state.status === 'generating' && state.batchId ? state.batchId : null;

export function collectMediaBatches(snapshot: {
  images: Record<string, ImageGenState>;
  characters: Record<string, CharacterGenState>;
  audioBase: AudioTrackState | null;
  audioMoodBeds: Record<string, AudioTrackState>;
  audioSpecialBeds: Record<string, AudioTrackState>;
  audioByLi: Record<string, LiAudioState>;
  audioSfxState: AudioTrackState | null;
}): MediaBatchRef[] {
  const refs: MediaBatchRef[] = [];

  for (const [key, state] of Object.entries(snapshot.images)) {
    const batchId = generatingBatchId(state);
    if (batchId) refs.push({ kind: 'image', key, batchId });
  }
  for (const [liId, state] of Object.entries(snapshot.characters)) {
    const batchId = generatingBatchId(state);
    if (batchId) refs.push({ kind: 'character', liId, batchId });
  }
  const baseBatch = generatingBatchId(snapshot.audioBase);
  if (baseBatch) refs.push({ kind: 'audioBase', batchId: baseBatch });
  for (const [mood, state] of Object.entries(snapshot.audioMoodBeds)) {
    const batchId = generatingBatchId(state);
    if (batchId) refs.push({ kind: 'audioMoodBed', mood, batchId });
  }
  for (const [specialKind, state] of Object.entries(snapshot.audioSpecialBeds)) {
    const batchId = generatingBatchId(state);
    if (batchId) refs.push({ kind: 'audioSpecialBed', specialKind, batchId });
  }
  for (const [liId, byTone] of Object.entries(snapshot.audioByLi)) {
    for (const tone of ['positive', 'negative'] as const) {
      const batchId = generatingBatchId(byTone[tone]);
      if (batchId) refs.push({ kind: 'audioVariation', liId, tone, batchId });
    }
  }
  const sfxBatch = generatingBatchId(snapshot.audioSfxState);
  if (sfxBatch) refs.push({ kind: 'audioSfx', batchId: sfxBatch });

  return refs;
}

const lostBatch = (e: unknown): string =>
  `батч потерян после перезагрузки (${e instanceof Error ? e.message : String(e)})`;

async function reattachMediaBatch(ref: MediaBatchRef): Promise<void> {
  const store = useNarrativeStore.getState();
  try {
    switch (ref.kind) {
      case 'image': {
        const filename = await pollUntilDone(ref.batchId);
        // Отпечаток берём у локации, для которой батч и запускался: без него
        // дожатый после reload фон при следующем прогоне сочтётся протухшим.
        const loc = store.worldModel?.locations.find(l => locationImageKey(l.id) === ref.key);
        store.setImage(ref.key, {
          status: 'done',
          filename,
          locationHash: loc ? locationFingerprint(loc) : undefined,
        });
        return;
      }
      case 'character': {
        const result = await pollUntilAllDone(ref.batchId);
        store.setCharacter(ref.liId, { status: 'done', ...result });
        return;
      }
      case 'audioBase': {
        const filenames = await pollBatch(ref.batchId);
        store.setAudioBase({ status: 'done', filenames, selected: 0 });
        return;
      }
      case 'audioMoodBed': {
        const filenames = await pollBatch(ref.batchId);
        store.setAudioMoodBed(ref.mood, { status: 'done', filenames, selected: 0 });
        return;
      }
      case 'audioSpecialBed': {
        const filenames = await pollBatch(ref.batchId);
        store.setAudioSpecialBed(ref.specialKind, { status: 'done', filenames, selected: 0 });
        return;
      }
      case 'audioVariation': {
        const filenames = await pollBatch(ref.batchId);
        store.setAudioVariation(ref.liId, ref.tone, { status: 'done', filenames, selected: 0 });
        return;
      }
      case 'audioSfx': {
        const fileById = await pollBatchById(ref.batchId);
        for (const [emotion, file] of Object.entries(fileById)) store.setAudioSfx(emotion, file);
        store.setAudioSfxState({ status: 'done', filenames: Object.values(fileById), selected: 0 });
        return;
      }
    }
  } catch (e) {
    const error = lostBatch(e);
    const failed = useNarrativeStore.getState();
    switch (ref.kind) {
      case 'image':
        failed.setImage(ref.key, { status: 'failed', error });
        return;
      case 'character':
        failed.setCharacter(ref.liId, { status: 'failed', error });
        return;
      case 'audioBase':
        failed.setAudioBase({ status: 'failed', error });
        return;
      case 'audioMoodBed':
        failed.setAudioMoodBed(ref.mood, { status: 'failed', error });
        return;
      case 'audioSpecialBed':
        failed.setAudioSpecialBed(ref.specialKind, { status: 'failed', error });
        return;
      case 'audioVariation':
        failed.setAudioVariation(ref.liId, ref.tone, { status: 'failed', error });
        return;
      case 'audioSfx':
        failed.setAudioSfxState({ status: 'failed', error });
        return;
    }
  }
}

const INITIALIZERS: NarrativeInitializer[] = [
  {
    // QA-прогон не резюмируется (дёшев и детерминирован в D2/D3-части) —
    // зависший после reload state='running' честно сбрасывается в idle.
    name: 'story-qa-sanitize',
    init: async () => {
      if (useNarrativeStore.getState().storyQA?.state === 'running') {
        useNarrativeStore.getState().setStoryQA(null);
      }
    },
  },
  {
    name: 'calendar-run-resume',
    init: async () => {
      if (decideInitAction(useNarrativeStore.getState().calendarRun) === 'resume') {
        await resumeCalendarRun();
      }
    },
  },
  {
    name: 'media-batch-reattach',
    init: async () => {
      const s = useNarrativeStore.getState();
      const refs = collectMediaBatches({
        images: s.images,
        characters: s.characters,
        audioBase: s.audioBase,
        audioMoodBeds: s.audioMoodBeds,
        audioSpecialBeds: s.audioSpecialBeds,
        audioByLi: s.audioByLi,
        audioSfxState: s.audioSfxState,
      });
      await Promise.all(refs.map(reattachMediaBatch));
    },
  },
];

/**
 * Извлечь calendarRun из сырого значения localStorage (чистая функция).
 * Возвращает undefined, если значение непарсимо — тогда синк пропускает событие.
 */
export function parseCalendarRunFromRaw(raw: string | null): CalendarRunState | null | undefined {
  if (raw == null) return undefined;
  try {
    return (JSON.parse(raw)?.state?.calendarRun ?? null) as CalendarRunState | null;
  } catch {
    return undefined;
  }
}

/**
 * Кросс-вкладочный показ прогресса. Web Lock не даёт второй вкладке ВЕСТИ
 * прогон, но её UI должен видеть, как он идёт в ведущей вкладке. Обновляем
 * ТОЛЬКО calendarRun (прогресс), не трогая images/audio/… — их наблюдающая
 * вкладка может генерировать сама, и полный rehydrate затёр бы её работу.
 *
 * Ведущая вкладка (isCalendarRunActive) события игнорирует: её состояние
 * свежее записи, пришедшей от наблюдателя.
 */
function subscribeCrossTabProgress(): void {
  if (typeof window === 'undefined') return;
  window.addEventListener('storage', e => {
    if (e.key !== NARRATIVE_STORE_KEY || isCalendarRunActive()) return;
    const nextRun = parseCalendarRunFromRaw(e.newValue);
    if (nextRun === undefined) return;
    useNarrativeStore.setState({ calendarRun: nextRun });
  });
}

/**
 * Fire-and-forget: зовётся до render(). Стор zustand+persist на localStorage
 * гидрируется синхронно при импорте модуля, поэтому состояние здесь уже полное.
 */
export function initNarrative(): void {
  subscribeCrossTabProgress();
  for (const initializer of INITIALIZERS) {
    initializer.init().catch(e => {
      console.warn(`[init:${initializer.name}] ${e instanceof Error ? e.message : String(e)}`);
    });
  }
}
