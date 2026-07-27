import React from 'react';

import ActionButton from '@/ui/ActionButton';
import BeatCard from '@/ui/BeatCard';
import Blueprint from '@/ui/Blueprint';
import ConsoleLine from '@/ui/ConsoleLine';
import HierarchyRow from '@/ui/HierarchyRow';
import PrefabCard from '@/ui/PrefabCard';
import ShellToolbar from '@/ui/ShellToolbar';
import SlotCell from '@/ui/SlotCell';
import StatusBar from '@/ui/StatusBar';
import {
  IconAssets,
  IconAudio,
  IconBlueprint,
  IconConsole,
  IconMap,
  IconPrefabs,
  IconQa,
  IconScore,
  IconScript,
} from '@/ui/icons';

import styles from './gallery.module.css';

import type { BeatCardState } from '@/ui/BeatCard';
import type { ConsoleTone } from '@/ui/ConsoleLine';
import type { HierarchyRowState } from '@/ui/HierarchyRow';
import type { PrefabTone } from '@/ui/PrefabCard';
import type { ShellMode } from '@/ui/ShellToolbar';
import type { SlotCellState } from '@/ui/SlotCell';

const BEAT_STATES: BeatCardState[] = ['done', 'failed', 'running', 'locked'];
const SLOT_STATES: SlotCellState[] = ['loc', 'offscreen', 'done', 'open', 'locked', 'failed', 'empty'];
const ROW_STATES: HierarchyRowState[] = ['normal', 'selected', 'failed', 'running', 'dim'];
const TONES: ConsoleTone[] = ['info', 'ok', 'run', 'error', 'pending'];
const PREFAB_TONES: PrefabTone[] = ['ok', 'wait', 'bad', 'muted'];
const MODES: ShellMode[] = ['idle', 'running', 'blocked', 'empty'];

const ACCENT_RAMP = [100, 200, 300, 400, 500, 600, 700, 800, 900];

/**
 * Витрина атомов дизайн-системы во всех состояниях: сверка с макетом
 * «Планирование и генерация» до того, как из атомов собран шелл.
 */
