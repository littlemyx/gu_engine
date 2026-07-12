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
export {
  compileCalendarGameProject,
  lintRouters,
  scheduleRuns,
  type CalendarCompileResult,
  type CalendarCompileStats,
} from './compileCalendarGame';
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
export {
  evaluateSlice,
  evalGuard,
  createSliceState,
  matchesSlice,
  bracketOfAffection,
  formatGuard,
  formatEffect,
  DEFAULT_RELATIONSHIP,
} from './events';
export type {
  TimeSlice,
  RelationshipState,
  EventHistory,
  EventContext,
  EventKind,
  EventDef,
  Guard,
  Effect,
  SceneRef,
  SliceState,
  SliceEvaluation,
  AffectionBracket,
} from './events';
export {
  DEFAULT_DAYPARTS,
  slotOf,
  dayOfSlot,
  daypartOfSlot,
  slotLabel,
  actOfSlot,
  actSlotWindow,
  computeCalendarTargets,
  guardFromRequires,
  parseCalendar,
  parseSpinePlan,
  parseCastPlan,
} from './calendarTypes';
export type {
  Calendar,
  CalendarTargets,
  CastAgenda,
  CastGoal,
  CastMember,
  CastPlan,
  CharacterSchedule,
  EventUnit,
  EventUnitSource,
  LocationTag,
  SlotWindow,
  SpineBeat,
  SpineBeatKind,
  SpineBeatOutcome,
  SpineEnding,
  SpinePlan,
} from './calendarTypes';
export {
  parseDialogueUnit,
  validateDialogueUnit,
  DIALOGUE_CHOICE_KINDS,
  DIALOGUE_UNIT_MAX_DEPTH,
} from './dialogueUnit';
export type { DialogueChoiceKind, DialogueUnit, DialogueUnitChoice, DialogueUnitNode } from './dialogueUnit';
export { buildDialogueUnitRequestPayload, buildLiCardSummary } from './buildDialogueUnitRequest';
export { computeBracketRanges } from './buildDialogueVariantRequest';
export { validateSpine, guardFlags } from './validateSpine';
export { validateCalendar } from './validateCalendar';
export { assignBeatSlots, buildScheduleStub } from './beatSchedule';
export { buildStubCastPlan } from './castPlanStub';
export { buildWorldCalendarRequestPayload } from './buildWorldCalendarRequest';
export { buildSpineRequestPayload, computeSpineTargets } from './buildSpineRequest';
export { useBulkCalendarGeneration } from './useBulkCalendarGeneration';
export type { BulkCalendarPhase, BulkCalendarProgress } from './useBulkCalendarGeneration';
export { deriveCalendarMontage } from './calendarSliceModel';
export type { CalendarMontageModel } from './calendarSliceModel';
export { deriveLegacyOutline } from './deriveLegacyOutline';
export { deriveMontageModel, liLineColor, LI_LINE_PALETTE } from './sliceModel';
export type {
  MontageModel,
  MontageSlice,
  MontageCharacter,
  MontageLocation,
  SliceEventView,
  CharacterMove,
  MontageInputs,
} from './sliceModel';
export { useBulkAudioGeneration, buildBaseStyle, buildToneStyle } from './useBulkAudioGeneration';
export type { AudioBulkStatus, AudioBulkFailure } from './useBulkAudioGeneration';
export {
  AUDIO_SERVER_BASE,
  audioUrlFor,
  selectedTrackFile,
  buildSceneAudioProfile,
  resolveSfxUrl,
} from './audioResolver';
