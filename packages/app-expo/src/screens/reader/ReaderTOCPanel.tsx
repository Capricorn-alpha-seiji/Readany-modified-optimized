/**
 * ReaderTOCPanel - bottom-sheet modal with two tabs: Table of Contents and Bookmarks.
 */
import {
  BookmarkFilledIcon,
  BookmarkIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  Trash2Icon,
  XIcon,
} from "@/components/ui/Icon";
import { useResponsiveLayout } from "@/hooks/use-responsive-layout";
import { fontSize, useColors } from "@/styles/theme";
import type { TOCItem } from "@readany/core/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Modal, Pressable, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SCREEN_HEIGHT } from "./reader-constants";
import { ListIcon } from "./reader-icons";
import { makeStyles } from "./reader-styles";
import { makeTocStyles } from "./TOCTreeItem";

export type Bookmark = {
  id: string;
  bookId: string;
  cfi: string;
  label?: string;
  chapterTitle?: string;
  createdAt: number;
};

type FlatTocItem = {
  item: TOCItem;
  level: number;
};

const TOC_ROW_HEIGHT = 40;

function getTocItemKey(item: TOCItem): string {
  return item.id || item.href || item.title;
}

function findCurrentTocPath(items: TOCItem[], currentChapter: string): string[] {
  if (!currentChapter) return [];

  for (const item of items) {
    const key = getTocItemKey(item);
    if (item.title === currentChapter) {
      return [key];
    }

    const childPath = item.subitems ? findCurrentTocPath(item.subitems, currentChapter) : [];
    if (childPath.length > 0) {
      return [key, ...childPath];
    }
  }

  return [];
}

function flattenTocItems(items: TOCItem[], expandedKeys: Set<string>, level = 0): FlatTocItem[] {
  const result: FlatTocItem[] = [];

  for (const item of items) {
    result.push({ item, level });

    const key = getTocItemKey(item);
    if (item.subitems?.length && expandedKeys.has(key)) {
      result.push(...flattenTocItems(item.subitems, expandedKeys, level + 1));
    }
  }

  return result;
}

interface Props {
  visible: boolean;
  activeTab: "toc" | "bookmarks";
  toc: TOCItem[];
  bookmarks: Bookmark[];
  currentChapter: string;
  onClose: () => void;
  onTabChange: (tab: "toc" | "bookmarks") => void;
  onSelectTocItem: (href: string) => void;
  onGoToBookmark: (cfi: string) => void;
  onDeleteBookmark: (id: string) => void;
}

