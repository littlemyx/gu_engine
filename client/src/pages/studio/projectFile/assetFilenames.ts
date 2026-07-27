import type { AudioTrackState, CharacterGenState, ImageGenState, LiAudioState } from '@/narrative/narrativeStore';
import type { ProjectNarrativeSlice } from './projectFileFormat';

/**
 * Единственное место, где перечислены поля состояния, хранящие имена файлов
 * на image_server/audio_server.
 *
 * Сбор (что класть в архив) и ремап (чем заменить после переаплоада) ходят
 * одним визитором намеренно: забытое поле тогда падает в round-trip-тесте,
 * а не молча теряет спрайт при открытии проекта. Обход целевой, а не
 * «заменить строку везде»: имена не должны случайно переписываться в прозе,
 * а картиночное и звуковое пространства имён не должны смешиваться.
 */

export type AssetKind = 'image' | 'audio';

/** Возвращает имя, которым надо заменить встреченное (или его же). */
export type AssetVisitor = (kind: AssetKind, filename: string) => string;

function visitImageState(state: ImageGenState, visit: AssetVisitor): ImageGenState {
  if (state.status !== 'done') return state;
  const filename = visit('image', state.filename);
  return filename === state.filename ? state : { ...state, filename };
}

function visitCharacterState(state: CharacterGenState, visit: AssetVisitor): CharacterGenState {
  if (state.status !== 'done') return state;
  const idleFilename = visit('image', state.idleFilename);
  const poses = state.poseFilenames;
  const nextPoses = poses
    ? Object.fromEntries(Object.entries(poses).map(([pose, filename]) => [pose, visit('image', filename)]))
    : undefined;
  return { ...state, idleFilename, ...(nextPoses ? { poseFilenames: nextPoses } : null) };
}

function visitTrack(state: AudioTrackState, visit: AssetVisitor): AudioTrackState {
  if (state.status !== 'done') return state;
  return { ...state, filenames: state.filenames.map(filename => visit('audio', filename)) };
}

function visitTrackMap(map: Record<string, AudioTrackState>, visit: AssetVisitor): Record<string, AudioTrackState> {
  return Object.fromEntries(Object.entries(map).map(([key, track]) => [key, visitTrack(track, visit)]));
}

function visitLiAudio(map: Record<string, LiAudioState>, visit: AssetVisitor): Record<string, LiAudioState> {
  return Object.fromEntries(
    Object.entries(map).map(([liId, tones]) => [
      liId,
      Object.fromEntries(
        Object.entries(tones).map(([tone, track]) => [tone, track ? visitTrack(track, visit) : track]),
      ) as LiAudioState,
    ]),
  );
}

/**
 * Иммутабельно пересобирает слайс, пропуская каждое имя файла через визитор.
 * Ветки, которых визитор не коснулся, остаются теми же объектами.
 */
export function mapAssetFilenames(state: ProjectNarrativeSlice, visit: AssetVisitor): ProjectNarrativeSlice {
  return {
    ...state,
    images: Object.fromEntries(
      Object.entries(state.images).map(([key, image]) => [key, visitImageState(image, visit)]),
    ),
    characters: Object.fromEntries(
      Object.entries(state.characters).map(([liId, character]) => [liId, visitCharacterState(character, visit)]),
    ),
    audioBase: state.audioBase ? visitTrack(state.audioBase, visit) : null,
    audioMoodBeds: visitTrackMap(state.audioMoodBeds, visit),
    audioSpecialBeds: visitTrackMap(state.audioSpecialBeds, visit),
    audioByLi: visitLiAudio(state.audioByLi, visit),
    audioSfx: Object.fromEntries(
      Object.entries(state.audioSfx).map(([emotion, filename]) => [emotion, visit('audio', filename)]),
    ),
    audioSfxState: state.audioSfxState ? visitTrack(state.audioSfxState, visit) : null,
  };
}

/** Все имена файлов, на которые ссылается состояние проекта. */
export function collectAssetFilenames(state: ProjectNarrativeSlice): { images: Set<string>; audio: Set<string> } {
  const images = new Set<string>();
  const audio = new Set<string>();
  mapAssetFilenames(state, (kind, filename) => {
    if (filename) (kind === 'image' ? images : audio).add(filename);
    return filename;
  });
  return { images, audio };
}

/**
 * Переименование после загрузки на сервер: сервер всегда выдаёт файлу новое
 * имя, поэтому импортированное состояние обязано ссылаться на выданные.
 */
export function remapAssetFilenames(
  state: ProjectNarrativeSlice,
  imageMap: ReadonlyMap<string, string>,
  audioMap: ReadonlyMap<string, string>,
): ProjectNarrativeSlice {
  if (imageMap.size === 0 && audioMap.size === 0) return state;
  return mapAssetFilenames(state, (kind, filename) => {
    const next = (kind === 'image' ? imageMap : audioMap).get(filename);
    return next ?? filename;
  });
}
