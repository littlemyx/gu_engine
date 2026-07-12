import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  useBriefStore,
  useNarrativeStore,
  deriveMontageModel,
  formatGuard,
  formatEffect,
  type StoryOutlinePlan,
  type MontageModel,
  type MontageCharacter,
  type MontageLocation,
  type SliceEventView,
  type CharacterMove,
} from '@/narrative';
import type { CalendarMontageModel } from '@/narrative/calendarSliceModel';
import { actColor } from './outlineLayout';
import styles from './MontageBoard.module.css';

/**
 * «Монтажный стол» (макет 4a): кадры-срезы рядом, линии персонажей текут
 * сквозь кадры; события — ромбы на линиях с карточками на отдельной ленте;
 * внизу шкала времени с дорожками персонажей, скользящим окном и плейхедом.
 *
 * Два источника модели:
 *   - легаси: deriveMontageModel (срез = якорь outline, одна локация-бокс);
 *   - календарь (prop calendarModel): срез = слот, 1-3 локации-бокса в кадре.
 * Оба нормализуются в BoardFrame/BoardBox — рендер и интеракции общие.
 *
 * Интеракции макета:
 *   1/2 — hover на линию или чип персонажа подсвечивает её на всю длину;
 *   3   — drag окна/плейхеда или колесо мыши плавно скользит ленту кадров;
 *   4   — hover на цветное ребро мини-карты подсвечивает участок линии;
 *   5   — клик по ромбу/карточке открывает инспектор события (guard/effects/сцена).
 */

const PAD = 24;
const FILM_H = 466;
const FRAME_TOP = 44;
const OFFSTAGE_Y = 424;
const TL_X0 = 90;

// Легаси-кадр (один бокс) — геометрия макета 4a.
const LEG_FRAME_W = 360;
const LEG_GAP = 64;
const LEG_WINDOW = 3;
const LOC_X = 32;
const LOC_TOP = 120;

// Календарный кадр: уже (слотов много), боксы стопкой.
const CAL_FRAME_W = 232;
const CAL_GAP = 36;
const CAL_WINDOW = 4;
const CAL_BOX_X = 18;
const CAL_BOX_TOP = 104;
const CAL_BOX_GAP = 10;
const CAL_BOX_BASE_H = 38;
const CAL_ROW = 22;
const CAL_MAX_BOXES = 3;

const NEUTRAL_EVENT_COLOR = '#8b5cf6';

type Emphasis = 'base' | 'hi' | 'dim';

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

const diamondPoints = (x: number, y: number, r: number) => `${x},${y - r} ${x + r},${y} ${x},${y + r} ${x - r},${y}`;

// ── Унифицированная view-модель доски ───────────────────────────────────────

type BoardBox = {
  locationId: string | null;
  locationName: string;
  ambientLabel: string | null;
  presentCharIds: string[];
  events: SliceEventView[];
  /** Геометрия: left/width — относительно кадра, top/rowStart/neutralY — абсолютные. */
  left: number;
  width: number;
  top: number;
  height: number;
  rowStart: number;
  rowStep: number;
  neutralY: number;
};

type BoardFrame = {
  z: number;
  key: string;
  title: string;
  /** Моно-подпись (id якоря) — только у легаси. */
  mono: string | null;
  dayStart: boolean;
  boxes: BoardBox[];
  hiddenLocCount: number;
  /** Все события кадра в порядке нумерации (лента карточек). */
  events: SliceEventView[];
  presentCharIds: string[];
  tlLabel: string;
  tlTitle: string;
};

type BoardModel = {
  frames: BoardFrame[];
  characters: MontageCharacter[];
  moves: CharacterMove[];
  presence: Record<string, Array<[number, number]>>;
  locations: MontageLocation[];
  adjacency: Array<[string, string]>;
  acts: Array<{ act: number; fromZ: number; toZ: number }>;
};

