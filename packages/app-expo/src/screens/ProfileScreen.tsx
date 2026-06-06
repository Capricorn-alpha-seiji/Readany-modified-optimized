import {
  BarChart3Icon,
  BookOpenIcon,
  ChevronRightIcon,
  ClockIcon,
  CloudIcon,
  CpuIcon,
  DatabaseIcon,
  FlameIcon,
  InfoIcon,
  LanguagesIcon,
  PaletteIcon,
  PuzzleIcon,
  Trash2Icon,
  TypeIcon,
  Volume2Icon,
} from "@/components/ui/Icon";
import { SyncButton } from "@/components/ui/SyncButton";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";
import { clearMobileRuntimeCache, formatCacheSize } from "@/lib/platform/mobile-cache";
import { stopTTSPreview } from "@/lib/platform/tts-preview";
import {
  mergeCurrentSessionIntoDailyStats,
  mergeCurrentSessionIntoOverallStats,
} from "@/lib/stats/live-reading-stats";
import type { RootStackParamList } from "@/navigation/RootNavigator";
import { formatCharacterCount, formatTimeLocalized } from "@/screens/stats/stats-utils";
import { useReadingSessionStore, useTTSStore } from "@/stores";
import {
  type ThemeColors,
  fontSize,
  fontWeight,
  radius,
  useColors,
  withOpacity,
} from "@/styles/theme";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { readingStatsService } from "@readany/core/stats";
import type { DailyStats, OverallStats } from "@readany/core/stats";
import { eventBus } from "@readany/core/utils/event-bus";
import Constants from "expo-constants";
/**
 * ProfileScreen 鈥?matching Tauri mobile ProfilePage exactly.
 * Features: reading stats cards, heatmap, settings menu (general/skills/about),
 * complete menu items including Skills and VectorModel.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  type StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type Nav = NativeStackNavigationProp<RootStackParamList>;
type ProfileMenuIcon = (props: {
  size?: number;
  color?: string;
  strokeWidth?: number;
}) => React.ReactNode;
type ProfileMenuRoute = Extract<
  keyof RootStackParamList,
  | "AppearanceSettings"
  | "FontSettings"
  | "SyncSettings"
  | "AISettings"
  | "TTSSettings"
  | "TranslationSettings"
  | "Skills"
  | "VectorModelSettings"
  | "About"
>;
type ProfileMenuItem =
  | {
      icon: ProfileMenuIcon;
      label: string;
      route: ProfileMenuRoute;
    }
  | {
      icon: ProfileMenuIcon;
      label: string;
      action: () => void;
      disabled?: boolean;
    };

const APP_DEVELOPER = "Capricorn-\u03b1";

function formatBuildTimestamp(value: unknown) {
  if (typeof value !== "string" || !value) {
    return "unknown";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
}

function StatCard({
  icon,
  title,
  value,
  unit,
  onPress,
  style,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  unit?: string;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useColors();
  const s = makeStyles(colors);
  return (
    <TouchableOpacity activeOpacity={0.7} onPress={onPress} style={[s.statCard, style]}>
      <View style={s.statCardTitleRow}>
        <View style={s.statCardIconWrap}>{icon}</View>
        <Text style={s.statCardTitle} numberOfLines={1} maxFontSizeMultiplier={1.6}>
          {title}
        </Text>
      </View>
      <View style={s.statCardBody}>
        <Text style={s.statCardValue} numberOfLines={1} maxFontSizeMultiplier={1.8}>
          {value}
        </Text>
        {unit && (
          <Text style={s.statCardUnit} maxFontSizeMultiplier={1.6}>
            {unit}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

/** Compact heatmap 鈥?last 16 weeks, matching Tauri MobileHeatmap */
function MiniHeatmap({ dailyStats }: { dailyStats: DailyStats[] }) {
  const themeColors = useColors();
  const s = makeStyles(themeColors);
  const { t } = useTranslation();
  const WEEKS = 16;
  const DAYS_PER_WEEK = 7;
  const GAP = 2;
  const [containerWidth, setContainerWidth] = useState(0);
  const [selectedCell, setSelectedCell] = useState<{
    date: string;
    time: number;
    x: number;
    y: number;
  } | null>(null);

  // Calculate cell size based on container width
  // containerWidth = WEEKS * CELL + (WEEKS - 1) * GAP
  const CELL = containerWidth > 0 ? Math.floor((containerWidth - (WEEKS - 1) * GAP) / WEEKS) : 8;
  const gridWidth = WEEKS * CELL + (WEEKS - 1) * GAP;
  const gridHeight = DAYS_PER_WEEK * CELL + (DAYS_PER_WEEK - 1) * GAP;

  const cells = useMemo(() => {
    const statsMap = new Map<string, number>();
    for (const d of dailyStats) statsMap.set(d.date, d.totalTime);

    const today = new Date();
    const result: { col: number; row: number; intensity: number; date: string; time: number }[] =
      [];
    const maxTime = Math.max(1, ...dailyStats.map((d) => d.totalTime));

    for (let w = WEEKS - 1; w >= 0; w--) {
      for (let d = 0; d < DAYS_PER_WEEK; d++) {
        const date = new Date(today);
        date.setDate(today.getDate() - (w * 7 + (6 - d)));
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
        const time = statsMap.get(key) || 0;
        result.push({
          col: WEEKS - 1 - w,
          row: d,
          intensity: time > 0 ? Math.min(1, time / maxTime) : 0,
          date: key,
          time,
        });
      }
    }
    return result;
  }, [dailyStats]);

  const getColor = (intensity: number) => {
    if (intensity <= 0) return themeColors.muted;
    if (intensity < 0.25) return withOpacity(themeColors.primary, 0.3);
    if (intensity < 0.5) return withOpacity(themeColors.primary, 0.5);
    if (intensity < 0.75) return withOpacity(themeColors.primary, 0.7);
    return withOpacity(themeColors.primary, 0.9);
  };

  const formatDisplayDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };

  const formatTime = (minutes: number) => {
    if (minutes < 60) return `${Math.round(minutes)}${t("common.minutes", "鍒嗛挓")}`;
    return `${(minutes / 60).toFixed(1)}${t("common.hours", "灏忔椂")}`;
  };

  const handleCellPress = (cell: { date: string; time: number }, col: number, row: number) => {
    const x = col * (CELL + GAP) + CELL / 2;
    const y = row * (CELL + GAP) + CELL / 2;
    if (selectedCell?.date === cell.date) {
      setSelectedCell(null);
    } else {
      setSelectedCell({ ...cell, x, y });
      setTimeout(() => setSelectedCell(null), 1000);
    }
  };

  // Calculate tooltip position with boundary detection
  const getTooltipStyle = () => {
    if (!selectedCell || containerWidth === 0) return null;
    const TOOLTIP_WIDTH = 80;
    const TOOLTIP_HEIGHT = 24;

    let left = selectedCell.x - TOOLTIP_WIDTH / 2;
    let top = selectedCell.y - TOOLTIP_HEIGHT - 8;

    // Boundary detection
    if (left < 4) left = 4;
    if (left + TOOLTIP_WIDTH > containerWidth - 4) left = containerWidth - TOOLTIP_WIDTH - 4;
    if (top < 4) top = selectedCell.y + CELL + 4; // Show below if no space above

    return { left, top };
  };

  const tooltipStyle = getTooltipStyle();

  return (
    <View
      style={s.heatmapContainer}
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
    >
      {containerWidth > 0 && (
        <View style={[s.heatmapGrid, { width: gridWidth, height: gridHeight }]}>
          {cells.map((cell) => (
            <TouchableOpacity
              key={cell.date}
              style={{
                position: "absolute",
                left: cell.col * (CELL + GAP),
                top: cell.row * (CELL + GAP),
                width: CELL,
                height: CELL,
                borderRadius: Math.max(2, CELL * 0.25),
                backgroundColor: getColor(cell.intensity),
              }}
              onPress={() => handleCellPress(cell, cell.col, cell.row)}
              activeOpacity={0.7}
            />
          ))}
        </View>
      )}

      {/* Selected cell tooltip */}
      {selectedCell && tooltipStyle && (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            ...tooltipStyle,
            backgroundColor: themeColors.card,
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 4,
            borderWidth: 0.5,
            borderColor: themeColors.border,
            minWidth: 80,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.15,
            shadowRadius: 2,
            elevation: 3,
          }}
        >
          <Text
            style={{
              fontSize: 12,
              color: themeColors.cardForeground,
              fontWeight: "500",
              textAlign: "center",
            }}
          >
            {formatDisplayDate(selectedCell.date)}{" "}
            {selectedCell.time > 0 ? formatTime(selectedCell.time) : t("stats.noReading", "No reading")}
          </Text>
        </View>
      )}

      <View style={s.heatmapLegend}>
        <Text style={s.heatmapLegendText}>{t("common.less", "Less")}</Text>
        {[0, 0.25, 0.5, 0.75, 1].map((v) => (
          <View key={v} style={[s.heatmapLegendCell, { backgroundColor: getColor(v) }]} />
        ))}
        <Text style={s.heatmapLegendText}>{t("common.more", "More")}</Text>
      </View>
    </View>
  );
}

