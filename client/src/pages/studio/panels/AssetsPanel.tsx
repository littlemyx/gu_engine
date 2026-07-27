import React, { useMemo } from 'react';

import { useNarrativeStore } from '@/narrative/narrativeStore';
import ActionButton from '@/ui/ActionButton';
import PrefabCard from '@/ui/PrefabCard';

import { CANONICAL_POSES } from '@/narrative';

import { isSameSelection, useStudioStore } from '../studioStore';

import styles from './panels.module.css';

import type { AudioTrackState, CharacterGenState, ImageGenState } from '@/narrative/narrativeStore';
import type { Brief } from '@/narrative/types';
import type { PrefabTone } from '@/ui/PrefabCard';
import type { Selection } from '../studioStore';

export interface AssetsPanelProps {
  brief: Brief;
  onGenerateBackgrounds: () => void;
  onGenerateSprites: () => void;
  /** Полная перерисовка каста: clearCharacters + force. */
  onForceSprites: () => void;
  /** Идёт медиа-генерация: кнопки заперты, причина печатается строкой. */
  busy: boolean;
  /** Нет истории — генерировать не из чего. */
  disabledReason?: string;
}

type Card = {
  key: string;
  glyph: string;
  title: string;
  kind: string;
  src: string;
  status: string;
  tone: PrefabTone;
  selection: Selection;
};

const imageTone = (state: ImageGenState | undefined): { status: string; tone: PrefabTone } => {
  if (!state) return { status: '— не в очереди', tone: 'muted' };
  switch (state.status) {
    case 'done':
      return { status: '✓ готово', tone: 'ok' };
    case 'generating':
      return { status: '⟳ рисуется', tone: 'wait' };
    case 'pending':
      return { status: '⟳ в очереди', tone: 'wait' };
    default:
      return { status: `✗ ${state.error}`, tone: 'bad' };
  }
};

const characterTone = (state: CharacterGenState | undefined): { status: string; tone: PrefabTone } => {
  if (!state) return { status: '— не в очереди', tone: 'muted' };
  switch (state.status) {
    case 'done': {
      const poses = Object.keys(state.poseFilenames ?? {}).length;
      return { status: poses > 0 ? `✓ idle + ${poses} поз` : '✓ idle', tone: 'ok' };
    }
    case 'generating':
      return { status: '⟳ рисуется', tone: 'wait' };
    case 'pending':
      return { status: '⟳ в очереди', tone: 'wait' };
    default:
      return { status: `✗ ${state.error}`, tone: 'bad' };
  }
};

const audioTone = (state: AudioTrackState | null | undefined): { status: string; tone: PrefabTone } => {
  if (!state) return { status: '— не в очереди', tone: 'muted' };
  switch (state.status) {
    case 'done':
      return { status: `✓ вариант ${state.selected + 1} из ${state.filenames.length}`, tone: 'ok' };
    case 'generating':
      return { status: '⟳ пишется', tone: 'wait' };
    case 'pending':
      return { status: '⟳ в очереди', tone: 'wait' };
    default:
      return { status: `✗ ${state.error}`, tone: 'bad' };
  }
};