function boardFromLegacy(model: MontageModel): BoardModel {
  const frames: BoardFrame[] = model.slices.map(slice => ({
    z: slice.z,
    key: slice.anchor.id,
    title: slice.anchor.timeMarker || `срез ${slice.z + 1}`,
    mono: slice.anchor.id,
    dayStart: false,
    boxes: [
      {
        locationId: slice.locationId,
        locationName: slice.locationName,
        ambientLabel: slice.ambientLabel,
        presentCharIds: slice.presentCharIds,
        events: slice.events,
        left: LOC_X,
        width: LEG_FRAME_W - LOC_X * 2,
        top: LOC_TOP,
        height: Math.max(70, 50 + slice.presentCharIds.length * 26),
        rowStart: LOC_TOP + 42,
        rowStep: 26,
        neutralY: LOC_TOP - 22,
      },
    ],
    hiddenLocCount: 0,
    events: slice.events,
    presentCharIds: slice.presentCharIds,
    tlLabel: slice.anchor.timeMarker || slice.anchor.id,
    tlTitle: `${slice.anchor.timeMarker || ''} · ${slice.anchor.id}`,
  }));
  return {
    frames,
    characters: model.characters,
    moves: model.moves,
    presence: model.presence,
    locations: model.locations,
    adjacency: model.adjacency,
    acts: model.acts,
  };
}

function boardFromCalendar(model: CalendarMontageModel): BoardModel {
  const frames: BoardFrame[] = model.slices.map(slice => {
    const shown = slice.locations.slice(0, CAL_MAX_BOXES);
    let top = CAL_BOX_TOP;
    const boxes: BoardBox[] = shown.map(loc => {
      const height = CAL_BOX_BASE_H + loc.presentCharIds.length * CAL_ROW;
      const box: BoardBox = {
        locationId: loc.locationId,
        locationName: loc.locationName,
        ambientLabel: loc.ambientLabel,
        presentCharIds: loc.presentCharIds,
        events: loc.events,
        left: CAL_BOX_X,
        width: CAL_FRAME_W - CAL_BOX_X * 2,
        top,
        height,
        rowStart: top + 32,
        rowStep: CAL_ROW,
        neutralY: top + 14,
      };
      top += height + CAL_BOX_GAP;
      return box;
    });
    return {
      z: slice.slot,
      key: `slot-${slice.slot}`,
      title: slice.label,
      mono: null,
      dayStart: slice.dayStart,
      boxes,
      hiddenLocCount: slice.locations.length - shown.length,
      events: slice.locations.flatMap(l => l.events),
      presentCharIds: boxes.flatMap(b => b.presentCharIds),
      tlLabel: slice.label,
      tlTitle: slice.label,
    };
  });
  return {
    frames,
    characters: model.characters,
    moves: model.moves.map(m => ({
      charId: m.charId,
      fromZ: m.fromSlot,
      toZ: m.toSlot,
      fromLoc: m.fromLoc,
      toLoc: m.toLoc,
    })),
    presence: model.presence,
    locations: model.locations,
    adjacency: model.adjacency,
    acts: model.acts,
  };
}

