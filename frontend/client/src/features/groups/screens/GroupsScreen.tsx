import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, ScrollView, StyleSheet, Text, View } from "react-native";

import { useProfile } from "@/features/profile";
import { useFloatingTabBarPadding } from "@/navigation/floatingTabBar";
import type { AppStackParamList } from "@/navigation/types";
import { Avatar } from "@/shared/components/Avatar";
import { Chip } from "@/shared/components/Chip";
import { PressableScale } from "@/shared/components/PressableScale";
import { AppRefreshControl } from "@/shared/components/AppRefreshControl";
import { Screen } from "@/shared/components/Screen";
import { Skeleton } from "@/shared/components/Skeleton";
import { WarmEmptyState } from "@/shared/components/WarmEmptyState";
import { WarmErrorState } from "@/shared/components/WarmErrorState";
import { useColors } from "@/shared/theme";
import { spacing } from "@/shared/theme/spacing";

import { GroupCard } from "../components/GroupCard";
import { useGroupList } from "../hooks/useGroups";
import type { GroupFilters, GroupSummary } from "../types";

const MINE: GroupFilters = { scope: "mine" };

export function GroupsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const colors = useColors();
  const tabBarPadding = useFloatingTabBarPadding();
  const profile = useProfile();

  const [languageId, setLanguageId] = useState<string | undefined>();
  const discoverFilters = useMemo<GroupFilters>(
    () => ({ scope: "discover", languageId }),
    [languageId],
  );
  const discover = useGroupList(discoverFilters);
  const mine = useGroupList(MINE);

  // Offer the viewer's own languages as one-tap filters; learning first.
  const myLanguages = useMemo(() => {
    const seen = new Set<string>();
    return [
      ...(profile.data?.learningLanguages ?? []),
      ...(profile.data?.spokenLanguages ?? []),
    ].filter((language) => {
      if (seen.has(language.languageId)) return false;
      seen.add(language.languageId);
      return true;
    });
  }, [profile.data]);

  const openGroup = useCallback(
    (groupId: string) => navigation.navigate("GroupDetail", { groupId }),
    [navigation],
  );
  const renderItem = useCallback(
    ({ item }: { item: GroupSummary }) => <GroupCard group={item} onPress={openGroup} />,
    [openGroup],
  );

  const header = (
    <View>
      {mine.items.length > 0 ? (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Your Clubs</Text>
          <Text style={[styles.sectionSub, { color: colors.muted }]}>
            Check out what’s new in your Clubs
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tiles}
          >
            {mine.items.map((group) => (
              <PressableScale
                key={group.id}
                onPress={() => openGroup(group.id)}
                style={[styles.tile, { backgroundColor: colors.card }]}
                accessibilityRole="button"
                accessibilityLabel={group.name}
              >
                <Text style={[styles.tileName, { color: colors.text }]} numberOfLines={3}>
                  {group.language.flagEmoji} {group.name}
                </Text>
              </PressableScale>
            ))}
          </ScrollView>
        </View>
      ) : null}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Discover Clubs</Text>
        <Text style={[styles.sectionSub, { color: colors.muted }]}>
          Explore great Clubs selected for you
        </Text>
      </View>
    </View>
  );

  return (
    <Screen padded={false}>
      <View style={styles.topBar}>
        <Avatar
          uri={profile.data?.avatarUrl ?? profile.data?.profileImageUrl ?? profile.data?.photoUrl}
          name={profile.data?.displayName}
          size={40}
        />
        <Text style={[styles.title, { color: colors.text }]}>Social</Text>
      </View>

      <View style={[styles.tabs, { borderBottomColor: colors.border }]} accessibilityRole="tablist">
        <View
          style={[styles.tab, { borderBottomColor: colors.text }]}
          accessibilityRole="tab"
          accessibilityState={{ selected: true }}
        >
          <Text style={[styles.tabText, { color: colors.text }]}>Language Clubs</Text>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
        style={styles.chipScroll}
      >
        <Chip label="All" selected={!languageId} onPress={() => setLanguageId(undefined)} />
        {myLanguages.map((language) => (
          <Chip
            key={language.languageId}
            label={`${language.flagEmoji ?? ""} ${language.name}`.trim()}
            selected={languageId === language.languageId}
            onPress={() =>
              setLanguageId(languageId === language.languageId ? undefined : language.languageId)
            }
          />
        ))}
      </ScrollView>

      {discover.isPending ? (
        <View
          style={styles.skeletons}
          accessibilityLabel="Loading clubs"
          accessibilityRole="progressbar"
        >
          <Skeleton height={20} width="40%" />
          {[0, 1, 2].map((key) => (
            <Skeleton key={key} height={160} radius={16} />
          ))}
        </View>
      ) : discover.isError && discover.items.length === 0 ? (
        <WarmErrorState
          title="Could not load clubs"
          body="Check your connection and try again."
          onAction={() => void discover.refetch()}
        />
      ) : (
        <FlatList
          showsVerticalScrollIndicator={false}
          data={discover.items}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          ListHeaderComponent={header}
          contentContainerStyle={[styles.list, { paddingBottom: tabBarPadding + 72 }]}
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (discover.hasNextPage && !discover.isFetchingNextPage) void discover.fetchNextPage();
          }}
          refreshControl={
            <AppRefreshControl
              refreshing={discover.isRefetching && !discover.isFetchingNextPage}
              onRefresh={() => {
                void discover.refetch();
                void mine.refetch();
              }}
            />
          }
          ListEmptyComponent={
            <WarmEmptyState
              title="No clubs yet"
              body="Be the first — start a club for your language."
              action={
                <Chip
                  label="Create a club"
                  selected
                  onPress={() => navigation.navigate("CreateGroup")}
                />
              }
            />
          }
          ListFooterComponent={
            discover.isFetchingNextPage ? (
              <ActivityIndicator color={colors.accent} style={styles.loading} />
            ) : null
          }
        />
      )}

      <PressableScale
        onPress={() => navigation.navigate("CreateGroup")}
        style={[styles.fab, { backgroundColor: colors.accent, bottom: tabBarPadding }]}
        accessibilityRole="button"
        accessibilityLabel="Create a club"
      >
        <Ionicons name="add" size={28} color={colors.onPrimary} />
      </PressableScale>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: 18,
    paddingTop: 8,
  },
  title: { fontSize: 20, fontWeight: "600" },
  tabs: {
    flexDirection: "row",
    marginTop: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tab: { flex: 1, alignItems: "center", paddingVertical: 12, borderBottomWidth: 2 },
  tabText: { fontSize: 14, fontWeight: "600" },
  chipScroll: { flexGrow: 0, flexShrink: 0, marginTop: spacing.md },
  chips: { gap: 8, paddingHorizontal: 18 },
  section: { marginTop: spacing.lg, marginBottom: spacing.sm },
  sectionTitle: { fontSize: 18, fontWeight: "700" },
  sectionSub: { fontSize: 14, marginTop: 4, marginBottom: spacing.md },
  tiles: { gap: 10 },
  tile: { width: 120, height: 88, borderRadius: 12, padding: 12, justifyContent: "flex-end" },
  tileName: { fontSize: 14, fontWeight: "600" },
  list: { flexGrow: 1, paddingHorizontal: 18 },
  loading: { marginVertical: spacing.lg },
  skeletons: { gap: 16, paddingHorizontal: 18, paddingTop: spacing.lg },
  fab: {
    position: "absolute",
    right: 18,
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
});
