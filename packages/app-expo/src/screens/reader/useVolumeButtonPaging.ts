/**
 * useVolumeButtonPaging — intercepts hardware volume buttons for page turning.
 * When active, suppresses the system volume UI and restores volume after each press.
 */
import { DeviceEventEmitter, Platform, NativeModules } from "react-native";
import { useEffect, useRef } from "react";
import { getVolumeManager } from "./reader-constants";

export interface UseVolumeButtonPagingOptions {
  active: boolean;
  settingViewMode: string;
  onPrev: () => void;
  onNext: () => void;
}

type ReadAnyKeyEventsNativeModule = {
  setVolumeKeyPagingEnabled?: (enabled: boolean) => Promise<void> | void;
};

type VolumeKeyEvent = {
  direction?: "prev" | "next";
  keyCode?: number;
};

function getReadAnyKeyEvents(): ReadAnyKeyEventsNativeModule | null {
  const nativeModule = NativeModules.ReadAnyKeyEvents as ReadAnyKeyEventsNativeModule | undefined;
  if (!nativeModule || typeof nativeModule.setVolumeKeyPagingEnabled !== "function") {
    return null;
  }
  return nativeModule;
}

export function useVolumeButtonPaging({
  active,
  settingViewMode,
  onPrev,
  onNext,
}: UseVolumeButtonPagingOptions) {
  const lastKnownHardwareVolumeRef = useRef<number | null>(null);
  const pendingVolumeRestoreRef = useRef<number | null>(null);
  const lastVolumeButtonHandledAtRef = useRef(0);
  const onPrevRef = useRef(onPrev);
  const onNextRef = useRef(onNext);

  useEffect(() => {
    onPrevRef.current = onPrev;
    onNextRef.current = onNext;
  }, [onPrev, onNext]);

  useEffect(() => {
    console.log("[ReaderScreen][VolumeNav] config", {
      hasNativeKeyEvents: !!getReadAnyKeyEvents(),
      hasNativeModule: !!NativeModules.VolumeManager,
      hasVolumeManagerBridge: !!getVolumeManager(),
      volumeButtonPagingActive: active,
    });
  }, [active]);

  useEffect(() => {
    const keyEvents = getReadAnyKeyEvents();
    const volumeManager = getVolumeManager();
    if (!active) {
      pendingVolumeRestoreRef.current = null;
      if (keyEvents) {
        void Promise.resolve(keyEvents.setVolumeKeyPagingEnabled?.(false)).catch((error) => {
          console.warn("[ReaderScreen][VolumeNav] disable-native-key-events failed", error);
        });
      }
      return;
    }

    let cancelled = false;
    let volumeListener: { remove: () => void } | null = null;

    if (keyEvents) {
      void Promise.resolve(keyEvents.setVolumeKeyPagingEnabled?.(true)).catch((error) => {
        console.warn("[ReaderScreen][VolumeNav] enable-native-key-events failed", error);
      });
      console.log("[ReaderScreen][VolumeNav] native-key-events enabled");

      const keySubscription = DeviceEventEmitter.addListener(
        "ReadAnyVolumeKey",
        (event: VolumeKeyEvent) => {
          if (cancelled) return;
          const now = Date.now();
          if (now - lastVolumeButtonHandledAtRef.current < 120) return;
          lastVolumeButtonHandledAtRef.current = now;
          console.log("[ReaderScreen][VolumeNav] native-key-event", event);
          if (event.direction === "prev") {
            console.log("[ReaderScreen][VolumeNav] go-prev");
            onPrevRef.current();
          } else if (event.direction === "next") {
            console.log("[ReaderScreen][VolumeNav] go-next");
            onNextRef.current();
          }
        },
      );

      return () => {
        cancelled = true;
        keySubscription.remove();
        void Promise.resolve(keyEvents.setVolumeKeyPagingEnabled?.(false)).catch((error) => {
          console.warn("[ReaderScreen][VolumeNav] restore-native-key-events failed", error);
        });
        console.log("[ReaderScreen][VolumeNav] native-key-events disabled");
      };
    }

    const restoreSystemVolume = async (targetVolume: number) => {
      if (!volumeManager) return;
      pendingVolumeRestoreRef.current = targetVolume;
      try {
        await volumeManager.setVolume(targetVolume, {
          showUI: false,
          playSound: false,
          type: "music",
        });
      } catch (error) {
        pendingVolumeRestoreRef.current = null;
        console.warn("[ReaderScreen][VolumeNav] restore-volume failed", error);
      }
    };

    const enableVolumeButtonPaging = async () => {
      if (!volumeManager) return;
      try {
        await volumeManager.showNativeVolumeUI({ enabled: false });
        const initialVolume = await volumeManager.getVolume();
        if (cancelled) return;

        lastKnownHardwareVolumeRef.current =
          typeof initialVolume.volume === "number" ? initialVolume.volume : null;

        if (__DEV__) {
          console.log("[ReaderScreen][VolumeNav] enabled", {
            initialVolume: lastKnownHardwareVolumeRef.current,
            viewMode: settingViewMode,
          });
        }

        volumeListener = volumeManager.addVolumeListener((result) => {
          const nextVolume =
            typeof result.volume === "number" && Number.isFinite(result.volume)
              ? result.volume
              : null;
          if (cancelled || nextVolume == null) return;

          const pendingRestore = pendingVolumeRestoreRef.current;
          if (pendingRestore != null && Math.abs(nextVolume - pendingRestore) < 0.0001) {
            pendingVolumeRestoreRef.current = null;
            lastKnownHardwareVolumeRef.current = nextVolume;
            if (__DEV__) {
              console.log("[ReaderScreen][VolumeNav] restore-event", { volume: nextVolume });
            }
            return;
          }

          const previousVolume = lastKnownHardwareVolumeRef.current;
          lastKnownHardwareVolumeRef.current = nextVolume;
          if (previousVolume == null) return;

          const delta = nextVolume - previousVolume;
          if (Math.abs(delta) < 0.0001) return;

          const now = Date.now();
          if (now - lastVolumeButtonHandledAtRef.current < 120) return;
          lastVolumeButtonHandledAtRef.current = now;

          const direction = delta > 0 ? "prev" : "next";
          if (__DEV__) {
            console.log("[ReaderScreen][VolumeNav] hardware-press", {
              direction,
              previousVolume,
              nextVolume,
              delta,
            });
          }

          if (direction === "prev") {
            onPrevRef.current();
          } else {
            onNextRef.current();
          }

          void restoreSystemVolume(previousVolume);
        });
      } catch (error) {
        console.warn("[ReaderScreen][VolumeNav] unavailable", error);
      }
    };

    void enableVolumeButtonPaging();

    return () => {
      cancelled = true;
      volumeListener?.remove();
      pendingVolumeRestoreRef.current = null;
      const vm = getVolumeManager();
      if (vm) {
        void vm.showNativeVolumeUI({ enabled: true }).catch((error) => {
          console.warn("[ReaderScreen][VolumeNav] restore-native-ui failed", error);
        });
      }
    };
  }, [active, settingViewMode]);
}