export const MontageBoard: React.FC<{
  outline: StoryOutlinePlan;
  calendarModel?: CalendarMontageModel | null;
  /** Селектор веток (календарь): branchPointId → outcomeId; нет ключа = все ветки. */
  branchAssignment?: Record<string, string>;
  onBranchAssignmentChange?: (next: Record<string, string>) => void;
}> = ({ outline, calendarModel, branchAssignment = {}, onBranchAssignmentChange }) => {
  const brief = useBriefStore(s => s.brief);
  const worldModel = useNarrativeStore(s => s.worldModel);
  const beatPlan = useNarrativeStore(s => s.beatPlan);
  const dialogueVariants = useNarrativeStore(s => s.dialogueVariants);
  const anchorBeats = useNarrativeStore(s => s.anchorBeats);

  const legacyModel: MontageModel = useMemo(
    () => deriveMontageModel({ brief, outline, worldModel, beatPlan, dialogueVariants, anchorBeats }),
    [brief, outline, worldModel, beatPlan, dialogueVariants, anchorBeats],
  );

  const isCal = Boolean(calendarModel);
  const board: BoardModel = useMemo(
    () => (calendarModel ? boardFromCalendar(calendarModel) : boardFromLegacy(legacyModel)),
    [calendarModel, legacyModel],
  );

  const FRAME_W = isCal ? CAL_FRAME_W : LEG_FRAME_W;
  const GAP = isCal ? CAL_GAP : LEG_GAP;
  const STEP = FRAME_W + GAP;
  const frameLeft = (z: number) => PAD + z * STEP;
  const xCenter = (z: number) => frameLeft(z) + FRAME_W / 2;

  const N = board.frames.length;
  const W = Math.min(isCal ? CAL_WINDOW : LEG_WINDOW, Math.max(N, 1));
  const maxStart = Math.max(0, N - W);

  const [selectedZ, setSelectedZ] = useState(() => clamp(Math.floor(N / 2), 0, Math.max(N - 1, 0)));
  const [windowStart, setWindowStart] = useState(() => clamp(Math.floor(N / 2) - 1, 0, maxStart));
  const [hoverChar, setHoverChar] = useState<string | null>(null);
  const [hoverMove, setHoverMove] = useState<CharacterMove | null>(null);
  const [hoverEventN, setHoverEventN] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<SliceEventView | null>(null);

  // Смена набора кадров (другие якоря / другой календарь) — сбрасываем навигацию.
  const framesKey = board.frames.map(f => f.key).join(',');
  const prevFramesKey = useRef(framesKey);
  useEffect(() => {
    if (prevFramesKey.current !== framesKey) {
      prevFramesKey.current = framesKey;
      setSelectedZ(clamp(Math.floor(N / 2), 0, Math.max(N - 1, 0)));
      setWindowStart(clamp(Math.floor(N / 2) - 1, 0, maxStart));
      setSelectedEvent(null);
    }
  }, [framesKey, N, maxStart]);

  const selectSlice = useCallback(
    (z: number) => {
      const target = clamp(z, 0, Math.max(N - 1, 0));
      setSelectedZ(target);
      setWindowStart(prev => {
        if (target < prev) return target;
        if (target > prev + W - 1) return clamp(target - W + 1, 0, maxStart);
        return prev;
      });
    },
    [N, W, maxStart],
  );

  // ── Колесо мыши на ленте кадров (интеракция 3) ───────────────────────────
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const wheelAcc = useRef(0);
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      wheelAcc.current += Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (wheelAcc.current > 70) {
        setWindowStart(prev => clamp(prev + 1, 0, maxStart));
        wheelAcc.current = 0;
      } else if (wheelAcc.current < -70) {
        setWindowStart(prev => clamp(prev - 1, 0, maxStart));
        wheelAcc.current = 0;
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [maxStart]);

  // ── Геометрия линий: y персонажа = центр строки его бокса в кадре ────────
  const charYIn = useCallback((frame: BoardFrame, charId: string): number => {
    for (const box of frame.boxes) {
      const idx = box.presentCharIds.indexOf(charId);
      if (idx !== -1) return box.rowStart + idx * box.rowStep;
    }
    return OFFSTAGE_Y;
  }, []);

  const emphasisFor = useCallback(
    (charId: string, segFromZ?: number): Emphasis => {
      if (hoverMove) {
        return hoverMove.charId === charId && (segFromZ === undefined || hoverMove.fromZ === segFromZ) ? 'hi' : 'dim';
      }
      if (hoverChar) return hoverChar === charId ? 'hi' : 'dim';
      return 'base';
    },
    [hoverChar, hoverMove],
  );

  const stripW = PAD * 2 + Math.max(N, 1) * STEP - GAP;

  // ── Таймлайн: размеры и drag ─────────────────────────────────────────────
  const tlRef = useRef<HTMLDivElement | null>(null);
  const [tlWidth, setTlWidth] = useState(1200);
  useLayoutEffect(() => {
    const measure = () => {
      if (tlRef.current) setTlWidth(tlRef.current.clientWidth);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  const FW = N > 0 ? (tlWidth - TL_X0 - 24) / N : 1;
  const trackTop = 40;
  const svgH = Math.max(82, trackTop + board.characters.length * 18 + 10);
  const tlHeight = 24 + svgH + 28;

  const drag = useRef<{ mode: 'window' | 'playhead'; grabDx: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  const svgXFromEvent = (e: React.PointerEvent) => {
    const svg = (e.target as SVGElement).ownerSVGElement ?? (e.target as SVGSVGElement);
    return e.clientX - svg.getBoundingClientRect().left;
  };

  const onWindowPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    drag.current = { mode: 'window', grabDx: svgXFromEvent(e) - (TL_X0 + windowStart * FW) };
    setDragging(true);
  };
  const onPlayheadPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    drag.current = { mode: 'playhead', grabDx: 0 };
    setDragging(true);
  };
  const onTlPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const x = svgXFromEvent(e);
    if (drag.current.mode === 'window') {
      setWindowStart(clamp(Math.round((x - drag.current.grabDx - TL_X0) / FW), 0, maxStart));
    } else {
      selectSlice(Math.floor((x - TL_X0) / FW));
    }
  };
  const onTlPointerUp = () => {
    drag.current = null;
    setDragging(false);
  };

  const charColor = (charId: string | null) =>
    charId ? board.characters.find(c => c.id === charId)?.color ?? NEUTRAL_EVENT_COLOR : NEUTRAL_EVENT_COLOR;

  // ── Мини-карта: раскладка узлов ──────────────────────────────────────────
  const mapPos = useMemo(() => {
    const pos = new Map<string, { x: number; y: number }>();
    board.locations.forEach((loc, i) => {
      const col = i % 4;
      const row = Math.floor(i / 4);
      pos.set(loc.id, { x: 30 + col * 58 + (row % 2) * 29, y: 26 + row * 40 });
    });
    return pos;
  }, [board.locations]);
  const mapRows = Math.max(1, Math.ceil(board.locations.length / 4));
  const mapH = Math.max(108, 26 + mapRows * 40 + 22);

  const visibleMoves = board.moves.filter(m => m.fromZ >= windowStart && m.toZ <= windowStart + W - 1);

  if (N === 0) {
    return (
      <div className={styles.board}>
        <div className={styles.boardEmpty}>
          {isCal
            ? 'Календарь пуст — монтажному столу нечего показывать.'
            : 'В outline нет якорей — монтажному столу нечего показывать.'}
        </div>
      </div>
    );
  }

  const visibleFrames = board.frames.slice(windowStart, windowStart + W);
  const maxCards = isCal ? 2 : 4;

  const eventStatus = (ev: SliceEventView): { text: string; color: string } => {
    if (!ev.hasScene) return { text: 'триггер · без сцены', color: '#9ca3af' };
    if (ev.sceneStatus) {
      const { done, total } = ev.sceneStatus;
      if (done >= total) return { text: total === 1 ? 'сцена ✓' : `сцены ${done}/${total} ✓`, color: '#16a34a' };
      return { text: `сцены ${done}/${total}`, color: '#f59e0b' };
    }
    return { text: 'сцена ✓', color: '#16a34a' };
  };

  const eventAnchor = (frame: BoardFrame, box: BoardBox, ev: SliceEventView, occ: number): { x: number; y: number } => {
    const x = xCenter(frame.z) + occ * 28;
    if (ev.charId) {
      const idx = box.presentCharIds.indexOf(ev.charId);
      if (idx !== -1) return { x, y: box.rowStart + idx * box.rowStep };
    }
    return { x, y: box.neutralY };
  };

  const branchPoints = calendarModel?.branchPoints ?? [];

  return (
    <div className={styles.board}>
      {/* ── селектор веток (фаза 5): «—» = все ветки, сегмент = лист ── */}
      {isCal && branchPoints.length > 0 && (
        <div className={styles.branchRow}>
          <span className={styles.legendLabel}>ветки</span>
          {branchPoints.map(bp => (
            <span key={bp.id} className={styles.branchGroup} title={bp.summary}>
              <span className={styles.branchName}>{bp.id}</span>
              <span className={styles.branchSegs}>
                <button
                  type="button"
                  className={`${styles.branchSeg} ${!branchAssignment[bp.id] ? styles.branchSegActive : ''}`}
                  title="все ветки"
                  onClick={() => {
                    const next = { ...branchAssignment };
                    delete next[bp.id];
                    onBranchAssignmentChange?.(next);
                  }}
                >
                  —
                </button>
                {bp.outcomes.map(o => (
                  <button
                    key={o.id}
                    type="button"
                    className={`${styles.branchSeg} ${branchAssignment[bp.id] === o.id ? styles.branchSegActive : ''}`}
                    onClick={() => onBranchAssignmentChange?.({ ...branchAssignment, [bp.id]: o.id })}
                  >
                    {o.label}
                  </button>
                ))}
              </span>
            </span>
          ))}
        </div>
      )}

      {/* ── легенда (интеракция 2) ── */}
      <div className={styles.legendRow}>
        <span className={styles.legendLabel}>персонажи</span>
        {board.characters.map(c => {
          const active = hoverChar === c.id;
          const dim = (hoverChar !== null && !active) || (hoverMove !== null && hoverMove.charId !== c.id);
          return (
            <span
              key={c.id}
              className={`${styles.charChip} ${active ? styles.charChipActive : ''} ${dim ? styles.charChipDim : ''}`}
              style={active ? { borderColor: c.color, color: c.color, background: '#fff' } : undefined}
              onMouseEnter={() => setHoverChar(c.id)}
              onMouseLeave={() => setHoverChar(null)}
            >
              <span className={styles.charChipDot} style={{ background: c.color }} />
              {c.name}
            </span>
          );
        })}
        <span className={styles.legendDivider} />
        <span className={styles.legendItem}>
          <svg width="16" height="16">
            <polygon points="8,2 14,8 8,14 2,8" fill="#6b7280" />
          </svg>
          событие (Д / П / ⚑)
        </span>
        <span className={styles.legendItem}>
          <svg width="26" height="6">
            <line x1="0" y1="3" x2="26" y2="3" stroke="#9ca3af" strokeWidth="2" strokeDasharray="5 4" />
          </svg>
          за кадром
        </span>
        <span className={styles.legendMeta}>
          {N} {isCal ? 'слотов' : 'срезов'} · {board.frames.reduce((acc, f) => acc + f.events.length, 0)} событий
        </span>
      </div>

      {/* ── лента кадров ── */}
      <div ref={viewportRef} className={styles.filmViewport}>
        <div className={styles.stripInner} style={{ width: stripW, transform: `translateX(${-windowStart * STEP}px)` }}>
          {board.frames.map(frame => {
            const sel = frame.z === selectedZ;
            const lastBox = frame.boxes[frame.boxes.length - 1];
            const showEmpty = isCal ? frame.boxes.length === 0 : frame.presentCharIds.length === 0;
            return (
              <React.Fragment key={frame.key}>
                <div
                  className={`${styles.frameTitle} ${sel ? styles.frameTitleSel : ''} ${
                    frame.dayStart ? styles.frameTitleDay : ''
                  }`}
                  style={{ left: frameLeft(frame.z), width: FRAME_W }}
                  onClick={() => selectSlice(frame.z)}
                >
                  {frame.title}
                  {frame.mono && (
                    <>
                      {' '}
                      <span className={styles.anchorMono}>{frame.mono}</span>
                    </>
                  )}
                </div>
                <div
                  className={`${styles.frame} ${sel ? styles.frameSelected : ''} ${
                    frame.dayStart ? styles.frameDayStart : ''
                  }`}
                  style={{ left: frameLeft(frame.z), width: FRAME_W }}
                  onClick={() => selectSlice(frame.z)}
                >
                  {frame.boxes.map(box => (
                    <div
                      key={`${frame.key}:${box.locationId ?? '—'}`}
                      className={`${styles.locBox} ${sel ? styles.locBoxSel : ''}`}
                      style={{ left: box.left, top: box.top - FRAME_TOP, width: box.width, height: box.height }}
                    >
                      <span className={styles.locBoxTitle}>{box.locationName}</span>
                      {box.ambientLabel && <span className={styles.ambientChip}>♪ {box.ambientLabel}</span>}
                    </div>
                  ))}
                  {frame.hiddenLocCount > 0 && lastBox && (
                    <div
                      className={styles.moreLocsRow}
                      style={{ left: lastBox.left, top: lastBox.top + lastBox.height - FRAME_TOP + 6 }}
                    >
                      +{frame.hiddenLocCount} ещё
                    </div>
                  )}
                  {showEmpty && (
                    <div className={styles.offstageLabel} style={{ left: 0, width: FRAME_W, top: LOC_TOP - 8 }}>
                      пустой срез
                    </div>
                  )}
                  <div className={styles.offstageLabel} style={{ left: 0, width: FRAME_W, top: OFFSTAGE_Y - 52 }}>
                    за кадром
                  </div>
                </div>
              </React.Fragment>
            );
          })}

          {/* нити + ромбы */}
          <svg className={styles.threadsSvg} width={stripW} height={FILM_H}>
            {board.characters.map(c => (
              <g key={c.id}>
                {board.frames.slice(0, -1).map((frame, z) => {
                  const next = board.frames[z + 1];
                  const y0 = charYIn(frame, c.id);
                  const y1 = charYIn(next, c.id);
                  const x0 = xCenter(z);
                  const x1 = xCenter(z + 1);
                  const offstage = y0 === OFFSTAGE_Y || y1 === OFFSTAGE_Y;
                  const emph = emphasisFor(c.id, z);
                  const opacity = (emph === 'hi' ? 1 : emph === 'dim' ? 0.12 : 0.55) * (offstage ? 0.35 : 1);
                  const d = `M ${x0} ${y0} C ${x0 + STEP * 0.42} ${y0}, ${x1 - STEP * 0.42} ${y1}, ${x1} ${y1}`;
                  return (
                    <g key={z}>
                      <path
                        d={d}
                        fill="none"
                        stroke={c.color}
                        strokeWidth={emph === 'hi' ? 4 : 2.5}
                        strokeLinecap="round"
                        strokeDasharray={offstage ? '4 5' : undefined}
                        opacity={opacity}
                      />
                      <path
                        className={styles.threadHit}
                        d={d}
                        fill="none"
                        stroke="transparent"
                        strokeWidth={14}
                        style={{ pointerEvents: 'stroke' }}
                        onMouseEnter={() => setHoverChar(c.id)}
                        onMouseLeave={() => setHoverChar(null)}
                      />
                    </g>
                  );
                })}
                {board.frames.map(frame => {
                  if (!frame.presentCharIds.includes(c.id)) return null;
                  const emph = emphasisFor(c.id);
                  return (
                    <circle
                      key={frame.key}
                      cx={xCenter(frame.z)}
                      cy={charYIn(frame, c.id)}
                      r={5.5}
                      fill={c.color}
                      stroke="#ffffff"
                      strokeWidth={1.5}
                      opacity={emph === 'hi' ? 1 : emph === 'dim' ? 0.15 : 0.9}
                    />
                  );
                })}
              </g>
            ))}

            {/* ромбы событий (интеракция 5) */}
            {board.frames.map(frame =>
              frame.boxes.map(box => {
                const occByChar = new Map<string, number>();
                return box.events.map(ev => {
                  const key = ev.charId ?? '__anchor__';
                  const occ = occByChar.get(key) ?? 0;
                  occByChar.set(key, occ + 1);
                  const { x, y } = eventAnchor(frame, box, ev, occ);
                  const color = charColor(ev.charId);
                  const hi = hoverEventN === ev.n || selectedEvent?.n === ev.n;
                  const dimmed =
                    (hoverChar !== null && ev.charId !== hoverChar) ||
                    (hoverMove !== null && ev.charId !== hoverMove.charId);
                  return (
                    <g
                      key={ev.n}
                      className={`${styles.eventDiamond} ${ev.dimmed ? styles.eventDimmed : ''}`}
                      opacity={dimmed && !hi ? 0.2 : 1}
                      onMouseEnter={() => setHoverEventN(ev.n)}
                      onMouseLeave={() => setHoverEventN(null)}
                      onClick={e => {
                        e.stopPropagation();
                        setSelectedEvent(ev);
                      }}
                    >
                      <polygon
                        points={diamondPoints(x, y, hi ? 13 : 11)}
                        fill={ev.hasScene ? color : '#ffffff'}
                        stroke={color}
                        strokeWidth={2}
                      />
                      <text
                        x={x}
                        y={y}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fontSize={9}
                        fontWeight={700}
                        fill={ev.hasScene ? '#fff' : color}
                      >
                        {ev.n}
                      </text>
                    </g>
                  );
                });
              }),
            )}
          </svg>
        </div>

        {/* ── мини-карта переходов (интеракция 4) ── */}
        {board.locations.length > 1 && (
          <div className={styles.minimap} style={{ height: mapH }}>
            <span className={styles.minimapTitle}>карта переходов</span>
            <svg width={284} height={mapH - 6} style={{ position: 'absolute', left: 0, top: 6 }}>
              {board.adjacency.map(([a, b]) => {
                const pa = mapPos.get(a);
                const pb = mapPos.get(b);
                if (!pa || !pb) return null;
                return (
                  <line key={`${a}|${b}`} x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y} stroke="#dcd9d2" strokeWidth={1.2} />
                );
              })}
              {visibleMoves.map(m => {
                const pa = mapPos.get(m.fromLoc);
                const pb = mapPos.get(m.toLoc);
                if (!pa || !pb) return null;
                const hi = hoverMove === m;
                return (
                  <g key={`${m.charId}:${m.toZ}`}>
                    <line
                      x1={pa.x}
                      y1={pa.y}
                      x2={pb.x}
                      y2={pb.y}
                      stroke={charColor(m.charId)}
                      strokeWidth={hi ? 3 : 2}
                    />
                    <line
                      className={styles.minimapEdgeHit}
                      x1={pa.x}
                      y1={pa.y}
                      x2={pb.x}
                      y2={pb.y}
                      stroke="transparent"
                      strokeWidth={10}
                      onMouseEnter={() => setHoverMove(m)}
                      onMouseLeave={() => setHoverMove(null)}
                    />
                  </g>
                );
              })}
              {board.locations.map(loc => {
                const p = mapPos.get(loc.id)!;
                return (
                  <g key={loc.id}>
                    <circle cx={p.x} cy={p.y} r={4} fill="#fff" stroke="#9ca3af" strokeWidth={1.5} />
                    <text x={p.x} y={p.y} dy={14} textAnchor="middle" fontSize={8} fill="#9ca3af">
                      {loc.shortName}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        )}
      </div>

      {/* ── лента событий видимых срезов ── */}
      <div className={styles.eventStrip}>
        <span className={styles.stripLabel}>события видимых срезов</span>
        {visibleFrames.map(frame =>
          frame.events.slice(0, maxCards).map((ev, idx) => {
            const col = isCal ? 0 : Math.floor(idx / 2);
            const row = isCal ? idx : idx % 2;
            const color = charColor(ev.charId);
            const status = eventStatus(ev);
            const hi =
              hoverEventN === ev.n || selectedEvent?.n === ev.n || (hoverChar !== null && ev.charId === hoverChar);
            return (
              <div
                key={ev.n}
                className={`${styles.eventCard} ${ev.dimmed ? styles.eventDimmed : ''}`}
                style={{
                  left: PAD + (frame.z - windowStart) * STEP + col * 182,
                  top: 26 + row * 52,
                  borderColor: hi ? color : undefined,
                }}
                onMouseEnter={() => setHoverEventN(ev.n)}
                onMouseLeave={() => setHoverEventN(null)}
                onClick={() => setSelectedEvent(ev)}
              >
                <div className={styles.cardHeader}>
                  <svg width="14" height="14" style={{ flexShrink: 0 }}>
                    <polygon
                      points="7,1 13,7 7,13 1,7"
                      fill={ev.hasScene ? color : '#fff'}
                      stroke={color}
                      strokeWidth={1.5}
                    />
                  </svg>
                  <span className={styles.cardN} style={{ color }}>
                    {ev.n}
                  </span>
                  <span className={styles.cardTitle}>
                    {ev.kindIcon} · {ev.title}
                  </span>
                </div>
                <div className={styles.cardCond}>{ev.condText}</div>
                <div className={styles.cardStatus} style={{ color: status.color }}>
                  {status.text}
                </div>
              </div>
            );
          }),
        )}
        {visibleFrames.map(
          frame =>
            frame.events.length > maxCards && (
              <span
                key={frame.key}
                className={styles.moreChip}
                style={{ left: PAD + (frame.z - windowStart) * STEP + (isCal ? 182 : 2 * 182), top: 26 }}
              >
                +{frame.events.length - maxCards} ещё
              </span>
            ),
        )}
      </div>

      {/* ── таймлайн (интеракция 3) ── */}
      <div ref={tlRef} className={styles.timeline} style={{ height: tlHeight }}>
        <span className={styles.tlLabel}>шкала времени</span>
        {board.characters.map((c, i) => (
          <span
            key={c.id}
            className={styles.tlCharName}
            style={{ top: 24 + trackTop + i * 18 - 8, opacity: hoverChar && hoverChar !== c.id ? 0.35 : 1 }}
          >
            {c.name}
          </span>
        ))}
        <svg
          width={tlWidth}
          height={svgH}
          style={{ position: 'absolute', left: 0, top: 24 }}
          onPointerMove={onTlPointerMove}
          onPointerUp={onTlPointerUp}
        >
          {/* полоса актов */}
          {board.acts.map(a => (
            <rect
              key={a.act}
              x={TL_X0 + a.fromZ * FW}
              y={0}
              width={(a.toZ - a.fromZ + 1) * FW}
              height={3}
              fill={actColor(a.act)}
            />
          ))}
          {/* дорожки присутствия */}
          {board.characters.map((c, i) =>
            board.presence[c.id]?.map(([s, e]) => (
              <rect
                key={`${c.id}:${s}`}
                x={TL_X0 + s * FW + 3}
                y={trackTop + i * 18 - 5}
                width={Math.max((e - s + 1) * FW - 6, 4)}
                height={10}
                rx={5}
                fill={c.color}
                opacity={hoverChar === null ? 0.75 : hoverChar === c.id ? 0.95 : 0.15}
              />
            )),
          )}
          {/* скользящее окно */}
          <rect
            className={`${styles.tlWindow} ${dragging ? styles.tlWindowDragging : ''}`}
            x={TL_X0 + windowStart * FW}
            y={8}
            width={W * FW}
            height={svgH - 14}
            rx={10}
            fill="rgba(79,70,229,0.07)"
            stroke="#4f46e5"
            strokeWidth={1.5}
            onPointerDown={onWindowPointerDown}
          />
          <rect
            className={styles.tlWindow}
            x={TL_X0 + windowStart * FW - 2.5}
            y={svgH / 2 - 14}
            width={5}
            height={28}
            rx={2.5}
            fill="#4f46e5"
            onPointerDown={onWindowPointerDown}
          />
          <rect
            className={styles.tlWindow}
            x={TL_X0 + (windowStart + W) * FW - 2.5}
            y={svgH / 2 - 14}
            width={5}
            height={28}
            rx={2.5}
            fill="#4f46e5"
            onPointerDown={onWindowPointerDown}
          />
          {/* плейхед */}
          <rect
            className={styles.tlPlayhead}
            x={TL_X0 + selectedZ * FW + FW / 2 - 1}
            y={4}
            width={2}
            height={svgH - 8}
            fill="#4f46e5"
            onPointerDown={onPlayheadPointerDown}
          />
          <polygon
            className={styles.tlPlayhead}
            points={`${TL_X0 + selectedZ * FW + FW / 2 - 6},2 ${TL_X0 + selectedZ * FW + FW / 2 + 6},2 ${
              TL_X0 + selectedZ * FW + FW / 2
            },11`}
            fill="#4f46e5"
            onPointerDown={onPlayheadPointerDown}
          />
        </svg>
        {/* подписи кадров */}
        {board.frames.map(frame => (
          <span
            key={frame.key}
            className={`${styles.frameLabel} ${frame.z === selectedZ ? styles.frameLabelSel : ''} ${
              frame.dayStart ? styles.frameLabelDay : ''
            }`}
            style={{ left: TL_X0 + frame.z * FW, width: FW, top: 24 + svgH + 4 }}
            onClick={() => selectSlice(frame.z)}
            title={frame.tlTitle}
          >
            {frame.tlLabel}
          </span>
        ))}
      </div>

      {/* ── инспектор события (интеракция 5) ── */}
      {selectedEvent && (
        <div className={styles.inspector}>
          <div className={styles.inspHeader}>
            <span className={styles.inspKind} style={{ background: charColor(selectedEvent.charId) }}>
              {selectedEvent.kindIcon}
            </span>
            <span className={styles.inspTitle}>
              {selectedEvent.n} · {selectedEvent.title}
            </span>
            <button type="button" className={styles.inspClose} onClick={() => setSelectedEvent(null)}>
              ×
            </button>
          </div>
          <div className={styles.inspId}>
            {selectedEvent.def.id} · {selectedEvent.def.kind} · priority {selectedEvent.def.priority}
          </div>
          <div className={styles.inspGrid}>
            <span className={styles.inspKey}>если</span>
            <span className={styles.inspVal}>{formatGuard(selectedEvent.def.guard)}</span>
            <span className={styles.inspKey}>эффект</span>
            <span className={styles.inspEff}>
              {selectedEvent.def.effects.length > 0
                ? selectedEvent.def.effects.map(formatEffect).join(' · ')
                : selectedEvent.effectText}
            </span>
          </div>
          {selectedEvent.def.participants.length > 0 && (
            <div className={styles.inspParticipants}>
              {selectedEvent.def.participants.map(p => (
                <span key={p} className={styles.inspToken}>
                  <span className={styles.inspTokenDot} style={{ background: charColor(p) }} />
                  {board.characters.find(c => c.id === p)?.name ?? p}
                </span>
              ))}
            </div>
          )}
          <div className={styles.inspFooter}>
            <span className={styles.inspStatus} style={{ color: eventStatus(selectedEvent).color }}>
              {eventStatus(selectedEvent).text}
            </span>
            <span style={{ fontSize: 11, color: '#9ca3af' }}>
              срез {selectedEvent.z + 1} · {board.frames[selectedEvent.z]?.mono ?? board.frames[selectedEvent.z]?.title}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
