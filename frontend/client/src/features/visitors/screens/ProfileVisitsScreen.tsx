import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { showProInfo } from "@/features/subscription";
import type { AppStackParamList } from "@/navigation/types";
import { MemberList } from "@/shared/components/MemberList";
import { MemberRow } from "@/shared/components/MemberRow";
import { Screen } from "@/shared/components/Screen";
import { WarmEmptyState } from "@/shared/components/WarmEmptyState";
import { useColors } from "@/shared/theme";
import { spacing } from "@/shared/theme/spacing";
import { relativeTime } from "@/shared/utils/relativeTime";

import type { ProfileVisit, VisitsMode } from "../api/visitorsApi";
import { ProLockedCard } from "../components/ProLockedCard";
import { useProfileVisits } from "../hooks/useProfileVisits";

const COPY: Record<
  VisitsMode,
  {
    locked: (total: number, fresh: number) => { headline: string; body: string };
    summary: (total: number, fresh: number) => string;
    caption: string;
    empty: { title: string; body: string };
    error: string;
  }
> = {
  visitors: {
    locked: (total, fresh) => ({
      headline:
        fresh > 0
          ? `${fresh} new ${fresh === 1 ? "visitor" : "visitors"} to your profile`
          : `${total} ${total === 1 ? "visitor" : "visitors"} to your profile`,
      body: "See who checked out your profile and say hello first. Visitors are part of Sayly Pro.",
    }),
    summary: (total, fresh) =>
      fresh > 0 ? `${fresh} new · ${total} in total` : `${total} in total`,
    caption: "Visited",
    empty: {
      title: "No visitors yet",
      body: "A complete profile with a photo and topics gets more visits.",
    },
    error: "Could not load your visitors",
  },
  viewed: {
    locked: (total) => ({
      headline: `You viewed ${total} ${total === 1 ? "profile" : "profiles"}`,
      body: "Find the people you looked at again, any time. Viewed profiles are part of Sayly Pro.",
    }),
    summary: (total) => `${total} in total`,
    caption: "Viewed",
    empty: {
      title: "No viewed profiles yet",
      body: "Profiles you open from the Community appear here.",
    },
    error: "Could not load viewed profiles",
  },
};

/** Visitors ("who viewed me") and Viewed profiles ("who I viewed") — Pro lists. */
export function ProfileVisitsScreen() {
  const colors = useColors();
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const { mode } = useRoute<RouteProp<AppStackParamList, "ProfileVisits">>().params;
  const query = useProfileVisits(mode);
  const copy = COPY[mode];

  const first = query.data?.pages[0];
  const items = useMemo(() => query.data?.pages.flatMap((page) => page.items) ?? [], [query.data]);

  if (first?.locked) {
    const { headline, body } = copy.locked(first.total, first.newCount);
    return (
      <Screen includeBottomInset>
        <ProLockedCard headline={headline} body={body} onUpgrade={() => showProInfo(false)} />
      </Screen>
    );
  }

  const renderItem = (visit: ProfileVisit) => (
    <MemberRow
      member={visit.member}
      highlighted={visit.isNew}
      caption={`${copy.caption} ${relativeTime(visit.viewedAt)}`}
      onPress={() => navigation.navigate("PublicProfile", { userId: visit.member.id })}
      trailing={
        visit.isNew ? (
          <View
            style={[styles.newDot, { backgroundColor: colors.accent }]}
            accessibilityLabel="New"
          />
        ) : undefined
      }
    />
  );

  return (
    <Screen includeBottomInset>
      <MemberList
        state={query}
        items={items}
        keyOf={(visit) => visit.member.id}
        renderItem={renderItem}
        errorTitle={copy.error}
        header={
          first && first.total > 0 ? (
            <Text style={[styles.summary, { color: colors.muted }]}>
              {copy.summary(first.total, first.newCount)}
            </Text>
          ) : null
        }
        empty={<WarmEmptyState title={copy.empty.title} body={copy.empty.body} />}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  summary: {
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: spacing.xs,
  },
  newDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});
