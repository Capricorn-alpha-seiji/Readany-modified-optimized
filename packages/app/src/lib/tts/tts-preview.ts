import type { TTSConfig } from "@readany/core/tts";
import { BrowserTTSPlayer, DashScopeTTSPlayer } from "@readany/core/tts";

const systemPreviewPlayer = new BrowserTTSPlayer();
const dashscopePreviewPlayer = new DashScopeTTSPlayer();

function stopPlayer(player: { stop: () => void }) {
  try {
    player.stop();
  } catch (err) {
    console.warn("[TTS] Failed to stop preview player:", err);
  }
}

export function stopTTSPreview() {
  stopPlayer(systemPreviewPlayer);
  stopPlayer(dashscopePreviewPlayer);
}

export async function previewTTSConfig(text: string, config: TTSConfig) {
  stopTTSPreview();
  const player =
    config.engine === "dashscope"
      ? dashscopePreviewPlayer
      : systemPreviewPlayer;
  try {
    await Promise.resolve(player.speak(text, config));
  } catch (error) {
    console.error("[TTSPreview] Preview failed", error);
  }
}
