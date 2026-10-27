import type { LeaderboardEntryDto } from "@sayly/shared";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import type { AppStackParamList } from "@/navigation/types";
import { AppRefreshControl } from "@/shared/components/AppRefreshControl";
import { Button } from "@/shared/components/Button";
import { Screen } from "@/shared/components/Screen";
import { SectionCard } from "@/shared/components/SectionCard";
import { WarmErrorState } from "@/shared/components/WarmErrorState";
import { WarmLoadingView } from "@/shared/components/WarmLoadingView";
import { useColors } from "@/shared/theme";
import { spacing } from "@/shared/theme/spacing";

import { LeaderboardRow } from "../components/LeaderboardRow";
import { Podium } from "../components/Podium";
import { RewardBanner } from "../components/RewardBanner";
import { useFriendsLeaderboard } from "../hooks";
import { splitPodium } from "../model";

type Nav = NativeStackNavigationProp<AppStackParamList>;

/** You and your language partners, ranked by daily streak, with the weekly Pro prize. */
export function FriendsLeaderboardScreen() {
  const navigation = useNavigation<Nav>();
  const colors = useColors();
  const query = useFriendsLeaderboard();

  if (query.isPending) {
    return (
      <Screen includeBottomInset>
        <WarmLoadingView />
      </Screen>
    );
  }
  if (query.isError || !query.data) {
    return (
      <Screen includeBottomInset>
        <WarmErrorState
          title="Could not load the leaderboard"
          body="Check your connection and try again."
          onAction={() => void query.refetch()}
        />
      </Screen>
    );
  }

  const { entries, weekEndsAt, rewardProUntil } = query.data;
  const { podium, rest } = splitPodium(entries);
  const hasFriends = entries.some((entry) => !entry.isMe);

  const openMember = (entry: LeaderboardEntryDto) => {
    if (!entry.isMe) navigation.navigate("PublicProfile", { userId: entry.userId });
  };

  return (
    <Screen includeBottomInset>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <AppRefreshControl
            refreshing={query.isRefetching}
            onRefresh={() => void query.refetch()}
          />
        }
      >
        <RewardBanner weekEndsAt={weekEndsAt} rewardProUntil={rewardProUntil} />

        <SectionCard title="This week's top 3" variant="content">
          <Podium entries={podium} onPressMember={openMember} />
        </SectionCard>

        {rest.length ? (
          <SectionCard title="Everyone else" variant="content">
            {rest.map((entry) => (
              <LeaderboardRow key={entry.userId} entry={entry} onPress={() => openMember(entry)} />
            ))}
          </SectionCard>
        ) : null}

        {!hasFriends ? (
          <SectionCard variant="content">
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              Race your language partners
            </Text>
            <Text style={[styles.emptyBody, { color: colors.muted }]}>
              Connect with members in the Community. Your accepted connections show up here, ranked
              by their daily streak.
            </Text>
            <View style={styles.emptyAction}>
              <Button
                label="Find partners"
                onPress={() => navigation.navigate("MainTabs", { screen: "Community" })}
              />
            </View>
          </SectionCard>
        ) : null}

        <Text style={[styles.footnote, { color: colors.muted }]}>
          Streaks count the days in a row you open a chat, send a message or answer the icebreaker.
          Ties for first place all win.
        </Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  // SectionCard brings its own top margin.
  content: {
    paddingBottom: spacing.xl,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "800",
  },
  emptyBody: {
    fontSize: 15,
    lineHeight: 21,
  },
  emptyAction: {
    alignSelf: "flex-start",
  },
  footnote: {
    marginTop: spacing.lg,
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
    paddingHorizontal: spacing.md,
  },
});