export function ReaderTOCPanel({
  visible,
  activeTab,
  toc,
  bookmarks,
  currentChapter,
  onClose,
  onTabChange,
  onSelectTocItem,
  onGoToBookmark,
  onDeleteBookmark,
}: Props) {
  const colors = useColors();
  const s = makeStyles(colors);
  const tocS = makeTocStyles(colors);
  const insets = useSafeAreaInsets();
  const layout = useResponsiveLayout();
  const { t, i18n } = useTranslation();
  const tocListRef = useRef<FlatList<FlatTocItem>>(null);
  const currentTocPath = useMemo(
    () => findCurrentTocPath(toc, currentChapter),
    [toc, currentChapter],
  );
  const currentTocKey = currentTocPath[currentTocPath.length - 1] || "";
  const [expandedTocKeys, setExpandedTocKeys] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (!visible || activeTab !== "toc" || currentTocPath.length <= 1) return;

    setExpandedTocKeys((prev) => {
      const next = new Set(prev);
      currentTocPath.slice(0, -1).forEach((key) => next.add(key));
      return next;
    });
  }, [activeTab, currentTocPath, visible]);

  const flatTocItems = useMemo(
    () => flattenTocItems(toc, expandedTocKeys),
    [expandedTocKeys, toc],
  );

  const currentTocIndex = useMemo(
    () => flatTocItems.findIndex(({ item }) => getTocItemKey(item) === currentTocKey),
    [currentTocKey, flatTocItems],
  );

  useEffect(() => {
    if (!visible || activeTab !== "toc" || currentTocIndex < 0) return;

    const timer = setTimeout(() => {
      tocListRef.current?.scrollToIndex({
        index: currentTocIndex,
        animated: false,
        viewPosition: 0.35,
      });
    }, 80);

    return () => clearTimeout(timer);
  }, [activeTab, currentTocIndex, visible]);

  const toggleTocItem = useCallback((key: string) => {
    setExpandedTocKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.modalBackdrop} onPress={onClose} />
      <View
        style={[
          s.bottomSheet,
          { maxHeight: SCREEN_HEIGHT * 0.7, paddingBottom: insets.bottom || 16 },
          layout.isTablet && {
            width: "100%",
          },
        ]}
      >
        <View style={s.sheetHeader}>
          <View style={s.tocTabBar}>
            <TouchableOpacity
              style={[
                s.tocTab,
                activeTab === "toc" && { backgroundColor: `${colors.primary}14` },
              ]}
              onPress={() => onTabChange("toc")}
            >
              <ListIcon
                size={14}
                color={activeTab === "toc" ? colors.primary : colors.mutedForeground}
              />
              <Text
                style={[
                  s.tocTabText,
                  { color: activeTab === "toc" ? colors.primary : colors.mutedForeground },
                ]}
              >
                {t("reader.toc", "Table of Contents")}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                s.tocTab,
                activeTab === "bookmarks" && { backgroundColor: `${colors.primary}14` },
              ]}
              onPress={() => onTabChange("bookmarks")}
            >
              {activeTab === "bookmarks" ? (
                <BookmarkFilledIcon size={14} color={colors.primary} />
              ) : (
                <BookmarkIcon size={14} color={colors.mutedForeground} />
              )}
              <Text
                style={[
                  s.tocTabText,
                  {
                    color:
                      activeTab === "bookmarks" ? colors.primary : colors.mutedForeground,
                  },
                ]}
              >
                {t("bookmarks.title", "Bookmarks")}
                {bookmarks.length > 0 ? ` (${bookmarks.length})` : ""}
              </Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity onPress={onClose}>
            <XIcon size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        {activeTab === "toc" ? (
          <FlatList
            ref={tocListRef}
            data={flatTocItems}
            keyExtractor={({ item }) => getTocItemKey(item)}
            showsVerticalScrollIndicator={false}
            style={s.sheetScroll}
            getItemLayout={(_, index) => ({
              length: TOC_ROW_HEIGHT,
              offset: TOC_ROW_HEIGHT * index,
              index,
            })}
            onScrollToIndexFailed={({ index }) => {
              if (flatTocItems.length === 0) return;
              setTimeout(() => {
                tocListRef.current?.scrollToIndex({
                  index: Math.min(index, flatTocItems.length - 1),
                  animated: false,
                  viewPosition: 0.35,
                });
              }, 120);
            }}
            ListEmptyComponent={
              <Text style={s.sheetEmpty}>{t("reader.noToc", "No table of contents")}</Text>
            }
            renderItem={({ item: flatItem }) => {
              const item = flatItem.item;
              const key = getTocItemKey(item);
              const hasChildren = !!item.subitems?.length;
              const expanded = expandedTocKeys.has(key);
              const isCurrent = key === currentTocKey || item.title === currentChapter;

              return (
                <TouchableOpacity
                  style={[
                    tocS.item,
                    { minHeight: TOC_ROW_HEIGHT, paddingLeft: 12 + flatItem.level * 16 },
                    isCurrent && tocS.itemActive,
                  ]}
                  onPress={() => item.href && onSelectTocItem(item.href)}
                  activeOpacity={0.7}
                >
                  {hasChildren ? (
                    <TouchableOpacity
                      style={tocS.expandBtn}
                      onPress={() => toggleTocItem(key)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      {expanded ? (
                        <ChevronDownIcon size={14} color={colors.mutedForeground} />
                      ) : (
                        <ChevronRightIcon size={14} color={colors.mutedForeground} />
                      )}
                    </TouchableOpacity>
                  ) : (
                    <View style={tocS.expandPlaceholder} />
                  )}
                  <Text style={[tocS.itemText, isCurrent && tocS.itemTextActive]} numberOfLines={1}>
                    {item.title}
                  </Text>
                </TouchableOpacity>
              );
            }}
          />
        ) : bookmarks.length > 0 ? (
          <ScrollView showsVerticalScrollIndicator={false} style={s.sheetScroll}>
            {bookmarks.map((bm) => (
              <TouchableOpacity
                key={bm.id}
                style={s.bookmarkItem}
                onPress={() => onGoToBookmark(bm.cfi)}
                activeOpacity={0.6}
              >
                <BookmarkFilledIcon size={14} color={colors.primary} />
                <View style={s.bookmarkContent}>
                  <Text style={[s.bookmarkLabel, { color: colors.foreground }]} numberOfLines={1}>
                    {bm.chapterTitle || t("common.unnamed")}
                  </Text>
                  {bm.label ? (
                    <Text
                      style={[s.bookmarkSnippet, { color: colors.mutedForeground }]}
                      numberOfLines={2}
                    >
                      {bm.label}
                    </Text>
                  ) : null}
                  <Text style={[s.bookmarkDate, { color: colors.mutedForeground }]}>
                    {new Date(bm.createdAt).toLocaleDateString(i18n.language, {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Text>
                </View>
                <TouchableOpacity
                  style={s.bookmarkDeleteBtn}
                  onPress={() => onDeleteBookmark(bm.id)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Trash2Icon size={14} color={colors.mutedForeground} />
                </TouchableOpacity>
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : (
          <View style={s.notebookPlaceholder}>
            <BookmarkIcon size={32} color={`${colors.mutedForeground}60`} />
            <Text style={s.notebookPlaceholderText}>{t("bookmarks.empty", "No bookmarks")}</Text>
            <Text style={[s.notebookPlaceholderText, { fontSize: fontSize.xs, opacity: 0.6 }]}>
              {t("bookmarks.emptyHint", "Use the bookmark button in the toolbar to mark a page.")}
            </Text>
          </View>
        )}
      </View>
    </Modal>
  );
}
