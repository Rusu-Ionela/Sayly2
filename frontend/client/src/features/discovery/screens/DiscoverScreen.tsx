import { FlashList, type FlashListRef } from "@shopify/flash-list";
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, { FadeOut } from "react-native-reanimated";

import { ConnectionRequestSheet, useRequestConnection } from "@/features/connections";
import { Avatar } from "@/shared/components/Avatar";
import { Chip } from "@/shared/components/Chip";
import { useLanguages } from "@/features/languages";
import { findCatalogLanguage, languageFlag } from "@/features/languages/utils";
import { useProfile } from "@/features/profile";
import type { MainTabScreenProps } from "@/navigation/types";
import { useFloatingTabBarPadding } from "@/navigation/floatingTabBar";
import { AppRefreshControl } from "@/shared/components/AppRefreshControl";
import { IcebreakerCard } from "@/features/icebreakers";
import { usePracticeLanguages } from "@/features/icebreakers/hooks";
import { RadarView, VoiceSparksBar } from "@/features/pulse";
import { StreakBadge } from "@/features/streaks";
import { Screen } from "@/shared/components/Screen";
import { SearchField } from "@/shared/components/SearchField";
import { useDebounce } from "@/shared/hooks/useDebounce";
import { useColors } from "@/shared/theme";
import { spacing } from "@/shared/theme/spacing";

import { DiscoveryEmptyState } from "../components/DiscoveryEmptyState";
import { DiscoveryLoadingView } from "../components/DiscoveryLoadingView";
import { FilterBottomSheet } from "../components/FilterBottomSheet";
import { UserCard } from "../components/UserCard";
import { useDiscovery } from "../hooks/useDiscovery";
import type { DiscoveryFilters, DiscoveryUser } from "../types";
import { countActiveFilters } from "../utils";

const EMPTY_LANGUAGE_CATALOG: never[] = [];

