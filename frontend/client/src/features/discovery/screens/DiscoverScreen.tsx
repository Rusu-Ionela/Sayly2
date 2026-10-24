import { Ionicons } from "@expo/vector-icons";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
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

  const onRefresh = useCallback(async () => {
    setIsPullRefreshing(true);
    try {
      await discovery.refresh();
    } finally {
      setIsPullRefreshing(false);
    }
  }, [discovery.refresh]);

  const loadNextPage = useCallback(() => {
    if (users.length === 0 || isPullRefreshing) {
      return;
    }
    if (discovery.hasNextPage && !discovery.isFetchingNextPage) {
      void discovery.fetchNextPage();
    }
  }, [
    discovery.fetchNextPage,
    discovery.hasNextPage,
    discovery.isFetchingNextPage,
    isPullRefreshing,
    users.length,
  ]);

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
            size={44}
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
          <Pressable
            onPress={() => {
              setSearching((open) => !open);
              setSearchInput("");
            }}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Search partners"
          >
            <Ionicons name="search-outline" size={26} color={colors.muted} />
          </Pressable>
          <Pressable
            onPress={() => setFiltersOpen(true)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={
              activeFilterCount > 0 ? `Filters, ${activeFilterCount} active` : "Filters"
            }
          >
            <Ionicons name="options-outline" size={26} color={colors.muted} />
            {activeFilterCount > 0 ? (
              <View style={[styles.filterDot, { backgroundColor: colors.accent }]} />
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

      <View style={[styles.tabs, { borderBottomColor: colors.border }]} accessibilityRole="tablist">
        {[
          { label: "All", active: !bestMatchesOnly, onPress: () => setBestMatchesOnly(false) },
          {
            label: "Best matches",
            active: bestMatchesOnly,
            onPress: () => setBestMatchesOnly(true),
          },
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

      <View style={styles.stage}>
        {showSkeleton ? (
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
            <FlatList
              showsVerticalScrollIndicator={false}
              style={styles.list}
              data={users}
              keyExtractor={(item) => item.id}
              keyboardDismissMode="on-drag"
              keyboardShouldPersistTaps="handled"
              renderItem={renderItem}
              initialNumToRender={8}
              maxToRenderPerBatch={8}
              windowSize={7}
              removeClippedSubviews={Platform.OS === "android"}
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
                discovery.isFetchingNextPage ? (
                  <ActivityIndicator
                    color={colors.accent}
                    style={styles.footerSpinner}
                    accessibilityLabel="Loading more partners"
                  />
                ) : null
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
  topBar: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.sm },
  hiddenPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  hiddenText: { fontSize: 13, fontWeight: "700", letterSpacing: 0.4 },
  topIcons: { flex: 1, flexDirection: "row", justifyContent: "flex-end", gap: spacing.lg },
  filterDot: { position: "absolute", top: -2, right: -2, width: 9, height: 9, borderRadius: 5 },
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
  listContent: {
    flexGrow: 1,
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
