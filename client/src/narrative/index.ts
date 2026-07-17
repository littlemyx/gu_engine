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
export { topoOrderAnchors, ancestorChain, directPredecessors, outgoingOf, encounterIndexFor } from './anchorOrder';
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
export { useBulkImageGeneration } from './useBulkImageGeneration';
export type { ImageBulkStatus, ImageBulkFailure } from './useBulkImageGeneration';
export { useBulkCharacterGeneration } from './useBulkCharacterGeneration';
export type { CharacterBulkStatus, CharacterBulkFailure } from './useBulkCharacterGeneration';
export { downloadJson, slugify, type GameSceneGraph, type GameProjectFile } from './convertToGameProject';
export {
  compileCalendarGameProject,
  lintRouters,
  scheduleRuns,
  type CalendarCompileResult,
  type CalendarCompileStats,
  type WorldAudioInput,
  type WorldCompileStats,
} from './compileCalendarGame';
export {
  CANONICAL_POSES,
  EMOTION_TO_POSE,
  IMAGE_SERVER_BASE,
  resolveEmotionToPose,
  resolveEmotionToSpriteUrl,
  pickCharacterEmotion,
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
export { validateSpine, guardFlags, enumerateLeafAssignments, playableBeatsForLeaf } from './validateSpine';
export type { LeafAssignment } from './validateSpine';
export {
  runStoryQAStructural,
  simulatePolicies,
  summarizePolicyReports,
  buildStoryLeafQARequests,
  DEFAULT_POLICIES,
  MAX_LEAF_QA_CALLS,
} from './storyQA';
export type { StoryQAInputs, PolicyReport, StoryLeafQAPayload } from './storyQA';
export { useStoryQA } from './useStoryQA';
export type { StoryQAState, StoryQAStatus } from './useStoryQA';
export { validateCalendar } from './validateCalendar';
export { validateCastPlan, REQUIRED_ARC_STAGES } from './validateCastPlan';
export { buildCastPlanRequestPayload } from './buildCastPlanRequest';
export { assignBeatSlots, buildScheduleStub } from './beatSchedule';
export { applyBeatChain, deriveBeatChain, gatingUnitFor, storylineKeys, PLOT_LINE } from './beatChain';
export type { BeatChain } from './beatChain';
export { buildSchedule, validateSchedule } from './buildSchedule';
export {
  parseEventPool,
  validateEventUnits,
  buildEventPoolRequestPayload,
  guardFiredIds,
  unitEstablishes,
  REL_DELTA_BOUND,
  EVENT_POOL_UNITS_PER_STAGE,
} from './parseEventPool';
export { computeReachableUnits } from './reachability';
export { buildStubCastPlan } from './castPlanStub';
export { buildWorldCalendarRequestPayload } from './buildWorldCalendarRequest';
export { buildSpineRequestPayload, computeSpineTargets } from './buildSpineRequest';
export { useBulkCalendarGeneration } from './useBulkCalendarGeneration';
export type { BulkCalendarPhase, BulkCalendarProgress, BulkCalendarRunOptions } from './useBulkCalendarGeneration';
export { deriveCalendarMontage } from './calendarSliceModel';
export type { CalendarMontageModel } from './calendarSliceModel';
export { deriveLegacyOutline } from './deriveLegacyOutline';
export { liLineColor, LI_LINE_PALETTE, truncate } from './sliceModel';
export type {
  MontageModel,
  MontageSlice,
  MontageCharacter,
  MontageLocation,
  SliceEventView,
  CharacterMove,
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
