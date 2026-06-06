import { useResponsiveLayout } from "@/hooks/use-responsive-layout";
import Constants from "expo-constants";
import { useTranslation } from "react-i18next";
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  type ThemeColors,
  fontSize,
  fontWeight,
  radius,
  spacing,
  useColors,
} from "../../styles/theme";
import { SettingsHeader } from "./SettingsHeader";
import AppIcon from "../../../assets/icon.png";

const APP_DEVELOPER = "Capricorn-\u03b1";

const TECH_STACK = [
  { label: "Expo SDK 55", descKey: "about.nativeContainer" },
  { label: "React Native", descKey: "about.uiFramework" },
  { label: "Foliate.js", descKey: "about.ebookRenderer" },
  { label: "SQLite", descKey: "about.localDatabase" },
];

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

export default function AboutScreen() {
  const colors = useColors();
  const styles = makeStyles(colors);
  const { t } = useTranslation();
  const layout = useResponsiveLayout();
  const version = Constants.expoConfig?.version ?? "1.3.2-pre2";
  const buildTimestamp = formatBuildTimestamp(Constants.expoConfig?.extra?.buildTimestamp);

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={["top"]}
    >
      <SettingsHeader title={t("about.title", "About")} />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={[styles.content, { maxWidth: layout.centeredContentWidth }]}>
          <View style={styles.logoSection}>
            <View style={styles.logoBadge}>
              <Image
                source={AppIcon}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.appName}>ReadAny</Text>
            <Text style={styles.version}>v{version}</Text>
            <Text style={styles.meta}>Build {buildTimestamp}</Text>
            <Text style={styles.meta}>Developer: {APP_DEVELOPER}</Text>
            <Text style={styles.desc}>
              {t(
                "about.desc",
                "A cross-platform intelligent ebook reader with AI chat, TTS, and translation.",
              )}
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t("about.techStack", "Tech Stack")}</Text>
            <View style={styles.techGrid}>
              {TECH_STACK.map((item) => (
                <View key={item.label} style={styles.techCard}>
                  <Text style={styles.techLabel}>{item.label}</Text>
                  <Text style={styles.techDesc}>{t(item.descKey, item.label)}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scroll: { flex: 1 },
    scrollContent: {
      alignItems: "center",
      paddingTop: spacing.xl,
      paddingBottom: 48,
    },
    content: {
      width: "100%",
    },
    logoSection: {
      alignItems: "center",
      paddingTop: 40,
      paddingBottom: 24,
      paddingHorizontal: 32,
    },
    logoBadge: {
      width: 80,
      height: 80,
      borderRadius: 18,
      overflow: "hidden",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 16,
    },
    logo: {
      width: 80,
      height: 80,
      borderRadius: 18,
    },
    appName: {
      fontSize: fontSize.xl,
      fontWeight: fontWeight.bold,
      color: colors.foreground,
    },
    version: {
      fontSize: fontSize.sm,
      color: colors.mutedForeground,
      marginTop: 4,
    },
    meta: {
      fontSize: fontSize.xs,
      color: colors.mutedForeground,
      marginTop: 4,
    },
    desc: {
      fontSize: fontSize.sm,
      color: colors.mutedForeground,
      textAlign: "center",
      lineHeight: 20,
      marginTop: 12,
    },
    section: {
      paddingHorizontal: spacing.lg,
      marginBottom: 16,
      gap: 12,
    },
    sectionTitle: {
      fontSize: fontSize.base,
      fontWeight: fontWeight.semibold,
      color: colors.foreground,
    },
    techGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    techCard: {
      width: "47%",
      borderRadius: radius.xl,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 12,
      gap: 4,
    },
    techLabel: {
      fontSize: fontSize.sm,
      fontWeight: fontWeight.medium,
      color: colors.foreground,
    },
    techDesc: {
      fontSize: fontSize.xs,
      color: colors.mutedForeground,
    },
  });