export function ProfileScreen() {
  const colors = useColors();
  const s = makeStyles(colors);
  const { t, i18n } = useTranslation();
  const layout = useResponsiveLayout();
  const statsGridColumns = layout.isTablet ? 4 : 2;
  const statCardSlotWidth = `${100 / statsGridColumns}%` as `${number}%`;
  const nav = useNavigation<Nav>();
  const [overall, setOverall] = useState<OverallStats | null>(null);
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);
  const [clearingCache, setClearingCache] = useState(false);
  const saveCurrentSession = useReadingSessionStore((s) => s.saveCurrentSession);
  const currentSession = useReadingSessionStore((s) => s.currentSession);
  const stopTTS = useTTSStore((s) => s.stop);

  const loadStats = useCallback(async () => {
    try {
      setStatsLoading(true);
      await saveCurrentSession();

      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 365);

      const [daily, overallStats] = await Promise.all([
        readingStatsService.getDailyStats(startDate, endDate),
        readingStatsService.getOverallStats(),
      ]);
      setDailyStats(daily);
      setOverall(overallStats);
    } catch (err) {
      console.error("[ProfileScreen] Failed to load stats:", err);
    } finally {
      setStatsLoading(false);
    }
  }, [saveCurrentSession]);

  useFocusEffect(
    useCallback(() => {
      void loadStats();
    }, [loadStats]),
  );

  useEffect(() => {
    return eventBus.on("sync:completed", () => {
      void loadStats();
    });
  }, [loadStats]);

  const liveDailyStats = useMemo(
    () => mergeCurrentSessionIntoDailyStats(dailyStats, currentSession),
    [dailyStats, currentSession],
  );
  const liveOverall = useMemo(
    () => mergeCurrentSessionIntoOverallStats(overall, dailyStats, currentSession),
    [overall, dailyStats, currentSession],
  );
  const isZh = i18n.language.startsWith("zh");
  const handleClearCache = useCallback(() => {
    Alert.alert(
      t("profile.clearCacheTitle", "娓呴櫎缂撳瓨"),
      t(
        "profile.clearCacheConfirm",
        "Temporary imported files, TTS audio cache, and runtime cache will be cleared. Books, notes, settings, and sync data will not be deleted.",
      ),
      [
        { text: t("common.cancel", "鍙栨秷"), style: "cancel" },
        {
          text: t("profile.clearCacheAction", "娓呴櫎缂撳瓨"),
          style: "destructive",
          onPress: async () => {
            setClearingCache(true);
            try {
              stopTTS();
              stopTTSPreview();
              const result = await clearMobileRuntimeCache();
              Alert.alert(
                t("profile.clearCacheDoneTitle", "Cache cleared"),
                t("profile.clearCacheDoneDesc", {
                  count: result.deletedFiles,
                  size: formatCacheSize(result.deletedBytes),
                }),
              );
            } catch (error) {
              console.error("[ProfileScreen] Failed to clear cache:", error);
              Alert.alert(
                t("profile.clearCacheFailedTitle", "娓呴櫎澶辫触"),
                error instanceof Error
                  ? error.message
                  : t("profile.clearCacheFailedDesc", "Please try again later."),
              );
            } finally {
              setClearingCache(false);
            }
          },
        },
      ],
    );
  }, [stopTTS, t]);

  // Settings menu 鈥?matching Tauri ProfilePage exactly
  const menuSections = useMemo<{ title: string; items: ProfileMenuItem[] }[]>(
    () => [
      {
        title: t("settings.general", "閫氱敤"),
        items: [
          {
            icon: PaletteIcon,
            label: t("settings.general", "閫氱敤"),
            route: "AppearanceSettings" as const,
          },
          {
            icon: TypeIcon,
            label: t("fonts.title", "瀛椾綋"),
            route: "FontSettings" as const,
          },
          { icon: CloudIcon, label: t("settings.sync", "鍚屾"), route: "SyncSettings" as const },
        ],
      },
      {
        title: t("profile.storage", "瀛樺偍"),
        items: [
          {
            icon: Trash2Icon,
            label: clearingCache
              ? t("profile.clearingCache", "娓呴櫎涓?..")
              : t("profile.clearCache", "娓呴櫎缂撳瓨"),
            action: handleClearCache,
            disabled: clearingCache,
          },
        ],
      },
      {
        title: t("settings.skills", "鑳藉姏"),
        items: [
          {
            icon: DatabaseIcon,
            label: t("settings.ai_title", "AI 妯″瀷"),
            route: "AISettings" as const,
          },
          { icon: Volume2Icon, label: t("tts.title", "璇煶鏈楄"), route: "TTSSettings" as const },
          {
            icon: LanguagesIcon,
            label: t("settings.translationTab", "缈昏瘧"),
            route: "TranslationSettings" as const,
          },
          { icon: PuzzleIcon, label: t("skills.title", "Skills"), route: "Skills" as const },
          {
            icon: CpuIcon,
            label: t("settings.vm_title", "鍚戦噺妯″瀷"),
            route: "VectorModelSettings" as const,
          },
        ],
      },
      {
        title: t("settings.other", "鏇村"),
        items: [
          { icon: InfoIcon, label: t("settings.about", "鍏充簬"), route: "About" as const },
        ],
      },
    ],
    [t, clearingCache, handleClearCache],
  );

  const appVersion = Constants.expoConfig?.version ?? "1.3.2-pre2";
  const buildTimestamp = formatBuildTimestamp(Constants.expoConfig?.extra?.buildTimestamp);

  const booksRead = liveOverall?.totalBooks ?? 0;
  const totalTime = liveOverall
    ? formatTimeLocalized(liveOverall.totalReadingTime, isZh)
    : formatTimeLocalized(0, isZh);
  const totalCharacters = liveOverall
    ? formatCharacterCount(liveOverall.totalCharactersRead ?? 0, isZh)
    : formatCharacterCount(0, isZh);
  const streak = liveOverall?.currentStreak ?? 0;
  const overviewCards = [
    {
      key: "time",
      icon: <ClockIcon size={16} color={colors.primary} />,
      title: t("profile.totalTime", "Total time"),
      value: totalTime,
    },
    {
      key: "volume",
      icon: <TypeIcon size={16} color={colors.primary} />,
      title: t("profile.readingVolume", "闃呰瀛楁暟"),
      value: totalCharacters,
    },
    {
      key: "books",
      icon: <BookOpenIcon size={16} color={colors.primary} />,
      title: t("profile.booksRead", "宸茶"),
      value: String(booksRead),
      unit: t("profile.booksUnit", "books"),
    },
    {
      key: "streak",
      icon: <FlameIcon size={16} color={colors.primary} />,
      title: t("profile.streak", "杩炵画闃呰"),
      value: String(streak),
      unit: t("profile.daysUnit", "days"),
    },
  ];

  return (
    <SafeAreaView style={[s.container, { backgroundColor: colors.background }]} edges={["top"]}>
      <View style={s.header}>
        <View style={s.headerTitleWrap}>
          <Text style={s.headerTitle} numberOfLines={1} maxFontSizeMultiplier={1.6}>
            {t("profile.title", "鎴戠殑")}
          </Text>
        </View>
        <SyncButton size={20} color={colors.mutedForeground} />
      </View>

      <ScrollView
        style={s.scrollView}
        contentContainerStyle={{ paddingTop: 20, paddingBottom: 12 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Stats cards */}
        <View style={s.statsSection}>
          {statsLoading ? (
            <View style={s.statsLoading}>
              <ActivityIndicator size="small" color={colors.mutedForeground} />
            </View>
          ) : (
            <View style={s.statsGrid}>
              {overviewCards.map((card) => (
                <View
                  key={card.key}
                  style={{
                    width: statCardSlotWidth,
                    paddingHorizontal: 6,
                    paddingBottom: 12,
                  }}
                >
                  <StatCard
                    icon={card.icon}
                    title={card.title}
                    value={card.value}
                    unit={card.unit}
                    onPress={() => nav.navigate("Stats")}
                    style={{ width: "100%" }}
                  />
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Compact heatmap */}
        <View style={s.heatmapSection}>
          <View style={s.heatmapHeader}>
            <Text style={s.heatmapTitle} numberOfLines={1} maxFontSizeMultiplier={1.5}>
              {t("profile.readingActivity", "闃呰娲诲姩")}
            </Text>
            <TouchableOpacity style={s.heatmapDetailBtn} onPress={() => nav.navigate("Stats")}>
              <BarChart3Icon size={14} color={colors.primary} />
              <Text style={s.heatmapDetailText} numberOfLines={1} maxFontSizeMultiplier={1.4}>
                {t("profile.viewDetails", "鏌ョ湅璇︽儏")}
              </Text>
            </TouchableOpacity>
          </View>
          <MiniHeatmap dailyStats={liveDailyStats} />
        </View>

        {/* Settings menu */}
        {menuSections.map((section) => (
          <View key={section.title} style={s.menuSection}>
            <Text style={s.menuSectionTitle} maxFontSizeMultiplier={1.5}>
              {section.title}
            </Text>
            <View style={s.menuCard}>
              {section.items.map((item, idx) => {
                const Icon = item.icon;
                const itemKey = "route" in item ? item.route : item.label;
                const handlePress = () => {
                  if ("disabled" in item && item.disabled) {
                    return;
                  }
                  if ("action" in item && item.action) {
                    item.action();
                  } else if ("route" in item) {
                    nav.navigate(item.route);
                  }
                };
                return (
                  <TouchableOpacity
                    key={itemKey}
                    style={[s.menuItem, idx < section.items.length - 1 && s.menuItemBorder]}
                    onPress={handlePress}
                    disabled={"disabled" in item && item.disabled}
                    activeOpacity={0.7}
                  >
                    <Icon size={20} color={colors.mutedForeground} />
                    <Text style={s.menuItemLabel} maxFontSizeMultiplier={1.7}>
                      {item.label}
                    </Text>
                    <ChevronRightIcon size={16} color={colors.mutedForeground} />
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ))}

        {/* Version */}
        <Text style={s.version} maxFontSizeMultiplier={1.4}>
          ReadAny Mobile v{appVersion}
        </Text>
        <Text style={s.buildInfo} maxFontSizeMultiplier={1.4}>
          Build {buildTimestamp}
        </Text>
        <Text style={s.developer} maxFontSizeMultiplier={1.4}>
          Developer: {APP_DEVELOPER}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 12,
      borderBottomWidth: 0.5,
      borderBottomColor: colors.border,
    },
    headerTitleWrap: {
      flex: 1,
      minWidth: 0,
      marginRight: 12,
    },
    headerTitle: {
      fontSize: fontSize["2xl"],
      lineHeight: fontSize["2xl"] * 1.4,
      fontWeight: fontWeight.bold,
      color: colors.foreground,
    },
    scrollView: { flex: 1 },
    // Stats
    statsSection: { paddingHorizontal: 16, paddingTop: 16 },
    statsLoading: { alignItems: "center", justifyContent: "center", paddingVertical: 32 },
    statsGrid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -6 },
    statCard: {
      backgroundColor: colors.card,
      borderRadius: radius.xl,
      borderWidth: 0.5,
      borderColor: colors.border,
      paddingHorizontal: 12,
      paddingTop: 12,
      paddingBottom: 10,
      minHeight: 102,
    },
    statCardHeader: {
      marginBottom: 10,
    },
    statCardTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      minWidth: 0,
    },
    statCardIconWrap: {
      width: 24,
      height: 24,
      borderRadius: radius.md,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: withOpacity(colors.primary, 0.1),
    },
    statCardTitle: {
      flex: 1,
      fontSize: 11,
      lineHeight: 16,
      fontWeight: fontWeight.medium,
      color: withOpacity(colors.mutedForeground, 0.8),
    },
    statCardBody: { flexDirection: "row", alignItems: "baseline", gap: 4 },
    statCardValue: {
      flexShrink: 1,
      fontSize: 25,
      lineHeight: 32,
      fontWeight: fontWeight.bold,
      color: colors.foreground,
      letterSpacing: -0.8,
    },
    statCardUnit: {
      fontSize: 12,
      lineHeight: 18,
      color: withOpacity(colors.mutedForeground, 0.78),
      fontWeight: fontWeight.medium,
    },
    statCardMetaRow: {
      marginTop: 6,
    },
    statCardMetaText: {
      fontSize: 11,
      lineHeight: 16,
      color: withOpacity(colors.mutedForeground, 0.72),
    },
    statCardMetaLabel: {
      color: withOpacity(colors.mutedForeground, 0.72),
    },
    statCardMetaDivider: {
      color: withOpacity(colors.mutedForeground, 0.46),
    },
    statCardMetaValue: {
      fontWeight: fontWeight.semibold,
      color: withOpacity(colors.foreground, 0.78),
    },
    // Heatmap
    heatmapSection: {
      marginHorizontal: 16,
      marginTop: 16,
      backgroundColor: colors.card,
      borderRadius: radius.xl,
      borderWidth: 0.5,
      borderColor: colors.border,
      padding: 16,
    },
    heatmapHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 12,
    },
    heatmapTitle: {
      flex: 1,
      minWidth: 0,
      fontSize: fontSize.sm,
      lineHeight: fontSize.sm * 1.5,
      fontWeight: fontWeight.medium,
      color: colors.mutedForeground,
    },
    heatmapDetailBtn: {
      flexShrink: 0,
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    heatmapDetailText: {
      fontSize: fontSize.xs,
      lineHeight: fontSize.xs * 1.5,
      color: colors.primary,
    },
    heatmapContainer: { width: "100%" },
    heatmapGrid: { alignSelf: "center" },
    heatmapLegend: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-end",
      gap: 4,
      marginTop: 8,
    },
    heatmapLegendText: { fontSize: 9, color: colors.mutedForeground },
    heatmapLegendCell: { width: 8, height: 8, borderRadius: 2 },
    // Menu
    menuSection: { paddingHorizontal: 16, marginTop: 16 },
    menuSectionTitle: {
      fontSize: fontSize.xs,
      lineHeight: fontSize.xs * 1.5,
      fontWeight: fontWeight.medium,
      color: colors.mutedForeground,
      textTransform: "uppercase",
      letterSpacing: 0.8,
      marginBottom: 8,
    },
    menuCard: {
      backgroundColor: colors.card,
      borderRadius: radius.xl,
      borderWidth: 0.5,
      borderColor: colors.border,
      overflow: "hidden",
    },
    menuItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    menuItemBorder: { borderBottomWidth: 0.5, borderBottomColor: colors.border },
    menuItemLabel: {
      flex: 1,
      fontSize: fontSize.md,
      lineHeight: fontSize.md * 1.5,
      color: colors.foreground,
    },
    menuItemDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.destructive,
    },
    version: {
      textAlign: "center",
      fontSize: fontSize.xs,
      lineHeight: fontSize.xs * 1.6,
      color: colors.mutedForeground,
      marginTop: 16,
      marginBottom: 2,
    },
    buildInfo: {
      textAlign: "center",
      fontSize: fontSize.xs,
      lineHeight: fontSize.xs * 1.6,
      color: colors.mutedForeground,
      marginBottom: 2,
    },
    developer: {
      textAlign: "center",
      fontSize: fontSize.xs,
      lineHeight: fontSize.xs * 1.6,
      color: colors.mutedForeground,
      marginBottom: 18,
    },
  });
