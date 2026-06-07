import { useSyncStore } from "@/stores/sync-store";
import { useSettingsStore } from "@/stores/settings-store";
import { cn } from "@readany/core/utils";
import { RefreshCw } from "lucide-react";
import { useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

interface SyncButtonProps {
  className?: string;
  iconSize?: number;
}

export function SyncButton({ className, iconSize = 14 }: SyncButtonProps) {
  const { t } = useTranslation();
  const syncNow = useSyncStore((s) => s.syncNow);
  const status = useSyncStore((s) => s.status);
  const backendType = useSyncStore((s) => s.backendType);
  const loadConfig = useSyncStore((s) => s.loadConfig);
  const networkEnabled = useSettingsStore((s) => s.networkEnabled);

  const isBusy = status !== "idle" && status !== "error";

  useEffect(() => {
    if (!backendType) {
      void loadConfig();
    }
  }, [backendType, loadConfig]);

  const handleClick = useCallback(() => {
    if (isBusy) return;
    if (!networkEnabled) {
      toast.message(t("settings.networkDisabledTitle", "联网已关闭"), {
        description: t("settings.networkDisabledHint", "请在设置的通用页面开启联网权限后再同步。"),
      });
      return;
    }
    void syncNow().catch((err) => {
      toast.error(err instanceof Error ? err.message : String(err));
    });
  }, [isBusy, networkEnabled, syncNow, t]);

  if (!backendType) return null;

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isBusy}
      className={cn(
        "inline-flex items-center justify-center rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50",
        className,
      )}
      title={t("settings.syncNow")}
    >
      <RefreshCw className={cn("shrink-0", isBusy && "animate-spin")} style={{ width: iconSize, height: iconSize }} />
    </button>
  );
}
