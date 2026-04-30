/**
 * Точка входа модуля narrative — пилот procedural-narrative-генератора.
 *
 * Архитектурно отделено от существующего scene-canvas в client/src/pages/main:
 * narrative/ описывает контракты brief -> outline -> anchors -> branches,
 * а main/ остаётся текущим manual-canvas редактором сцен.
 */

export * from './types';
export { ARCHETYPES, ARCHETYPE_IDS, getArchetype } from './archetypes';
export { SAMPLE_BRIEF } from './sampleBrief';
export { validateBrief } from './validateBrief';
export type { BriefIssue } from './validateBrief';
export { buildOutlineRequestPayload } from './buildOutlineRequest';
export { useOutlineGeneration } from './useOutlineGeneration';
export type { OutlineGenStatus } from './useOutlineGeneration';
