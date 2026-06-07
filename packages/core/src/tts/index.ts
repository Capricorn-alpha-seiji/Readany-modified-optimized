// Types & constants
export type {
  ITTSPlayer,
  LegacyTTSEngine,
  PersistedTTSConfig,
  TTSEngine,
  TTSConfig,
  TTSPlayState,
} from "./types";
export { DEFAULT_TTS_CONFIG, DASHSCOPE_VOICES, normalizeTTSConfig, normalizeTTSEngine } from "./types";

// Text utilities
export {
  cleanText,
  countChars,
  isTTSFootnoteMarker,
  shouldSkipTTSNode,
  splitIntoChunks,
} from "./text-utils";
export { buildNarrationPreview, getTTSVoiceLabel, splitNarrationText } from "./display";
export { compareVoiceLanguage, getLocaleDisplayLabel } from "./voice-groups";

// Players
export { BrowserTTSPlayer, DashScopeTTSPlayer } from "./tts-players";