/** Док «Ассеты»: фоны, спрайты и аудио одной сеткой карточек. */
const AssetsPanel = ({
  brief,
  onGenerateBackgrounds,
  onGenerateSprites,
  onForceSprites,
  busy,
  disabledReason,
}: AssetsPanelProps) => {
  const worldModel = useNarrativeStore(s => s.worldModel);
  const images = useNarrativeStore(s => s.images);
  const characters = useNarrativeStore(s => s.characters);
  const audioBase = useNarrativeStore(s => s.audioBase);
  const audioMoodBeds = useNarrativeStore(s => s.audioMoodBeds);
  const audioSpecialBeds = useNarrativeStore(s => s.audioSpecialBeds);
  const audioByLi = useNarrativeStore(s => s.audioByLi);
  const audioSfxState = useNarrativeStore(s => s.audioSfxState);

  const selection = useStudioStore(s => s.selection);
  const select = useStudioStore(s => s.select);
  const openModal = useStudioStore(s => s.openModal);
  const openAudioTab = useStudioStore(s => s.openAudioTab);

  // Счётчик в точке входа: сколько поз не хватает у готовых персонажей.
  const missingPoses = useMemo(
    () =>
      Object.values(characters)
        .filter(state => state.status === 'done')
        .reduce(
          (acc, state) => acc + CANONICAL_POSES.filter(pose => pose !== 'idle' && !state.poseFilenames?.[pose]).length,
          0,
        ),
    [characters],
  );

  const cards = useMemo((): Card[] => {
    const out: Card[] = [];

    for (const location of worldModel?.locations ?? []) {
      const { status, tone } = imageTone(images[`loc:${location.id}`]);
      out.push({
        key: `bg:${location.id}`,
        glyph: '▦',
        title: location.name || location.id,
        kind: 'фон',
        src: 'image_gen',
        status,
        tone,
        selection: { kind: 'location', id: location.id },
      });
    }

    for (const li of brief.loveInterests) {
      const { status, tone } = characterTone(characters[li.id]);
      out.push({
        key: `sprite:${li.id}`,
        glyph: '◐',
        title: li.name || li.id,
        kind: 'спрайт',
        src: 'image_gen',
        status,
        tone,
        selection: { kind: 'character', id: li.id },
      });
    }

    const base = audioTone(audioBase);
    out.push({
      key: 'audio:base',
      glyph: '♪',
      title: 'Подложка',
      kind: 'аудио',
      src: 'suno · neutral_calm',
      status: base.status,
      tone: base.tone,
      selection: null,
    });

    for (const [mood, state] of Object.entries(audioMoodBeds)) {
      const { status, tone } = audioTone(state);
      out.push({
        key: `audio:mood:${mood}`,
        glyph: '♪',
        title: mood,
        kind: 'эмбиент',
        src: 'suno · настроение',
        status,
        tone,
        selection: null,
      });
    }

    for (const [kind, state] of Object.entries(audioSpecialBeds)) {
      const { status, tone } = audioTone(state);
      out.push({
        key: `audio:special:${kind}`,
        glyph: '♪',
        title: kind,
        kind: 'эмбиент',
        src: 'suno · диегетика',
        status,
        tone,
        selection: null,
      });
    }

    for (const li of brief.loveInterests) {
      for (const tone of ['positive', 'negative'] as const) {
        const state = audioByLi[li.id]?.[tone];
        if (!state) continue;
        const view = audioTone(state);
        out.push({
          key: `audio:li:${li.id}:${tone}`,
          glyph: '♪',
          title: `${li.name || li.id} · ${tone === 'positive' ? 'тепло' : 'холод'}`,
          kind: 'вариация',
          src: 'suno',
          status: view.status,
          tone: view.tone,
          selection: { kind: 'character', id: li.id },
        });
      }
    }

    const sfx = audioTone(audioSfxState);
    out.push({
      key: 'audio:sfx',
      glyph: '♪',
      title: 'SFX-набор',
      kind: 'звуки',
      src: 'suno · эмоции',
      status: sfx.status,
      tone: sfx.tone,
      selection: null,
    });

    return out;
  }, [
    worldModel,
    images,
    brief.loveInterests,
    characters,
    audioBase,
    audioMoodBeds,
    audioSpecialBeds,
    audioByLi,
    audioSfxState,
  ]);

  const reason = disabledReason ?? (busy ? 'идёт генерация медиа' : undefined);
  const disabled = Boolean(disabledReason) || busy;

  return (
    <div className={styles.dockBody}>
      <div className={styles.dockActions}>
        <ActionButton
          label="Дорисовать фоны"
          cost="≈ $0.03 за фон"
          kind="outline"
          disabled={disabled}
          reason={reason}
          onClick={onGenerateBackgrounds}
        />
        <ActionButton
          label="Дорисовать спрайты"
          cost="≈ $0.04 за героя"
          kind="outline"
          disabled={disabled}
          reason={reason}
          onClick={onGenerateSprites}
        />
        <ActionButton
          label="Перерисовать все спрайты"
          cost="≈ $0.04 за героя"
          kind="outline"
          disabled={disabled}
          reason={reason}
          onClick={onForceSprites}
        />
      </div>

      <div className={styles.dockGrid}>
        {cards.map(card => (
          <PrefabCard
            key={card.key}
            glyph={card.glyph}
            title={card.title}
            kind={card.kind}
            src={card.src}
            status={card.status}
            tone={card.tone}
            selected={card.selection != null && isSameSelection(selection, card.selection)}
            onClick={card.selection ? () => select(card.selection) : undefined}
          />
        ))}
      </div>

      {/* Аудио, настроения и позы живут во вкладке и модалках — здесь входы. */}
      <div className={styles.dockActions}>
        <ActionButton label="♪ Аудио · банк и запуск" kind="ghost" onClick={openAudioTab} />
        <ActionButton label="Настроения локаций…" kind="ghost" onClick={() => openModal({ kind: 'locationMoods' })} />
        <ActionButton
          label={missingPoses > 0 ? `Недостающие позы (${missingPoses})…` : 'Недостающие позы…'}
          kind="ghost"
          onClick={() => openModal({ kind: 'poses' })}
        />
      </div>
    </div>
  );
};

export default AssetsPanel;
