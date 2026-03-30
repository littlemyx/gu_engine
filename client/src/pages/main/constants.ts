import type { CardType } from './types';

export const IMAGE_SERVER_BASE = 'http://localhost:3007';

export const CARD_TYPE_LABELS: Record<CardType, string> = {
  scene: 'Сцена',
  character: 'Персонаж',
  master_prompt: 'Мастер-промпт',
  background: 'Бэкграунд',
};
