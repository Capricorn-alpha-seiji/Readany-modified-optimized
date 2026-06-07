/**
 * TTS Players - two engine implementations, all platform-agnostic.
 *
 * 1. BrowserTTSPlayer - SpeechSynthesis API (available in all WebViews)
 * 2. DashScopeTTSPlayer - Alibaba Cloud qwen3-tts-flash via SSE streaming
 */

import { getPlatformService } from "../services/platform";
import { splitIntoChunks } from "./text-utils";
import type { ITTSPlayer, TTSConfig } from "./types";

// ── Browser SpeechSynthesis ──

export class BrowserTTSPlayer implements ITTSPlayer {
  private chunks: string[] = [];
  private currentIndex = 0;
  private _speaking = false;
  private _paused = false;

  onStateChange?: (state: "playing" | "paused" | "stopped") => void;
  onChunkChange?: (index: number, total: number) => void;
  onEnd?: () => void;

  get speaking() {
    return this._speaking;
  }
  get paused() {
    return this._paused;
  }

  speak(text: string | string[], config: TTSConfig) {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      console.warn("[TTS] SpeechSynthesis not available on this platform");
      return;
    }
    this.stop();
    this.chunks = Array.isArray(text) ? text.filter(Boolean) : splitIntoChunks(text);
    this.currentIndex = 0;
    this._speaking = true;
    this._paused = false;
    this.onStateChange?.("playing");
    this.speakChunk(config);
  }

  private speakChunk(config: TTSConfig) {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    if (this.currentIndex >= this.chunks.length) {
      const onEnd = this.onEnd;
      this._speaking = false;
      this._paused = false;
      window.speechSynthesis.cancel();
      this.chunks = [];
      this.currentIndex = 0;
      this.onStateChange?.("stopped");
      onEnd?.();
      return;
    }

    const synth = window.speechSynthesis;
    const utt = new SpeechSynthesisUtterance(this.chunks[this.currentIndex]);
    utt.rate = config.rate;
    utt.pitch = config.pitch;

    if (config.voiceName) {
      const voice = synth
        .getVoices()
        .find((v) => v.voiceURI === config.voiceName || v.name === config.voiceName);
      if (voice) utt.voice = voice;
    }

    utt.onstart = () => {
      this.onChunkChange?.(this.currentIndex, this.chunks.length);
    };

    utt.onend = () => {
      this.currentIndex++;
      if (this._speaking && !this._paused) {
        this.speakChunk(config);
      }
    };

    utt.onerror = (e) => {
      if (e.error === "canceled" || e.error === "interrupted") return;
      console.error("[TTS] SpeechSynthesis error:", e.error);
      this.currentIndex++;
      if (this._speaking) this.speakChunk(config);
    };
    synth.speak(utt);
  }

  pause() {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    if (!this._speaking || this._paused) return;
    window.speechSynthesis.pause();
    this._paused = true;
    this.onStateChange?.("paused");
  }

  resume() {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    if (!this._speaking || !this._paused) return;
    window.speechSynthesis.resume();
    this._paused = false;
    this.onStateChange?.("playing");
  }

  stop() {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    this.chunks = [];
    this.currentIndex = 0;
    this._speaking = false;
    this._paused = false;
    this.onStateChange?.("stopped");
  }
}

// ── DashScope TTS (Alibaba Cloud qwen3-tts-flash) — Real-time Streaming ──

export class DashScopeTTSPlayer implements ITTSPlayer {
  private audioCtx: AudioContext | null = null;
  private gainNode: GainNode | null = null;
  private scheduledEnd = 0;
  private _playing = false;
  private _paused = false;
  private allChunksDone = false;
  private hasAudioData = false;
  private abortController: AbortController | null = null;
  private checkEndTimer: ReturnType<typeof setInterval> | null = null;
  private pendingBytes: Uint8Array[] = [];
  private decodeTimeout: ReturnType<typeof setTimeout> | null = null;

  onStateChange?: (state: "playing" | "paused" | "stopped") => void;
  onChunkChange?: (index: number, total: number) => void;
  onEnd?: () => void;

  get playing() {
    return this._playing;
  }
  get paused() {
    return this._paused;
  }

  async speak(text: string | string[], config: TTSConfig) {
    this.abortController?.abort();
    this.abortController = null;
    if (this.checkEndTimer) {
      clearInterval(this.checkEndTimer);
      this.checkEndTimer = null;
    }
    if (this.decodeTimeout) {
      clearTimeout(this.decodeTimeout);
      this.decodeTimeout = null;
    }
    this.cleanupAudio();
    this.pendingBytes = [];

    const chunks = Array.isArray(text) ? text.filter(Boolean) : splitIntoChunks(text);
    this._playing = true;
    this._paused = false;
    this.allChunksDone = false;
    this.hasAudioData = false;

    this.audioCtx = new AudioContext();
    this.gainNode = this.audioCtx.createGain();
    this.gainNode.connect(this.audioCtx.destination);
    this.scheduledEnd = 0;

    this.checkEndTimer = setInterval(() => {
      if (!this._playing) return;
      if (
        this.allChunksDone &&
        this.audioCtx &&
        this.pendingBytes.length === 0 &&
        !this.decodeTimeout
      ) {
        if (!this.hasAudioData) {
          this.finishPlayback();
          return;
        }
        const currentTime = this.audioCtx.currentTime;
        if (currentTime >= this.scheduledEnd - 0.05) {
          this.finishPlayback();
        }
      }
    }, 200);

    for (let i = 0; i < chunks.length; i++) {
      if (!this._playing) return;
      this.onChunkChange?.(i, chunks.length);
      try {
        await this.streamChunk(chunks[i], config, i === 0);
      } catch (err) {
        console.error("[DashScope TTS] chunk error:", err);
      }
    }

    this.flushPendingBytes();
    this.allChunksDone = true;
  }

