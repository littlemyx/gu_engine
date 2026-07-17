import type { AnchorBeat, EndingVariant, WorldModel } from './types';
import { DEFAULT_LOCATION_MOOD, isLocationMood, isSpecialAmbientKind } from './types';
import type { AnchorNarrations, Calendar, CastPlan, CharacterSchedule, EventUnit, SpinePlan } from './calendarTypes';
import type { DialogueUnit } from './dialogueUnit';
import type { CalendarRunState } from './calendarRunState';
import type { StoryQAStatus } from './storyQA';
import type { AudioTrackState, CharacterGenState, ImageGenState, LiAudioState } from './narrativeStore';
import { locationFingerprint, locationImageKey } from './imageFingerprint';

/**
 * Миграция персистнутого нарративного стора. Вынесена из narrativeStore, чтобы
 * покрываться node-тестами без создания стора и localStorage.
 *
 * Без migrate zustand выбрасывает состояние при несовпадении версии — дорогие
 * кэши генерации должны переживать апгрейд схемы, поэтому мы дозаполняем
 * недостающие поля дефолтами, а не сбрасываем всё.
 */
export type PersistedNarrativeState = {
  images: Record<string, ImageGenState>;
  characters: Record<string, CharacterGenState>;
  endings: Record<string, EndingVariant>;
  worldModel: WorldModel | null;
  castPlan: CastPlan | null;
  calendar: Calendar | null;
  tagMap: Record<string, string[]> | null;
  anchorNarrations: AnchorNarrations | null;
  spine: SpinePlan | null;
  schedule: CharacterSchedule | null;
  eventUnits: Record<string, EventUnit>;
  unitProse: Record<string, DialogueUnit[]>;
  spineBeatProse: Record<string, AnchorBeat>;
  audioBase: AudioTrackState | null;
  audioMoodBeds: Record<string, AudioTrackState>;
  audioSpecialBeds: Record<string, AudioTrackState>;
  audioByLi: Record<string, LiAudioState>;
  audioSfx: Record<string, string>;
  audioSfxState: AudioTrackState | null;
  calendarRun: CalendarRunState | null;
  storyQA: StoryQAStatus | null;
};

export const NARRATIVE_STORE_VERSION = 14;

/**
 * v11→v12: у готовых фонов появился locationHash. Существующие картинки
 * нарисованы по ТЕКУЩЕМУ миру (другого в сторе нет), поэтому проставляем им
 * отпечаток нынешних локаций — иначе они разом сочтутся протухшими и автор
 * заплатит за перерисовку того, что и так актуально.
 */
function backfillImageHashes(
  images: Record<string, ImageGenState>,
  worldModel: WorldModel | null,
): Record<string, ImageGenState> {
  if (!worldModel) return images;
  const byKey = new Map(worldModel.locations.map(loc => [locationImageKey(loc.id), locationFingerprint(loc)]));
  return Object.fromEntries(
    Object.entries(images).map(([key, state]) => {
      if (state.status !== 'done' || state.locationHash != null) return [key, state];
      const fingerprint = byKey.get(key);
      return [key, fingerprint ? { ...state, locationHash: fingerprint } : state];
    }),
  );
}

export function migratePersistedNarrativeState(persisted: unknown): PersistedNarrativeState {
  const prev = (persisted ?? {}) as Partial<PersistedNarrativeState>;
  // v7→v8: у persisted-локаций нет mood/specialKind. Инжектим дефолты, иначе
  // required-поле mood окажется undefined в рантайме (тип бы соврал).
  const worldModel = prev.worldModel
    ? {
        ...prev.worldModel,
        locations: prev.worldModel.locations.map(l => ({
          ...l,
          mood: isLocationMood(l.mood) ? l.mood : DEFAULT_LOCATION_MOOD,
          specialKind: isSpecialAmbientKind(l.specialKind) ? l.specialKind : null,
        })),
      }
    : null;
  // v9→v10: легаси-ключи (outline/segments/storyOutline/narrationWebs/
  // dialogueVariants/anchorBeats/beatPlan) просто не переносятся.
  return {
    images: backfillImageHashes(prev.images ?? {}, worldModel),
    characters: prev.characters ?? {},
    endings: prev.endings ?? {},
    worldModel,
    // v8→v9: календарный пайплайн — новые поля, кэши прежних стадий не трогаем.
    castPlan: prev.castPlan ?? null,
    calendar: prev.calendar ?? null,
    tagMap: prev.tagMap ?? null,
    spine: prev.spine ?? null,
    schedule: prev.schedule ?? null,
    eventUnits: prev.eventUnits ?? {},
    // Фаза 3: unitProse хранит DialogueUnit[] (узловые графы). Записи старой
    // DialogueVariant-формы (без nodes) выбрасываются — поле никогда не
    // наполнялось «в дикой природе», а компилятор формы без nodes не понимает.
    unitProse: Object.fromEntries(
      Object.entries(prev.unitProse ?? {}).filter(
        ([, units]) => Array.isArray(units) && units.every(u => Array.isArray((u as Partial<DialogueUnit>)?.nodes)),
      ),
    ),
    spineBeatProse: prev.spineBeatProse ?? {},
    audioBase: prev.audioBase ?? null,
    audioMoodBeds: prev.audioMoodBeds ?? {},
    audioSpecialBeds: prev.audioSpecialBeds ?? {},
    audioByLi: prev.audioByLi ?? {},
    audioSfx: prev.audioSfx ?? {},
    // v10→v11: audioSfxState и calendarRun персистятся — незавершённые батчи
    // и черновик прогона дожимает init-система (initNarrative) после reload.
    audioSfxState: prev.audioSfxState ?? null,
    calendarRun: prev.calendarRun ?? null,
    // v12→v13: отчёт Story QA персистится; переносится только завершённый
    // ('running' пережил бы reload зомби — его и на живом сторе чистит init).
    storyQA: prev.storyQA?.state === 'done' ? prev.storyQA : null,
    // v13→v14: якорные переходы (диегетическая смена части дня вместо кнопки
    // «Подождать»). Пусто — компилятор берёт статичные подписи: старая история
    // играбельна без единой новой генерации.
    anchorNarrations: prev.anchorNarrations ?? null,
  };
}
