import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { DEFAULT_ZONE } from './next/zoneModel';

import type { DialogueVariantBracket } from '@/narrative/types';
import type { ZoneId } from './next/zoneModel';
import type { ParsedProject } from './projectFile/parseProject';

/**
 * Что выделено в шелле. Инвариант дизайна: выделение чего угодно в любой
 * панели открывает соответствующий инспектор — единственный канал деталей,
 * попапов во вьюпорте нет.
 */
export type Selection =
  | { kind: 'beat'; id: string }
  | { kind: 'slot'; charId: string; slot: number }
  | { kind: 'character'; id: string }
  | { kind: 'location'; id: string }
  | { kind: 'prefab'; id: string }
  | { kind: 'unit'; unitId: string; bracket?: DialogueVariantBracket }
  | { kind: 'run' }
  /** Аудио-банк: инспектор показывает запуск аудио-конвейера. */
  | { kind: 'audioRun' }
  | null;

/** «Аудио» и «Отношения» — закрываемые вкладки: живут, пока открыт их флаг. */
export type ViewportTab = 'blueprint' | 'score' | 'script' | 'world' | 'audio' | 'relations';
/** Консоль в доке не вкладка — она приколота справа и видна всегда. */
export type DockTab = 'prefabs' | 'assets' | 'qa';

/**
 * Боковая панель конвейерного шелла. «Структура» — как устроена история,
 * «Пайплайн» — что из неё уже произведено. Раньше это было одно дерево, и оно
 * не отвечало толком ни на один из двух вопросов.
 */
export type SidebarTab = 'structure' | 'pipeline';

/** Нижняя панель: ведомость конвейера, лента событий, журнал прогонов. */
export type BottomTab = 'pipeline' | 'feed' | 'runs';

export type ModalState =
  | { kind: 'resetDraft' }
  | { kind: 'exportBlocked' }
  | { kind: 'savePrefab'; from: Selection }
  | { kind: 'brief' }
  | { kind: 'selector' }
  /** Настроения локаций: авторский оверрайд перед генерацией аудио. */
  | { kind: 'locationMoods' }
  /** Недостающие позы спрайтов: findMissingPoses по сценарию. */
  | { kind: 'poses' }
  | { kind: 'importBrief' }
  | { kind: 'newProject' }
  /** Файл уже разобран: подтверждение видит содержимое, а не одно имя. */
  | { kind: 'openProject'; parsed: ParsedProject; handle: FileSystemFileHandle | null }
  | null;

/**
 * Размеры панелей. Границы — не вкусовщина: уже 180px иерархия перестаёт
 * показывать метки строк, уже 240px инспектор ломает поля, а док ниже 120px
 * не вмещает и одной строки консоли.
 */
export const PANEL_LIMITS = {
  rail: { min: 180, max: 460, default: 258 },
  inspector: { min: 240, max: 560, default: 316 },
  dock: { min: 120, max: 620, default: 240 },
} as const;

export const clampPanel = (key: keyof typeof PANEL_LIMITS, value: number): number =>
  Math.round(Math.min(PANEL_LIMITS[key].max, Math.max(PANEL_LIMITS[key].min, value)));

type StudioState = {
  selection: Selection;
  /** Текущая зона конвейера. Наверху всегда одна — весь конвейер в доке. */
  zone: ZoneId;
  sidebarTab: SidebarTab;
  bottomTab: BottomTab;
  viewportTab: ViewportTab;
  /** Вкладка «Аудио» открыта (сама вкладка закрываемая, в отличие от четвёрки). */
  audioTabOpen: boolean;
  /** Вкладка «Отношения» открыта. */
  relationsTabOpen: boolean;
  dockTab: DockTab;
  dockOpen: boolean;
  railOpen: boolean;
  inspectorOpen: boolean;
  railWidth: number;
  inspectorWidth: number;
  dockHeight: number;
  modal: ModalState;

  select: (selection: Selection) => void;
  setZone: (zone: ZoneId) => void;
  setSidebarTab: (tab: SidebarTab) => void;
  setBottomTab: (tab: BottomTab) => void;
  setViewportTab: (tab: ViewportTab) => void;
  /** Открыть вкладку «Аудио» и её инспектор запуска. */
  openAudioTab: () => void;
  closeAudioTab: () => void;
  openRelationsTab: () => void;
  closeRelationsTab: () => void;
  setDockTab: (tab: DockTab) => void;
  toggleDock: () => void;
  toggleRail: () => void;
  toggleInspector: () => void;
  setPanelSize: (key: keyof typeof PANEL_LIMITS, value: number) => void;
  resetPanelSizes: () => void;
  openModal: (modal: ModalState) => void;
  closeModal: () => void;
};