  private async streamChunk(text: string, config: TTSConfig, isFirst: boolean): Promise<void> {
    const platform = getPlatformService();
    this.abortController = new AbortController();
    this.pendingBytes = [];

    const response = await platform.fetch(
      "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.dashscopeApiKey}`,
          "X-DashScope-SSE": "enable",
        },
        body: JSON.stringify({
          model: "qwen3-tts-flash",
          input: {
            text,
            voice: config.dashscopeVoice,
          },
        }),
        signal: this.abortController.signal,
      },
    );

    if (!response.ok) {
      throw new Error(`DashScope TTS failed: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response body reader");

    const decoder = new TextDecoder();
    let buffer = "";
    let firstAudioReceived = false;

    while (true) {
      if (!this._playing) {
        reader.cancel();
        return;
      }
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const jsonStr = line.slice(5).trim();
        if (!jsonStr) continue;

        try {
          const evt = JSON.parse(jsonStr);
          const audioData = evt?.output?.audio?.data;
          if (audioData && this.audioCtx) {
            const binary = atob(audioData);
            const bytes = new Uint8Array(binary.length);
            for (let j = 0; j < binary.length; j++) {
              bytes[j] = binary.charCodeAt(j);
            }
            this.pendingBytes.push(bytes);

            if (!firstAudioReceived) {
              firstAudioReceived = true;
              if (isFirst) {
                this.onStateChange?.("playing");
              }
            }

            this.scheduleFlush();
          }
        } catch (err) {
          console.warn("[TTS] Failed to parse DashScope stream JSON:", err);
        }
      }
    }

    this.flushPendingBytes();
  }

  private scheduleFlush() {
    if (this.decodeTimeout) return;
    this.decodeTimeout = setTimeout(() => {
      this.decodeTimeout = null;
      this.flushPendingBytes();
    }, 100);
  }

  private flushPendingBytes() {
    if (this.decodeTimeout) {
      clearTimeout(this.decodeTimeout);
      this.decodeTimeout = null;
    }
    if (this.pendingBytes.length === 0 || !this.audioCtx || !this.gainNode) return;

    const totalLen = this.pendingBytes.reduce((s, c) => s + c.length, 0);
    const merged = new Uint8Array(totalLen);
    let off = 0;
    for (const chunk of this.pendingBytes) {
      merged.set(chunk, off);
      off += chunk.length;
    }
    this.pendingBytes = [];

    const PCM_SAMPLE_RATE = 24000;
    const numSamples = Math.floor(merged.length / 2);
    if (numSamples === 0) return;

    const ctx = this.audioCtx;
    const gain = this.gainNode;
    const audioBuffer = ctx.createBuffer(1, numSamples, PCM_SAMPLE_RATE);
    const channelData = audioBuffer.getChannelData(0);
    const view = new DataView(merged.buffer, merged.byteOffset, merged.byteLength);

    for (let i = 0; i < numSamples; i++) {
      const sample = view.getInt16(i * 2, true);
      channelData[i] = sample / 32768;
    }

    if (!this._playing) return;
    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(gain);

    const startAt = Math.max(ctx.currentTime, this.scheduledEnd);
    source.start(startAt);
    this.scheduledEnd = startAt + audioBuffer.duration;
    this.hasAudioData = true;
  }

  private finishPlayback() {
    if (this.checkEndTimer) {
      clearInterval(this.checkEndTimer);
      this.checkEndTimer = null;
    }
    const onEnd = this.onEnd;
    this.cleanupAudio();
    this._playing = false;
    this._paused = false;
    this.onStateChange?.("stopped");
    onEnd?.();
  }

  pause() {
    if (!this._playing || this._paused) return;
    this.audioCtx?.suspend();
    this._paused = true;
    this.onStateChange?.("paused");
  }

  resume() {
    if (!this._playing || !this._paused) return;
    this.audioCtx?.resume();
    this._paused = false;
    this.onStateChange?.("playing");
  }

  stop() {
    this.abortController?.abort();
    this.abortController = null;
    if (this.checkEndTimer) {
      clearInterval(this.checkEndTimer);
      this.checkEndTimer = null;
    }
    if (this.decodeTimeout) {
      clearTimeout(this.decodeTimeout);
      this.decodeTimeout = null;
    }
    this.cleanupAudio();
    this.pendingBytes = [];
    this.allChunksDone = false;
    this.hasAudioData = false;
    this._playing = false;
    this._paused = false;
    this.onStateChange?.("stopped");
  }

  private cleanupAudio() {
    if (this.audioCtx) {
      this.audioCtx.close().catch(() => {});
      this.audioCtx = null;
    }
    this.gainNode = null;
    this.scheduledEnd = 0;
  }
}
