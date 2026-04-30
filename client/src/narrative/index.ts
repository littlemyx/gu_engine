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
export { buildSegmentRequestPayload } from './buildSegmentRequest';
export { useSegmentGeneration } from './useSegmentGeneration';
export type { SegmentGenStatus } from './useSegmentGeneration';
export { validateSegmentSemantics, getAllSegmentValidations } from './validateSegment';
export type { SegmentValidationContext } from './validateSegment';
export { useNarrativeStore } from './narrativeStore';
export type { ImageGenState } from './narrativeStore';
export { useBriefStore } from './briefStore';
export { useBulkSegmentGeneration } from './useBulkSegmentGeneration';
export type { BulkGenStatus, BulkFailure } from './useBulkSegmentGeneration';
export { useBulkImageGeneration } from './useBulkImageGeneration';
export type { ImageBulkStatus, ImageBulkFailure } from './useBulkImageGeneration';
export {
  convertToGameProject,
  downloadJson,
  slugify,
  type ConversionStats,
  type ConversionResult,
  type GameSceneGraph,
  type GameProjectFile,
} from './convertToGameProject';
