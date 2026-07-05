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
export { buildOutlineRequestPayload, computeOutlineTargets } from './buildOutlineRequest';
export { validateStoryOutline } from './validateStoryOutline';
export { useOutlineGeneration } from './useOutlineGeneration';
export type { OutlineGenStatus } from './useOutlineGeneration';
export { buildSegmentRequestPayload } from './buildSegmentRequest';
export { useSegmentGeneration } from './useSegmentGeneration';
export type { SegmentGenStatus } from './useSegmentGeneration';
export { validateSegmentSemantics, getAllSegmentValidations, getSegmentValidations } from './validateSegment';
export type { SegmentValidationContext } from './validateSegment';
export { topoOrderAnchors, ancestorChain, directPredecessors, outgoingOf, encounterIndexFor } from './anchorOrder';
export { validateBeatPlan } from './validateBeatPlan';
export { buildBeatPlanRequestPayload, computeEncounterSlots } from './buildBeatPlanRequest';
export { buildEndingRequestPayload } from './buildEndingRequest';
export { buildAnchorBeatRequestPayload } from './buildAnchorBeatRequest';
export { useNarrativeStore } from './narrativeStore';
export type {
  ImageGenState,
  CharacterGenState,
  AudioTrackState,
  AudioVariationTone,
  LiAudioState,
} from './narrativeStore';
export { useBriefStore } from './briefStore';
export { useBulkSegmentGeneration } from './useBulkSegmentGeneration';
export type { BulkGenStatus, BulkFailure } from './useBulkSegmentGeneration';
export { useBulkImageGeneration } from './useBulkImageGeneration';
export type { ImageBulkStatus, ImageBulkFailure } from './useBulkImageGeneration';
export { useBulkCharacterGeneration } from './useBulkCharacterGeneration';
export type { CharacterBulkStatus, CharacterBulkFailure } from './useBulkCharacterGeneration';
export {
  convertToGameProject,
  convertStoryToGameProject,
  downloadJson,
  slugify,
  type ConversionStats,
  type ConversionResult,
  type StoryConversionResult,
  type GameSceneGraph,
  type GameProjectFile,
} from './convertToGameProject';
export { compileWorldGameProject, type WorldCompileResult, type WorldCompileStats } from './compileWorldGame';
export { useStoryOutlineGeneration } from './useStoryOutlineGeneration';
export type { StoryOutlineGenStatus } from './useStoryOutlineGeneration';
export { useBulkStoryGeneration } from './useBulkStoryGeneration';
export type { BulkStoryGenStatus, BulkStoryFailure } from './useBulkStoryGeneration';
export {
  CANONICAL_POSES,
  EMOTION_TO_POSE,
  IMAGE_SERVER_BASE,
  resolveEmotionToPose,
  resolveEmotionToSpriteUrl,
  pickCharacterEmotion,
  collectUsedEmotions,
  findMissingPoses,
  type CanonicalPose,
  type SpriteResolution,
} from './emotionResolver';
export { useRegeneratePoses, poseKey } from './useRegeneratePoses';
export type { PoseRegenEntry, PoseRegenStatus, PoseItemStatus } from './useRegeneratePoses';
export { useBulkAudioGeneration, buildBaseStyle, buildToneStyle } from './useBulkAudioGeneration';
export type { AudioBulkStatus, AudioBulkFailure } from './useBulkAudioGeneration';
export {
  AUDIO_SERVER_BASE,
  audioUrlFor,
  selectedTrackFile,
  buildSceneAudioProfile,
  resolveSfxUrl,
} from './audioResolver';
