import React, { useMemo } from 'react';

import { requestStopCalendarRun } from '@/narrative/calendarRunner';
import { useNarrativeStore } from '@/narrative/narrativeStore';
import { useEventBus } from '@/processes/eventBus';
import { eventText, eventTone } from '@/processes/events';
import OutlineButton from '@/ui/kit/atoms/OutlineButton';
import BatchBand from '@/ui/kit/molecules/BatchBand';
import CheckpointBanner from '@/ui/kit/molecules/CheckpointBanner';
import CriticVerdict from '@/ui/kit/molecules/CriticVerdict';
import LedgerRow from '@/ui/kit/molecules/LedgerRow';
import RunProgress from '@/ui/kit/molecules/RunProgress';
import RushPanel from '@/ui/kit/molecules/RushPanel';

import { deriveProseZone } from './proseZoneModel';

import styles from './shell.module.css';
import own from './ProseZone.module.css';

import type { EventTone } from '@/processes/events';
import type { PipelineEvent } from '@/processes/events';

const TONE_CLASS: Record<EventTone, string> = {
  info: own.toneInfo,
  ok: own.toneOk,
  error: own.toneError,
  run: own.toneRun,
  pending: own.tonePending,
};

/**
 * Зона 2 «Генерация»: самая дорогая часть конвейера, поэтому автор смотрит
 * не на голую полосу прогресса, а на то, что именно сейчас пишется —
 * построчную ленту событий, раш черновика и порционную ведомость.
 *
 * Экран пропов не берёт — читает шину напрямую: у ленты нет производного
 * состояния, которое имело бы смысл поднимать выше.
 *
 * `ConsoleLine` из макета (`design_ref/components/ConsoleLine.dc.html`) в
 * ките ещё не портирован — есть только исходник дизайна, молекулы
 * `client/src/ui/kit/molecules/ConsoleLine.tsx` нет. Строка ленты собрана
 * здесь локально на токенах `--gu-signal-*-text`/`--gu-muted` (вьюпорт зоны
 * светлый, поэтому не тёмная рампа `--gu-ink-*`, которой пользуется дизайн
 * ConsoleLine.dc.html для хрома) и `--gu-mono`; когда молекулу портируют,
 * эту вставку стоит заменить на неё.
 */
const ProseZone = () => {
  const recent = useEventBus(s => s.recent);
  const run = useEventBus(s => s.run);
  const command = useEventBus(s => s.command);
  // Внутристадийный счётчик долгих стадий: диалоги без него час стоят на
  // одной цифре, и прогон не отличить от зависшего.
  const sub = useNarrativeStore(s => (s.calendarRun?.status === 'running' ? s.calendarRun.subProgress : null));

  const model = useMemo(() => deriveProseZone(recent, run), [recent, run]);
  const feed = useMemo(() => {
    const stages = new Set(model.ledger.map(l => l.stage));
    return recent.filter(e => stages.has(e.stage));
  }, [recent, model.ledger]);

  const percent = run.total > 0 ? (run.completed / run.total) * 100 : 0;
  const subLabel = sub ? ` · ${sub.label}: ${sub.completed} из ${sub.total}` : '';
  const progressLabel =
    run.total > 0 ? `${run.completed} из ${run.total}${subLabel} · ≈$${run.spent.toFixed(2)}` : 'прогон не запущен';

  const nothingYet = feed.length === 0 && !model.checkpoint;

  // Без .zoneBody и шапки зоны: экран живёт вкладкой «Прогон» внутри
  // ZoneView, который уже нарисовал и заголовок «Генерация», и отступы, —
  // своя шапка давала двойной h1 и двойной паддинг.
  return (
    <div>
      <div className={styles.section}>
        <RunProgress percent={percent} label={progressLabel} tone={run.phase === 'failed' ? 'error' : 'loading'} />
      </div>

      {model.checkpoint && (
        <div className={styles.section}>
          <CheckpointBanner
            glyph="⏸"
            label="Чекпоинт: прогон на паузе"
            note={model.checkpoint.note}
            action="Продолжить"
            actionTone="accent"
            onAction={() => command({ type: 'resume' })}
          />
          <div className={own.checkpointStop}>
            {/* «Стоп» обязан дойти до самого раннера, а не только до машины:
                иначе полоса замирает, а генерация продолжает тратить деньги. */}
            <OutlineButton
              label="Остановить"
              tone="danger"
              size="compact"
              onClick={() => {
                requestStopCalendarRun();
                command({ type: 'stop' });
              }}
            />
          </div>
        </div>
      )}

      {model.rush && (
        <div className={styles.section}>
          <div className={styles.kicker}>Раш · черновик читают, не дожидаясь конца</div>
          <RushPanel speaker={model.rush.speaker} text={model.rush.text} streaming />
        </div>
      )}

      {nothingYet ? (
        <p className={styles.empty}>Лента пуста — прогон ещё не запускали.</p>
      ) : (
        <>
          <div className={styles.section}>
            <div className={styles.kicker}>Лента событий прогона</div>
            <div className={own.console}>
              {feed.length === 0 ? (
                <p className={styles.empty}>Событий этой зоны пока нет.</p>
              ) : (
                feed.map(event => <ConsoleFeedLine key={event.id} event={event} />)
              )}
            </div>
          </div>

          {model.batches.length > 0 && (
            <div className={styles.section}>
              <div className={styles.kicker}>Ведомость по порциям</div>
              {model.batches.map(batch => (
                <div key={batch.stage} className={own.batch}>
                  <BatchBand
                    label={batch.label}
                    meta={`${batch.done}/${batch.total}`}
                    tone={batch.active ? 'accent' : 'quiet'}
                  />
                  {model.ledger
                    .filter(line => line.stage === batch.stage)
                    .map(line => (
                      <LedgerRow
                        key={line.key}
                        artifact={line.artifact}
                        state={line.state}
                        status={line.status}
                        take={line.take}
                        price={line.price}
                      />
                    ))}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {model.critiques.length > 0 && (
        <div className={styles.section}>
          <div className={styles.kicker}>Вердикты критика</div>
          {model.critiques.map(note => (
            <CriticVerdict key={note.key} title={note.title} quote={note.quote} />
          ))}
        </div>
      )}
    </div>
  );
};

const ConsoleFeedLine = ({ event }: { event: PipelineEvent }) => {
  const tone = eventTone(event.phase);
  return (
    <div className={own.consoleLine}>
      <span className={own.consoleTime}>{new Date(event.ts).toLocaleTimeString('ru')}</span>
      <span className={[own.consoleText, TONE_CLASS[tone]].join(' ')}>{eventText(event)}</span>
    </div>
  );
};

export default ProseZone;
