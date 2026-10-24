import { useMemo, useState } from "react";
import { Alert } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import type { AppStackParamList } from "@/navigation/types";
import { MemberList } from "@/shared/components/MemberList";
import { MemberRow } from "@/shared/components/MemberRow";
import { Screen } from "@/shared/components/Screen";
import { WarmEmptyState } from "@/shared/components/WarmEmptyState";

import type { FollowingPerson } from "../api/followsApi";
import { FollowButton } from "../components/FollowButton";
import { useFollowing, useSetFollow } from "../hooks/useFollows";

/** People you follow, with live status and a follow / following toggle per row. */
export function FollowingScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const query = useFollowing();
  const setFollow = useSetFollow();
  /** Rows unfollowed here keep their place (with "Follow") until the list reloads. */
  const [unfollowed, setUnfollowed] = useState<ReadonlySet<string>>(new Set());

  const items = useMemo(() => query.data?.pages.flatMap((page) => page.items) ?? [], [query.data]);

  const markUnfollowed = (userId: string, isUnfollowed: boolean) =>
    setUnfollowed((current) => {
      const updated = new Set(current);
      if (isUnfollowed) updated.add(userId);
      else updated.delete(userId);
      return updated;
    });

  const toggle = (member: FollowingPerson, follow: boolean) => {
    markUnfollowed(member.id, !follow);
    setFollow.mutate(
      { userId: member.id, follow },
      {
        onError: () => {
          markUnfollowed(member.id, follow);
          Alert.alert(
            follow ? "Could not follow" : "Could not unfollow",
            `Please try again to ${follow ? "follow" : "unfollow"} ${member.displayName}.`,
          );
        },
      },
    );
  };

  const renderItem = (member: FollowingPerson) => (
    <MemberRow
      member={member}
      onPress={() => navigation.navigate("PublicProfile", { userId: member.id })}
      trailing={
        <FollowButton
          following={!unfollowed.has(member.id)}
          name={member.displayName}
          busy={setFollow.isPending && setFollow.variables?.userId === member.id}
          onToggle={(next) => toggle(member, next)}
        />
      }
    />
  );

  return (
    <Screen includeBottomInset>
      <MemberList
        state={query}
        items={items}
        keyOf={(member) => member.id}
        renderItem={renderItem}
        errorTitle="Could not load who you follow"
        empty={
          <WarmEmptyState
            title="You're not following anyone yet"
            body="Follow members from their profile to keep up with them here."
          />
        }
      />
    </Screen>
  );
}
