import React, { useMemo, useState } from 'react';

import { useBriefStore } from '@/narrative/briefStore';
import { useNarrativeStore } from '@/narrative/narrativeStore';
import { useBulkAudioGeneration, buildBaseStyle } from '@/narrative/useBulkAudioGeneration';
import { useBulkCharacterGeneration } from '@/narrative/useBulkCharacterGeneration';
import { useBulkImageGeneration } from '@/narrative/useBulkImageGeneration';
import MutedText from '@/ui/kit/atoms/MutedText';
import OutlineButton from '@/ui/kit/atoms/OutlineButton';
import InplacePreview from '@/ui/kit/molecules/InplacePreview';
import MediaPlaceholder from '@/ui/kit/molecules/MediaPlaceholder';
import MoodBedRow from '@/ui/kit/molecules/MoodBedRow';
import PlaybackBadge from '@/ui/kit/molecules/PlaybackBadge';
import SpriteCell from '@/ui/kit/molecules/SpriteCell';
import TrackRow from '@/ui/kit/molecules/TrackRow';

import { deriveMedia } from './mediaModel';

import styles from './shell.module.css';
import media from './MediaZone.module.css';

import type { MoodBedRowState } from '@/ui/kit/molecules/MoodBedRow';
import type { AudioPositionKind, AudioPositionRow, MediaStatus } from './mediaModel';

const POSE_RU: Record<string, string> = {
  idle: 'идл',
  happy: 'радость',
  sad: 'грусть',
  tense: 'напряжение',
  soft: 'нежность',
  thoughtful: 'задумчивость',
  surprised: 'удивление',
  angry: 'злость',
};

/** Заглушка позиции для статусов, отличных от «готово». */
function placeholderLabel(kind: string, name: string, status: MediaStatus, error?: string): string {
  if (status === 'generating') return `${kind} «${name}» — генерируется…`;
  if (status === 'failed') return `${kind} «${name}» — ошибка: ${error ?? 'не удалось'}`;
  return `${kind} «${name}» — заглушка`;
}

/**
 * Зона 3 «Медиа»: три дорожки конвейера — фоны, спрайты, звук.
 *
 * Позиция не открывает отдельный инспектор: готовый фон разворачивается
 * инплейс (`InplacePreview`), а сравнение дублей звука — прямо под строкой
 * по клику на ▶ (`MoodBedRow` → `TrackRow`×2), тем же приёмом, что и у
 * фона — без попапов, инвариант шелла держится и здесь.
 *
 * Пропов нет: брифом и кэшами генерации владеют briefStore/narrativeStore,
 * зона лишь их читает — так её можно воткнуть в `ZoneView` одной строкой,
 * без лишней проводки данных сверху (см. `QaZone`, тот же приём).
 */
