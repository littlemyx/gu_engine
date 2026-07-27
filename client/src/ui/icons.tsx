import React from 'react';
import {
  AudioLines,
  Boxes,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Clapperboard,
  Download,
  FileText,
  Grid3x3,
  Image,
  LayoutGrid,
  Map,
  Menu,
  Pause,
  Play,
  RefreshCw,
  Square,
  Terminal,
  User,
  X,
} from 'lucide-react';

import type { LucideProps } from 'lucide-react';

/**
 * Иконки Industry — Lucide тонкой обводкой. Размер и толщина заданы здесь,
 * чтобы не повторять их на каждом месте использования.
 */
const withDefaults =
  (Icon: React.ComponentType<LucideProps>) =>
  ({ size = 16, strokeWidth = 1.5, ...rest }: LucideProps) =>
    <Icon size={size} strokeWidth={strokeWidth} {...rest} />;

export const IconPlay = withDefaults(Play);
export const IconStop = withDefaults(Square);
export const IconPause = withDefaults(Pause);
export const IconRefresh = withDefaults(RefreshCw);
export const IconDownload = withDefaults(Download);
export const IconBlueprint = withDefaults(LayoutGrid);
export const IconScore = withDefaults(Grid3x3);
export const IconScript = withDefaults(FileText);
export const IconMap = withDefaults(Map);
export const IconPrefabs = withDefaults(Boxes);
export const IconAssets = withDefaults(Image);
export const IconQa = withDefaults(CircleAlert);
export const IconConsole = withDefaults(Terminal);
export const IconCharacter = withDefaults(User);
export const IconBeat = withDefaults(Clapperboard);
export const IconAudio = withDefaults(AudioLines);
export const IconChevronDown = withDefaults(ChevronDown);
export const IconChevronRight = withDefaults(ChevronRight);
export const IconMenu = withDefaults(Menu);
export const IconClose = withDefaults(X);
