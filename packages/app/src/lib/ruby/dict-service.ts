/**
 * Ruby Dictionary Service — handles downloading and managing ruby dictionaries.
 *
 * Downloads two dictionaries for complete pinyin coverage:
 * 1. Word dict (modern.json ~1.9MB) — multi-char word readings with tone sandhi
 * 2. Char dict (pinyin.txt → pinyin-chars.json ~341KB) — single char fallback
 *
 * Dictionaries are stored in {appData}/dicts/{lang}/ and loaded on demand.
 */

import { useRubyStore } from "@readany/core/stores/ruby-store";
import {
  loadPinyinDicts,
  isPinyinDictLoaded,
  PINYIN_WORD_DICT_FILENAME,
  PINYIN_CHAR_DICT_FILENAME,
  LEGACY_DICT_FILENAME,
} from "./pinyin-processor";

/**
 * Get the dictionary directory path for a language.
 */
async function getDictDir(lang: "zh" | "ja"): Promise<string> {
  const { getPlatformService } = await import("@readany/core/services");
  const platform = getPlatformService();
  const appData = await platform.getAppDataDir();
  return `${appData}/dicts/${lang}`;
}

/**
 * Online dictionary download is intentionally disabled in this build.
 * Existing local dictionary files can still be loaded from app data.
 */
export async function downloadChineseDict(): Promise<void> {
  const store = useRubyStore.getState();
  const message = "Online ruby dictionary download has been removed. Place local dictionary files in the app data dicts/zh directory if ruby annotation is needed.";
  store.setDictState("zh", { status: "error", error: message, progress: 0 });
  throw new Error(message);
}

/**
 * Delete the Chinese dictionary files.
 */
export async function deleteChineseDict(): Promise<void> {
  try {
    const { remove, exists } = await import("@tauri-apps/plugin-fs");
    const dictDir = await getDictDir("zh");
    if (await exists(dictDir)) {
      await remove(dictDir, { recursive: true });
    }
  } catch {
    // Ignore deletion errors
  }
  useRubyStore.getState().setDictState("zh", { status: "idle", progress: 0, error: undefined });
}

/**
 * Try to load already-downloaded dictionaries on demand.
 * Returns true if dictionaries were found and loaded.
 */
export async function tryLoadExistingDict(lang: "zh" | "ja"): Promise<boolean> {
  if (lang === "zh") {
    // Already loaded
    if (isPinyinDictLoaded()) return true;

    try {
      const { exists } = await import("@tauri-apps/plugin-fs");
      const dictDir = await getDictDir("zh");
      const wordPath = `${dictDir}/${PINYIN_WORD_DICT_FILENAME}`;
      const charPath = `${dictDir}/${PINYIN_CHAR_DICT_FILENAME}`;

      // Check if both files exist (new format)
      if ((await exists(wordPath)) && (await exists(charPath))) {
        await loadPinyinDicts(dictDir);
        useRubyStore.getState().setDictState("zh", { status: "ready", progress: 100 });
        return true;
      }

      // Fallback: check for legacy single dict file
      const legacyPath = `${dictDir}/${LEGACY_DICT_FILENAME}`;
      if (await exists(legacyPath)) {
        // Legacy format — load word dict only (still works, just missing char coverage)
        const { loadWordDict } = await import("./pinyin-processor");
        await loadWordDict(legacyPath);
        useRubyStore.getState().setDictState("zh", { status: "ready", progress: 100 });
        return true;
      }
    } catch {
      // Dict not available
    }
    return false;
  }

  // TODO: Japanese dict loading
  return false;
}

/**
 * Download Japanese kuromoji dictionary.
 * TODO: Implement when adding Japanese support.
 */
export async function downloadJapaneseDict(): Promise<void> {
  throw new Error("Japanese dictionary not yet supported");
}

/**
 * Delete Japanese dictionary.
 */
export async function deleteJapaneseDict(): Promise<void> {
  try {
    const { remove, exists } = await import("@tauri-apps/plugin-fs");
    const dictDir = await getDictDir("ja");
    if (await exists(dictDir)) {
      await remove(dictDir, { recursive: true });
    }
  } catch {
    // Ignore
  }
  useRubyStore.getState().setDictState("ja", { status: "idle", progress: 0, error: undefined });
}