export const useStudioStore = create<StudioState>()(
  persist(
    set => ({
      selection: null,
      zone: DEFAULT_ZONE,
      sidebarTab: 'structure',
      bottomTab: 'pipeline',
      viewportTab: 'blueprint',
      audioTabOpen: false,
      relationsTabOpen: false,
      dockTab: 'qa',
      dockOpen: true,
      railOpen: true,
      inspectorOpen: true,
      railWidth: PANEL_LIMITS.rail.default,
      inspectorWidth: PANEL_LIMITS.inspector.default,
      dockHeight: PANEL_LIMITS.dock.default,
      modal: null,

      // Выделение аудио-банка открывает и его вкладку: узел «♪ Аудио» в
      // иерархии — точка входа в раздел, а не только в инспектор.
      select: selection =>
        set(selection?.kind === 'audioRun' ? { selection, audioTabOpen: true, viewportTab: 'audio' } : { selection }),
      setZone: zone => set({ zone }),
      setSidebarTab: sidebarTab => set({ sidebarTab }),
      // Клик по вкладке разворачивает свёрнутую панель — как в макете.
      setBottomTab: bottomTab => set({ bottomTab, dockOpen: true }),
      setViewportTab: viewportTab => set({ viewportTab }),
      openAudioTab: () => set({ audioTabOpen: true, viewportTab: 'audio', selection: { kind: 'audioRun' } }),
      closeAudioTab: () =>
        set(s => ({
          audioTabOpen: false,
          viewportTab: s.viewportTab === 'audio' ? 'blueprint' : s.viewportTab,
          selection: s.selection?.kind === 'audioRun' ? null : s.selection,
        })),
      openRelationsTab: () => set({ relationsTabOpen: true, viewportTab: 'relations' }),
      closeRelationsTab: () =>
        set(s => ({
          relationsTabOpen: false,
          viewportTab: s.viewportTab === 'relations' ? 'blueprint' : s.viewportTab,
        })),
      setDockTab: dockTab => set({ dockTab, dockOpen: true }),
      toggleDock: () => set(s => ({ dockOpen: !s.dockOpen })),
      toggleRail: () => set(s => ({ railOpen: !s.railOpen })),
      toggleInspector: () => set(s => ({ inspectorOpen: !s.inspectorOpen })),
      setPanelSize: (key, value) =>
        set(
          key === 'rail'
            ? { railWidth: clampPanel('rail', value) }
            : key === 'inspector'
            ? { inspectorWidth: clampPanel('inspector', value) }
            : { dockHeight: clampPanel('dock', value) },
        ),
      resetPanelSizes: () =>
        set({
          railWidth: PANEL_LIMITS.rail.default,
          inspectorWidth: PANEL_LIMITS.inspector.default,
          dockHeight: PANEL_LIMITS.dock.default,
          railOpen: true,
          inspectorOpen: true,
          dockOpen: true,
        }),
      openModal: modal => set({ modal }),
      closeModal: () => set({ modal: null }),
    }),
    {
      // Ключ НЕ скоуплен проектом намеренно: раскладка панелей — привычка
      // автора, а не свойство истории, и обязана следовать за ним во все
      // вкладки. Проектные поля живут в studioProjectStore.
      name: 'gu-studio-ui',
      // Выделение и модалка живут только в сессии: после перезагрузки
      // разумнее открыть чистый инспектор, чем ссылаться на исчезнувший узел.
      partialize: s => ({
        zone: s.zone,
        sidebarTab: s.sidebarTab,
        bottomTab: s.bottomTab,
        viewportTab: s.viewportTab,
        audioTabOpen: s.audioTabOpen,
        relationsTabOpen: s.relationsTabOpen,
        dockTab: s.dockTab,
        dockOpen: s.dockOpen,
        railOpen: s.railOpen,
        inspectorOpen: s.inspectorOpen,
        railWidth: s.railWidth,
        inspectorWidth: s.inspectorWidth,
        dockHeight: s.dockHeight,
      }),
      // Консоль была вкладкой дока до того, как переехала в правую колонку;
      // сохранённое значение из старой сборки иначе оставило бы док пустым.
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<StudioState>;
        const dockTab = (saved.dockTab as string) === 'console' ? 'qa' : saved.dockTab;
        // Активная закрываемая вкладка без открытого флага — рассинхрон старой
        // сборки: откатываемся на чертёж, а не на пустую вкладку.
        const viewportTab =
          (saved.viewportTab === 'audio' && !saved.audioTabOpen) ||
          (saved.viewportTab === 'relations' && !saved.relationsTabOpen)
            ? 'blueprint'
            : saved.viewportTab;
        return { ...current, ...saved, ...(dockTab ? { dockTab } : null), ...(viewportTab ? { viewportTab } : null) };
      },
    },
  ),
);

/** Один и тот же узел выделен? Сравнение по значению, а не по ссылке. */
export function isSameSelection(a: Selection, b: Selection): boolean {
  if (a == null || b == null) return a === b;
  if (a.kind !== b.kind) return false;
  switch (a.kind) {
    case 'slot':
      return b.kind === 'slot' && a.charId === b.charId && a.slot === b.slot;
    case 'unit':
      return b.kind === 'unit' && a.unitId === b.unitId;
    case 'run':
    case 'audioRun':
      return true;
    default:
      return 'id' in b && a.id === b.id;
  }
}
