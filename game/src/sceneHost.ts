import { ProjectSettings, SceneNode, SceneType } from "./types";

/**
 * Контракт, который рендерер ждёт от источника сцен.
 *
 * Раньше рендерер был прибит к обходчику графа сцен. Но рендереру
 * никогда не был нужен граф: ему нужен ТЕКУЩИЙ кадр (фон, спрайты, строки,
 * доступные выборы) и способ сообщить о выборе. Интерфейс отделяет «показать»
 * от «решить, что показывать», и это ровно та граница, по которой storylet-
 * рантайм подменяет графовый: ни строки анимаций, ни разметки трогать не надо.
 *
 * Реализует его StoryletHost: решает, что показывать, режиссёр.
 */
export interface SceneHost {
  getSettings(): ProjectSettings;
  getSceneType(): SceneType;
  getCurrentNode(): SceneNode | null;
  /** id выходов, доступных ИМЕННО СЕЙЧАС (остальные не рисуются). */
  getConnectedOutputIds(): Set<string>;
  /** Состояние для аудио: relationship[<li>].affection и т.п. */
  getState(): Readonly<Record<string, number>>;
  start(): void;
  advance(): void;
  choose(outputId: string): void;
}