const MediaZone = () => {
  const brief = useBriefStore(s => s.brief);
  const spine = useNarrativeStore(s => s.spine);
  const storyRunning = useNarrativeStore(s => s.calendarRun?.status === 'running');
  const worldModel = useNarrativeStore(s => s.worldModel);
  const images = useNarrativeStore(s => s.images);
  const characters = useNarrativeStore(s => s.characters);
  const audioBase = useNarrativeStore(s => s.audioBase);
  const audioMoodBeds = useNarrativeStore(s => s.audioMoodBeds);
  const audioByLi = useNarrativeStore(s => s.audioByLi);

  const selectAudioBase = useNarrativeStore(s => s.selectAudioBase);
  const selectAudioMoodBed = useNarrativeStore(s => s.selectAudioMoodBed);
  const selectAudioVariation = useNarrativeStore(s => s.selectAudioVariation);

  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [playingTake, setPlayingTake] = useState<string | null>(null);

  const imageGen = useBulkImageGeneration();
  const characterGen = useBulkCharacterGeneration();
  const audioGen = useBulkAudioGeneration();

  const model = useMemo(
    () => deriveMedia({ brief, worldModel, images, characters, audioBase, audioMoodBeds, audioByLi }),
    [brief, worldModel, images, characters, audioBase, audioMoodBeds, audioByLi],
  );

  const pickTake = (position: AudioPositionKind, index: number) => {
    if (position.kind === 'base') selectAudioBase(index);
    else if (position.kind === 'mood') selectAudioMoodBed(position.mood, index);
    else selectAudioVariation(position.liId, position.tone, index);
  };

  // Прямые входы вместо deriveLegacyOutline: хукам от outline нужны только
  // title/logline как контекст промпта, а фоны при живой модели мира и вовсе
  // идут по локациям (см. useBulkImageGeneration).
  const outlineCtx = spine ? { title: spine.title, logline: spine.logline, anchors: [] } : null;

  // Причина, почему дорожку нельзя запустить; null — можно.
  const launchBlock = storyRunning ? 'идёт прогон истории' : spine == null ? 'истории ещё нет' : null;
  const backgroundsBlock = launchBlock ?? (worldModel == null ? 'мир ещё не собран' : null);
  const spritesBlock = launchBlock ?? ((brief.loveInterests?.length ?? 0) === 0 ? 'некого рисовать' : null);

  const generateBackgrounds = () => {
    if (outlineCtx) void imageGen.start(brief, outlineCtx);
  };
  const generateSprites = () => {
    if (outlineCtx) void characterGen.start(brief, outlineCtx);
  };
  // Стиль подложки — дефолт из брифа; тонкая правка стиля приедет позже.
  const generateAudio = () => void audioGen.start(brief, buildBaseStyle(brief));

  return (
    <div className={styles.zoneBody}>
      <h1 className={styles.zoneHeading}>Медиа</h1>
      <p className={styles.zoneHint}>фоны, спрайты и звук — дорожками, параллельно</p>

      <section className={styles.section}>
        <div className={media.laneHeader}>
          <div
            className={styles.kicker}
          >{`Фоны · ${model.counts.backgrounds.done} из ${model.counts.backgrounds.total}`}</div>
          <TrackLaunch
            label="Сгенерировать фоны"
            busy={imageGen.status.state === 'running'}
            progress={progressOf(imageGen.status)}
            block={backgroundsBlock}
            onStart={generateBackgrounds}
            onCancel={imageGen.cancel}
          />
        </div>
        {model.backgrounds.length === 0 ? (
          <p className={styles.empty}>Мир ещё не собран — фонам пока не из чего взяться.</p>
        ) : (
          <div className={media.lane}>
            {model.backgrounds.map(row => (
              <div key={row.key} className={media.row}>
                {row.status === 'done' ? (
                  <InplacePreview caption={row.name} note={row.filename ?? ''} />
                ) : (
                  <MediaPlaceholder label={placeholderLabel('фон', row.name, row.status, row.error)} />
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className={styles.section}>
        <div className={media.laneHeader}>
          <div
            className={styles.kicker}
          >{`Спрайты · ${model.counts.sprites.done} из ${model.counts.sprites.total}`}</div>
          <TrackLaunch
            label="Сгенерировать спрайты"
            busy={characterGen.status.state === 'running'}
            progress={progressOf(characterGen.status)}
            block={spritesBlock}
            onStart={generateSprites}
            onCancel={characterGen.cancel}
          />
        </div>
        {model.sprites.length === 0 ? (
          <p className={styles.empty}>В брифе нет ни одного love interest — спрайтам некого рисовать.</p>
        ) : (
          <div className={media.lane}>
            {model.sprites.map(row => (
              <div key={row.key} className={media.spriteRow}>
                <span className={media.spriteName}>{row.name}</span>
                {row.status === 'done' ? (
                  <div className={media.poses}>
                    {row.poses.map(cell => (
                      <SpriteCell
                        key={cell.pose}
                        label={POSE_RU[cell.pose] ?? cell.pose}
                        state={cell.accepted ? 'accepted' : 'awaiting'}
                        width={44}
                        height={64}
                      />
                    ))}
                  </div>
                ) : (
                  <MediaPlaceholder label={placeholderLabel('спрайт', row.name, row.status, row.error)} />
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className={styles.section}>
        <div className={media.laneHeader}>
          <div className={styles.kicker}>{`Звук · ${model.counts.audio.done} из ${model.counts.audio.total}`}</div>
          <TrackLaunch
            label="Сгенерировать звук"
            busy={audioGen.status.state === 'running'}
            progress={progressOf(audioGen.status)}
            block={launchBlock}
            onStart={generateAudio}
            onCancel={audioGen.cancel}
          />
        </div>
        <div className={media.lane}>
          {model.audio.map(row => (
            <AudioRow
              key={row.key}
              row={row}
              expanded={expandedKey === row.key}
              onToggleExpand={() => setExpandedKey(expandedKey === row.key ? null : row.key)}
              onPick={index => pickTake(row.position, index)}
              playingTake={playingTake}
              onPlayToggle={takeKey => setPlayingTake(playingTake === takeKey ? null : takeKey)}
            />
          ))}
        </div>
      </section>
    </div>
  );
};

/** «3 из 8», пока дорожка занята; статусы всех трёх хуков несут total/completed. */
function progressOf(status: { state: string }): string | null {
  if (status.state !== 'running') return null;
  const s = status as { total?: number; completed?: number };
  return typeof s.total === 'number' ? `${s.completed ?? 0} из ${s.total}` : 'идёт…';
}

interface TrackLaunchProps {
  label: string;
  busy: boolean;
  progress: string | null;
  /** Причина, почему запуск заперт; null — можно. */
  block: string | null;
  onStart: () => void;
  onCancel: () => void;
}

/** Запуск дорожки в шапке: кнопка со сменой на «Отмена» и причина запрета. */
const TrackLaunch = ({ label, busy, progress, block, onStart, onCancel }: TrackLaunchProps) => (
  <div className={media.laneActions}>
    {busy && progress && <MutedText text={progress} size={10} />}
    {!busy && block && <MutedText text={block} size={10} />}
    {busy ? (
      <OutlineButton label="Отмена" size="compact" onClick={onCancel} />
    ) : (
      <OutlineButton label={label} tone="accent" size="compact" disabled={block != null} onClick={onStart} />
    )}
  </div>
);

interface AudioRowProps {
  row: AudioPositionRow;
  expanded: boolean;
  onToggleExpand: () => void;
  onPick: (index: number) => void;
  playingTake: string | null;
  onPlayToggle: (takeKey: string) => void;
}

const MOOD_ROW_STATE: Record<Exclude<MediaStatus, 'done'>, MoodBedRowState> = {
  generating: 'generating',
  missing: 'queue',
  // MoodBedRow не знает состояния «ошибка» — ближайшее по смыслу занятое
  // место занимает слот примечания (`note`), текст берём из ошибки трека.
  failed: 'note',
};

/** Одна позиция дорожки звука: строка статуса + инплейс-сравнение дублей по ▶. */
const AudioRow = ({ row, expanded, onToggleExpand, onPick, playingTake, onPlayToggle }: AudioRowProps) => {
  const done = row.track?.status === 'done' ? row.track : null;
  const errorText = row.track?.status === 'failed' ? row.track.error : undefined;
  const choice: 'A' | 'B' = done?.selected === 1 ? 'B' : 'A';

  return (
    <div className={media.audioPosition}>
      <MoodBedRow
        label={row.label}
        code={row.mono}
        width={420}
        state={row.status === 'done' ? 'choice' : MOOD_ROW_STATE[row.status]}
        choice={choice}
        note={errorText ? `✗ ${errorText}` : undefined}
        onPick={done ? letter => onPick(letter === 'A' ? 0 : 1) : undefined}
        onPlay={done ? onToggleExpand : undefined}
      />

      {expanded && done && (
        <div className={media.compare}>
          {done.filenames.map((_filename, index) => {
            const takeKey = `${row.key}:${index}`;
            return (
              <TrackRow
                key={takeKey}
                label={index === 0 ? 'Вариант A' : 'Вариант Б'}
                // Длительность дубля не приходит в AudioTrackState — молчаливого
                // прочерка честнее, чем выдуманный таймкод.
                time="—"
                selected={done.selected === index}
                onSelect={() => onPick(index)}
                onPlay={() => onPlayToggle(takeKey)}
              />
            );
          })}
          {playingTake?.startsWith(`${row.key}:`) && (
            <span className={media.playbackChip}>
              <PlaybackBadge label={`дубль ${playingTake.endsWith(':0') ? 'A' : 'Б'} в предпрослушивании`} />
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default MediaZone;