const AtomGallery = () => (
  <div className={styles.page}>
    <ShellToolbar mode="idle" canContinueDraft branchLabel="все ▾" />

    <div className={styles.body}>
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>ShellToolbar · 4 режима</h2>
        <div className={styles.stack}>
          {MODES.map(mode => (
            <div key={mode} className={styles.stack}>
              <span className={styles.caption}>{mode}</span>
              <ShellToolbar
                mode={mode}
                canContinueDraft
                progress={0.62}
                meter="фаза 8/10 · диалоги 14/24 · $0.21 из ≈ $0.52"
                qaSummary="QA: 1 ошибка · 3 предупреждения"
              />
            </div>
          ))}
          <span className={styles.caption}>idle · compact (1280–1439)</span>
          <ShellToolbar mode="idle" compact canContinueDraft />
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>StatusBar · 4 режима</h2>
        <div className={styles.stack}>
          <StatusBar
            mode="idle"
            items={['черновик сохранён 12:41', 'слотов 21 · событий 34', 'QA: не запускался после правок']}
            right="seed 12345"
          />
          <StatusBar
            mode="running"
            items={['прогон идёт · 2 мин 14 с', 'автосохранение 8 с назад']}
            right="seed 12345 · web-lock: эта вкладка ведёт прогон"
          />
          <StatusBar
            mode="blocked"
            items={['QA: 1 ошибка · 3 предупреждения', 'экспорт заблокирован']}
            right="seed 12345"
          />
          <StatusBar mode="empty" items={['черновик пуст', 'потрачено $0.00']} right="seed —" />
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>BeatCard · состояния хребта</h2>
        <div className={styles.row}>
          {BEAT_STATES.map(state => (
            <BeatCard
              key={state}
              kicker="Бит 04 · Д4д–Д4в"
              title="Фестиваль ◈"
              state={state}
              onClick={() => undefined}
            />
          ))}
          <BeatCard kicker="Бит 04 · Д4д–Д4в" title="Выделенный" state="done" selected />
          <BeatCard kicker="Бит 05б · Д6у" title="Ветка не выбрана" state="done" dimmed />
          <BeatCard kicker="Бит 09 · финал" title="Расширенная карточка на 240px" state="done" width={240} />
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>SlotCell · 33×24, семь состояний</h2>
        <p className={styles.note}>
          Размер фиксирован: состояния кодируются заливкой и рамкой, детали уходят в инспектор. «КФ+2» — два события в
          слоте, счётчик вместо второй ячейки.
        </p>
        <div className={styles.row}>
          {SLOT_STATES.map(state => (
            <div key={state} className={styles.slotCase}>
              <SlotCell text="КФ" state={state} tip={`состояние: ${state}`} />
              <span className={styles.caption}>{state}</span>
            </div>
          ))}
          <div className={styles.slotCase}>
            <SlotCell text="КФ+2" state="done" />
            <span className={styles.caption}>счётчик</span>
          </div>
        </div>
        <div className={styles.slotRow}>
          {SLOT_STATES.map(state => (
            <SlotCell key={state} text="КФ" state={state} />
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>ActionButton · виды и запреты</h2>
        <p className={styles.note}>
          Стоимость всегда в лейбле, никогда в тултипе; недоступная кнопка объясняет причину строкой под собой;
          разрушающие действия — только outline и через модалку.
        </p>
        <Blueprint onChrome className={styles.chrome} withoutMarks>
          <div className={styles.chromeRow}>
            <ActionButton label="Догенерировать исход" cost="$0.04" kind="primary" />
            <ActionButton label="Сохранить как префаб" kind="outline" />
            <ActionButton label="Форкнуть → v3" kind="ghost" />
            <ActionButton label="Перегенерировать фон" cost="$0.03" kind="primary" disabled reason="идёт прогон" />
            <ActionButton label="Вставить в текущий каст" kind="outline" block />
          </div>
        </Blueprint>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>HierarchyRow · дерево на тёмном рейле</h2>
        <div className={styles.chrome}>
          <div className={styles.railBox}>
            <HierarchyRow label="Лето на Взморье" meta="v2" icon="▣" depth={0} />
            <HierarchyRow label="Б4 Фестиваль" meta="✓" icon="◈" depth={1} state="selected" onClick={() => undefined} />
            <HierarchyRow label="Кира" meta="С3" icon="◐" depth={2} state="running" />
            <HierarchyRow label="unit_kira_s3_warm" meta="✗" icon="›" depth={3} state="failed" />
            <HierarchyRow
              label="Очень длинное имя узла, которое обрезается эллипсисом"
              meta="—"
              icon="›"
              depth={3}
              state="dim"
            />
          </div>
          <div className={styles.railBox}>
            {ROW_STATES.map(state => (
              <HierarchyRow key={state} label={state} meta="✓" icon="◈" depth={1} state={state} />
            ))}
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>PrefabCard · префабы и ассеты одним компонентом</h2>
        <div className={styles.chrome}>
          <div className={styles.chromeRow}>
            {PREFAB_TONES.map(tone => (
              <PrefabCard
                key={tone}
                title={`Кира v2 (${tone})`}
                kind="персонаж"
                src="из «Лета на Взморье»"
                status="в 2 историях"
                tone={tone}
              />
            ))}
            <PrefabCard
              glyph="♪"
              title="Набор эмбиента"
              kind="аудио-сет"
              src="из «Лета на Взморье»"
              status="⟳ в очереди"
              tone="wait"
              selected
            />
            <PrefabCard
              glyph="▤"
              title="Кафе «Прибой»"
              kind="фон"
              src="сгенерирован"
              status="перетаскивается"
              dragging
            />
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>ConsoleLine · тоны лога</h2>
        <div className={styles.chrome}>
          {TONES.map(tone => (
            <ConsoleLine
              key={tone}
              time="12:41:19"
              text={`dialogue_units · unit_kira_s3_warm · тон ${tone}`}
              tone={tone}
            />
          ))}
          <ConsoleLine time="12:41:22" text="✗ unit_kira_step3 · text_gen timeout · черновик сохранён" tone="error" />
          <ConsoleLine time="12:41:23" text="прогон остановлен · 22/24" tone="run" cursor />
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Чертёжная рамка и иконки</h2>
        <div className={styles.row}>
          <Blueprint style={{ padding: '14px 16px', background: '#fff', width: 260 }}>
            <div className={styles.caption}>blueprint</div>
            <p className={styles.note}>Квадратные углы, волосяная рамка, крестики-реперы по углам.</p>
          </Blueprint>
          <div className={styles.iconRow}>
            <IconBlueprint />
            <IconScore />
            <IconScript />
            <IconMap />
            <IconPrefabs />
            <IconAssets />
            <IconQa />
            <IconConsole />
            <IconAudio />
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Акцентная рампа</h2>
        <div className={styles.ramp}>
          {ACCENT_RAMP.map(step => (
            <span
              key={step}
              className={`${styles.swatch} ${step <= 300 ? styles.swatchDark : ''}`}
              style={{ background: `var(--color-accent-${step})` }}
            >
              {step}
            </span>
          ))}
        </div>
      </section>
    </div>

    <StatusBar mode="idle" items={['витрина атомов', 'Фаза 1 · токены и компоненты']} right="Industry" />
  </div>
);

export default AtomGallery;