export function DiscoverScreen({ navigation }: MainTabScreenProps<"Community">) {
  const [searchInput, setSearchInput] = useState("");
  const [appliedFilters, setAppliedFilters] = useState<DiscoveryFilters>({});
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [isPullRefreshing, setIsPullRefreshing] = useState(false);
  const [bestMatchesOnly, setBestMatchesOnly] = useState(false);
  const [radarOpen, setRadarOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [connectionTarget, setConnectionTarget] = useState<DiscoveryUser | null>(null);

  const debouncedSearch = useDebounce(searchInput, 350);

  const queryFilters = useMemo<DiscoveryFilters>(
    () => ({
      ...appliedFilters,
      search: debouncedSearch.trim() || undefined,
      matchType: bestMatchesOnly ? "MUTUAL" : undefined,
    }),
    [appliedFilters, debouncedSearch, bestMatchesOnly],
  );

  const discovery = useDiscovery(queryFilters);
  const languagesQuery = useLanguages();
  const languageCatalog = useMemo(
    () => languagesQuery.data ?? EMPTY_LANGUAGE_CATALOG,
    [languagesQuery.data],
  );
  const profile = useProfile();
  const connectionRequest = useRequestConnection();
  const colors = useColors();
  const activeFilterCount = countActiveFilters(appliedFilters);
  const hasAnyQuery = activeFilterCount > 0 || Boolean(queryFilters.search) || bestMatchesOnly;

  // Active language filters shown as removable chips under the tabs.
  const languageChips = (["learningLanguage", "spokenLanguage"] as const).flatMap((key) => {
    const id = appliedFilters[key];
    const entry = id ? findCatalogLanguage(languageCatalog, id) : undefined;
    return entry
      ? [
          {
            key,
            label: `${languageFlag(entry)} ${entry.name}`,
            clear: () => setAppliedFilters((prev) => ({ ...prev, [key]: undefined })),
          },
        ]
      : [];
  });

  const users = useMemo(
    () => discovery.data?.pages.flatMap((page) => page.items) ?? [],
    [discovery.data],
  );

  const tabBarPadding = useFloatingTabBarPadding();
  const practiceLanguages = usePracticeLanguages();

  const startFlashQuest = useCallback(() => {
    const language = practiceLanguages[0];
    if (!language) {
      Alert.alert("Add a language", "Add a language you’re learning to start a Flash Quest.", [
        { text: "Not now", style: "cancel" },
        { text: "Add language", onPress: () => navigation.navigate("LanguagePreferences") },
      ]);
      return;
    }
    navigation.navigate("FlashQuest", { languageId: language.id, languageName: language.name });
  }, [navigation, practiceLanguages]);

  const openChat = useCallback(
    (conversationId: string) => navigation.navigate("Conversation", { conversationId }),
    [navigation],
  );
  const showSkeleton = discovery.isPending && !discovery.data;

  const openPublicProfile = useCallback(
    (userId: string) => {
      navigation.navigate("PublicProfile", { userId });
    },
    [navigation],
  );

  const submitConnectionRequest = useCallback(
    (introMessage?: string) => {
      if (!connectionTarget) return;
      const user = connectionTarget;
      connectionRequest.mutate(
        { userId: user.id, introMessage },
        {
          onSuccess: (connection) => {
            setConnectionTarget(null);
            Alert.alert(
              connection.status === "ACCEPTED" ? "You’re connected" : "Request sent",
              connection.status === "ACCEPTED"
                ? `You and ${user.displayName} can now chat and call.`
                : `We’ll let you know when ${user.displayName} accepts your request.`,
            );
          },
          onError: () => Alert.alert("Could not send request", "Please try again."),
        },
      );
    },
    [connectionRequest, connectionTarget],
  );

  const { refresh, fetchNextPage, hasNextPage, isFetchingNextPage } = discovery;

  const onRefresh = useCallback(async () => {
    setIsPullRefreshing(true);
    try {
      await refresh();
    } finally {
      setIsPullRefreshing(false);
    }
  }, [refresh]);

  // Answering today's icebreaker: bring its field to the top of the list, above the keyboard.
  // While typing, a spacer under the list makes that scroll possible even with few partners.
  const listRef = useRef<FlashListRef<DiscoveryUser>>(null);
  const [composerFocused, setComposerFocused] = useState(false);
  const onComposerFocus = useCallback((offsetY: number) => {
    setComposerFocused(true);
    setTimeout(() => {
      listRef.current?.scrollToOffset({
        offset: Math.max(0, offsetY - spacing.sm),
        animated: true,
      });
    }, 50);
  }, []);
  const onComposerBlur = useCallback(() => setComposerFocused(false), []);
  const icebreaker = useMemo(
    () => <IcebreakerCard onComposerFocus={onComposerFocus} onComposerBlur={onComposerBlur} />,
    [onComposerFocus, onComposerBlur],
  );

  const loadNextPage = useCallback(() => {
    if (users.length === 0 || isPullRefreshing) {
      return;
    }
    if (hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage, isPullRefreshing, users.length]);

  const renderItem = useCallback(
    ({ item }: { item: DiscoveryUser }) => (
      <UserCard
        user={item}
        languageCatalog={languageCatalog}
        busy={connectionRequest.isPending && connectionRequest.variables?.userId === item.id}
        onPress={openPublicProfile}
        onConnect={setConnectionTarget}
      />
    ),
    [
      connectionRequest.isPending,
      connectionRequest.variables?.userId,
      languageCatalog,
      openPublicProfile,
    ],
  );

  const iconButton = [
    styles.iconButton,
    { backgroundColor: colors.card, borderColor: colors.cardBorder },
  ];

  return (
    <Screen>
      <View style={styles.topBar}>
        <Pressable
          onPress={() => navigation.navigate("Profile")}
          accessibilityRole="button"
          accessibilityLabel="Open your profile"
        >
          <Avatar
            uri={profile.data?.avatarUrl ?? profile.data?.profileImageUrl ?? profile.data?.photoUrl}
            name={profile.data?.displayName}
            size={40}
            square
          />
        </Pressable>
        {profile.data?.settings.discoverable === false ? (
          <Pressable
            onPress={() => navigation.navigate("Profile")}
            style={[styles.hiddenPill, { backgroundColor: colors.card }]}
            accessibilityRole="button"
            accessibilityLabel="You're hidden from Community. Open profile to change."
          >
            <Ionicons name="eye-off-outline" size={18} color={colors.text} />
            <Text style={[styles.hiddenText, { color: colors.text }]}>YOU’RE HIDDEN</Text>
          </Pressable>
        ) : null}
        <View style={styles.topIcons}>
          <StreakBadge />
          <Pressable
            onPress={startFlashQuest}
            hitSlop={4}
            style={({ pressed }) => [iconButton, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Start a 3-minute Flash Quest"
          >
            <Ionicons name="flash" size={20} color={colors.accent} />
          </Pressable>
          <Pressable
            onPress={() => {
              setSearching((open) => !open);
              setSearchInput("");
            }}
            hitSlop={4}
            style={({ pressed }) => [
              iconButton,
              searching && { backgroundColor: colors.accentSoft },
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Search partners"
            accessibilityState={{ expanded: searching }}
          >
            <Ionicons
              name={searching ? "close" : "search-outline"}
              size={20}
              color={searching ? colors.accent : colors.text}
            />
          </Pressable>
          <Pressable
            onPress={() => setFiltersOpen(true)}
            hitSlop={4}
            style={({ pressed }) => [iconButton, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={
              activeFilterCount > 0 ? `Filters, ${activeFilterCount} active` : "Filters"
            }
          >
            <Ionicons name="options-outline" size={20} color={colors.text} />
            {activeFilterCount > 0 ? (
              <View
                style={[
                  styles.filterDot,
                  { backgroundColor: colors.accent, borderColor: colors.card },
                ]}
              />
            ) : null}
          </Pressable>
        </View>
      </View>

      {searching ? (
        <View style={styles.searchRow}>
          <SearchField
            value={searchInput}
            onChange={setSearchInput}
            onClear={() => setSearchInput("")}
          />
        </View>
      ) : null}

      <VoiceSparksBar />

      <View style={[styles.tabs, { borderBottomColor: colors.border }]} accessibilityRole="tablist">
        {[
          {
            label: "All",
            active: !bestMatchesOnly && !radarOpen,
            onPress: () => {
              setRadarOpen(false);
              setBestMatchesOnly(false);
            },
          },
          {
            label: "Best matches",
            active: bestMatchesOnly && !radarOpen,
            onPress: () => {
              setRadarOpen(false);
              setBestMatchesOnly(true);
            },
          },
          { label: "● Live radar", active: radarOpen, onPress: () => setRadarOpen(true) },
        ].map((tab) => (
          <Pressable
            key={tab.label}
            onPress={tab.onPress}
            style={[styles.tab, tab.active && { borderBottomColor: colors.text }]}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab.active }}
          >
            <Text style={[styles.tabText, { color: tab.active ? colors.text : colors.muted }]}>
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {radarOpen ? null : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.quickScroll}
          contentContainerStyle={styles.quickChips}
        >
          {languageChips.map((chip) => (
            <Chip
              key={chip.key}
              icon="checkmark"
              label={chip.label}
              selected
              onPress={chip.clear}
              accessibilityLabel={`Remove ${chip.label} filter`}
            />
          ))}
          <Pressable
            onPress={() => setFiltersOpen(true)}
            style={styles.addLanguage}
            accessibilityRole="button"
            accessibilityLabel="Add a language filter"
          >
            <Ionicons name="add" size={22} color={colors.accent} />
            <Text style={[styles.addLanguageText, { color: colors.accent }]}>Add language</Text>
          </Pressable>
        </ScrollView>
      )}

      <View style={styles.stage}>
        {radarOpen ? (
          <View style={styles.radarStage}>
            <RadarView
              bottomPadding={tabBarPadding}
              onOpenProfile={openPublicProfile}
              onOpenChat={openChat}
              onStartQuest={startFlashQuest}
            />
          </View>
        ) : showSkeleton ? (
          <Animated.View
            key="discovery-loading"
            exiting={FadeOut.duration(280)}
            style={styles.stage}
          >
            <DiscoveryLoadingView />
          </Animated.View>
        ) : discovery.isError && users.length === 0 ? (
          <View style={styles.centered}>
            <Text style={[styles.error, { color: colors.rose }]}>Could not load partners.</Text>
            <Pressable
              onPress={() => void discovery.refresh()}
              style={styles.retry}
              accessibilityRole="button"
            >
              <Text style={[styles.retryText, { color: colors.accent }]}>Retry</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.list}>
            <FlashList
              ref={listRef}
              showsVerticalScrollIndicator={false}
              style={styles.list}
              data={users}
              keyExtractor={(item) => item.id}
              keyboardDismissMode="on-drag"
              keyboardShouldPersistTaps="handled"
              renderItem={renderItem}
              ListHeaderComponent={icebreaker}
              ListEmptyComponent={
                <DiscoveryEmptyState
                  hasFilters={hasAnyQuery}
                  onClearFilters={() => {
                    setSearchInput("");
                    setAppliedFilters({});
                    setBestMatchesOnly(false);
                  }}
                />
              }
              onEndReached={loadNextPage}
              onEndReachedThreshold={0.5}
              alwaysBounceVertical
              refreshControl={
                <AppRefreshControl
                  refreshing={isPullRefreshing}
                  onRefresh={() => void onRefresh()}
                />
              }
              contentContainerStyle={[styles.listContent, { paddingBottom: tabBarPadding }]}
              ListFooterComponent={
                <>
                  {discovery.isFetchingNextPage ? (
                    <ActivityIndicator
                      color={colors.accent}
                      style={styles.footerSpinner}
                      accessibilityLabel="Loading more partners"
                    />
                  ) : null}
                  {composerFocused ? <View style={styles.keyboardSpacer} /> : null}
                </>
              }
            />
          </View>
        )}
      </View>

      <FilterBottomSheet
        visible={filtersOpen}
        value={appliedFilters}
        onClose={() => setFiltersOpen(false)}
        onApply={(next) => {
          setAppliedFilters({
            spokenLanguage: next.spokenLanguage,
            learningLanguage: next.learningLanguage,
            country: next.country,
            proficiency: next.proficiency,
          });
          setFiltersOpen(false);
        }}
      />
      <ConnectionRequestSheet
        visible={Boolean(connectionTarget)}
        userName={connectionTarget?.displayName ?? ""}
        busy={connectionRequest.isPending}
        onClose={() => setConnectionTarget(null)}
        onSubmit={submitConnectionRequest}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: 44,
    marginBottom: spacing.sm,
  },
  hiddenPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  hiddenText: { fontSize: 13, fontWeight: "700", letterSpacing: 0.4 },
  topIcons: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: spacing.sm,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: { opacity: 0.6 },
  filterDot: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
  },
  searchRow: { flexDirection: "row", marginBottom: spacing.sm },
  tabs: { flexDirection: "row", borderBottomWidth: StyleSheet.hairlineWidth },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabText: { fontSize: 15, fontWeight: "600" },
  addLanguage: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 8 },
  addLanguageText: { fontSize: 16, fontWeight: "600" },
  quickScroll: {
    flexGrow: 0,
    flexShrink: 0,
    marginVertical: spacing.md,
  },
  quickChips: {
    gap: 8,
    paddingRight: spacing.md,
  },
  list: {
    flex: 1,
  },
  stage: {
    flex: 1,
  },
  radarStage: {
    flex: 1,
    marginTop: spacing.md,
  },
  listContent: {
    flexGrow: 1,
  },
  keyboardSpacer: {
    height: 420,
  },
  centered: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  error: {
    fontWeight: "700",
  },
  retry: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 44,
    justifyContent: "center",
  },
  retryText: {
    fontWeight: "700",
  },
  footerSpinner: {
    marginVertical: spacing.md,
  },
});
