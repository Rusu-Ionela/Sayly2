import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from "react-native";

import { useAuth } from "@/features/auth";
import { confirmAction } from "@/shared/utils/confirmAction";
import { formatProficiencyLabel } from "@/features/languages/model/proficiency";
import { isApiError } from "@/lib/api/errors";
import type { AppStackParamList } from "@/navigation/types";
import { Avatar } from "@/shared/components/Avatar";
import { Chip } from "@/shared/components/Chip";
import { PressableScale } from "@/shared/components/PressableScale";
import { Screen } from "@/shared/components/Screen";
import { WarmErrorState } from "@/shared/components/WarmErrorState";
import { WarmLoadingView } from "@/shared/components/WarmLoadingView";
import { useColors } from "@/shared/theme";
import { radius } from "@/shared/theme/radius";
import { spacing } from "@/shared/theme/spacing";
import { getTypography } from "@/shared/theme/typography";

import { PartyRoomCard } from "@/features/partyRooms/components/PartyRoomCard";
import { usePartyRooms } from "@/features/partyRooms/hooks/usePartyRooms";

import { PostCard } from "../components/PostCard";
import { useGroupFeed, usePostReaction } from "../hooks/useGroupFeed";
import { useDeleteGroup, useGroup, useGroupActions, useGroupMembers } from "../hooks/useGroups";
import { groupPrimaryAction, isGroupModerator, isGroupOwner, roleLabel } from "../model/groupModel";
import type { GroupMember } from "../types";

function showError(error: unknown) {
  Alert.alert("Something went wrong", isApiError(error) ? error.message : "Please try again.");
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const colors = useColors();
  const type = getTypography(colors);
  return (
    <View
      style={[styles.section, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
    >
      <Text style={type.sectionLabel}>{title}</Text>
      {children}
    </View>
  );
}

function TextAction({
  label,
  onPress,
  danger,
  disabled,
}: {
  label: string;
  onPress: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  const colors = useColors();
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      style={styles.textAction}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text style={[styles.textActionLabel, { color: danger ? colors.error : colors.accent }]}>
        {label}
      </Text>
    </PressableScale>
  );
}

function MemberRow({
  member,
  trailing,
  onPress,
}: {
  member: GroupMember;
  trailing?: React.ReactNode;
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <View style={styles.memberRow}>
      <PressableScale
        onPress={onPress}
        style={styles.memberMain}
        accessibilityRole="button"
        accessibilityLabel={`${member.displayName}, ${roleLabel(member.role)}. View profile`}
      >
        <View style={styles.memberInner}>
          <Avatar uri={member.avatarUrl} name={member.displayName} size={40} />
          <View style={styles.memberCopy}>
            <Text style={[styles.memberName, { color: colors.text }]} numberOfLines={1}>
              {member.displayName}
            </Text>
            <Text style={[styles.memberMeta, { color: colors.muted }]}>
              {roleLabel(member.role)}
            </Text>
          </View>
        </View>
      </PressableScale>
      {trailing ? <View style={styles.memberActions}>{trailing}</View> : null}
    </View>
  );
}

export function GroupDetailScreen() {
  const route = useRoute<RouteProp<AppStackParamList, "GroupDetail">>();
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const colors = useColors();
  const type = getTypography(colors);
  const { userId } = useAuth();
  const groupId = route.params.groupId;

  const groupQuery = useGroup(groupId);
  const group = groupQuery.data;
  const viewer = group?.viewer ?? null;
  const isMember = viewer?.status === "ACTIVE";
  const moderator = isGroupModerator(viewer);
  const owner = isGroupOwner(viewer);
  const members = useGroupMembers(groupId, "ACTIVE", isMember);
  const requests = useGroupMembers(groupId, "PENDING", moderator);
  const actions = useGroupActions(groupId);
  const deleteGroup = useDeleteGroup();
  const feed = useGroupFeed(groupId, isMember);
  const react = usePostReaction(groupId);
  const groupRooms = usePartyRooms({ groupId }, isMember);
  const [membersExpanded, setMembersExpanded] = useState(false);

  useEffect(() => {
    if (group) navigation.setOptions({ title: group.name });
  }, [group, navigation]);

  if (groupQuery.isPending) {
    return <WarmLoadingView status="Loading group..." accessibilityLabel="Loading group" />;
  }
  if (!group) {
    const gone = isApiError(groupQuery.error) && groupQuery.error.status === 404;
    return (
      <Screen includeBottomInset>
        <WarmErrorState
          title={gone ? "This group no longer exists" : "Could not load this group"}
          body={
            gone ? "It may have been deleted by its owner." : "Check your connection and try again."
          }
          actionLabel={gone ? "Back to groups" : "Try again"}
          onAction={() => (gone ? navigation.goBack() : void groupQuery.refetch())}
        />
      </Screen>
    );
  }

  const primary = groupPrimaryAction(group);
  const busy = actions.join.isPending || actions.leave.isPending;
  const openProfile = (memberId: string) => {
    if (memberId !== userId) navigation.navigate("PublicProfile", { userId: memberId });
  };

  const onPrimary = () => {
    if (primary.kind === "open") navigation.navigate("GroupChat", { groupId });
    else if (primary.kind === "join" || primary.kind === "request")
      actions.join.mutate(undefined, { onError: showError });
    else if (primary.kind === "pending")
      confirmAction({
        title: "Withdraw request",
        message: "Withdraw your request to join this group?",
        confirmLabel: "Withdraw",
        onConfirm: () => actions.leave.mutate(undefined, { onError: showError }),
      });
  };

  const visibleMembers = membersExpanded ? (members.data ?? []) : (members.data ?? []).slice(0, 8);

  return (
    <Screen includeBottomInset>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <View style={[styles.flagTile, { backgroundColor: colors.accentSoft }]}>
            <Text style={styles.flag}>{group.language.flagEmoji || "🌐"}</Text>
          </View>
          <Text style={[type.cardTitle, styles.center]}>{group.name}</Text>
          <Text style={[styles.heroMeta, { color: colors.muted }]}>
            {group.language.name} · {group.memberCount}/{group.maxMembers} members
          </Text>
          <View style={[styles.tags, styles.centerRow]}>
            <Chip
              tone="soft"
              icon={group.visibility === "PRIVATE" ? "lock-closed" : "earth"}
              label={group.visibility === "PRIVATE" ? "Private" : "Public"}
            />
            <Chip
              tone="soft"
              label={group.level ? formatProficiencyLabel(group.level) : "All levels"}
            />
            {group.topic ? <Chip tone="soft" label={group.topic} /> : null}
            {viewer?.status === "ACTIVE" ? (
              <Chip tone="soft" icon="person" label={roleLabel(viewer.role)} />
            ) : null}
          </View>
        </View>

        <PressableScale
          onPress={onPrimary}
          disabled={busy || primary.kind === "full"}
          style={[
            styles.primary,
            {
              backgroundColor:
                primary.kind === "pending" || primary.kind === "full"
                  ? colors.accentSoft
                  : colors.accent,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel={
            primary.kind === "pending" ? "Request pending. Withdraw request" : primary.label
          }
        >
          {busy ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <View style={styles.primaryRow}>
              {primary.kind === "open" && group.unreadCount > 0 ? (
                <View style={[styles.badge, { backgroundColor: colors.onPrimary }]}>
                  <Text style={[styles.badgeText, { color: colors.accent }]}>
                    {group.unreadCount}
                  </Text>
                </View>
              ) : null}
              <Text
                style={[
                  styles.primaryText,
                  {
                    color:
                      primary.kind === "pending" || primary.kind === "full"
                        ? colors.accent
                        : colors.onPrimary,
                  },
                ]}
              >
                {primary.label}
              </Text>
            </View>
          )}
        </PressableScale>
        {primary.kind === "request" ? (
          <Text style={[styles.note, { color: colors.muted }]}>
            A moderator reviews requests. You’ll see the discussion once approved.
          </Text>
        ) : null}

        {isMember ? (
          <Section title="Live rooms">
            {(groupRooms.data ?? []).map((room) => (
              <PartyRoomCard
                key={room.id}
                room={room}
                onOpen={() => navigation.navigate("PartyRoom", { roomId: room.id })}
              />
            ))}
            {groupRooms.data?.length === 0 ? (
              <Text style={[styles.audience, { color: colors.muted }]}>
                No room is live. Start one and practise speaking together.
              </Text>
            ) : null}
            <TextAction
              label="Start a room"
              onPress={() =>
                navigation.navigate("CreatePartyRoom", {
                  group: {
                    id: group.id,
                    name: group.name,
                    languageId: group.language.id,
                    languageLabel: `${group.language.flagEmoji} ${group.language.name}`.trim(),
                  },
                })
              }
            />
          </Section>
        ) : null}

        {isMember ? (
          <Section title="Community feed">
            {feed.posts.slice(0, 2).map((post) => (
              <PostCard
                key={post.clientId ?? post.id}
                post={post}
                onReact={react}
                onOpen={(item) => navigation.navigate("GroupPost", { groupId, postId: item.id })}
              />
            ))}
            {!feed.isPending && feed.posts.length === 0 ? (
              <Text style={[styles.audience, { color: colors.muted }]}>
                No posts yet. Share a thought or ask the group a question.
              </Text>
            ) : null}
            <TextAction
              label={feed.posts.length > 0 ? "Open feed" : "Write the first post"}
              onPress={() => navigation.navigate("GroupFeed", { groupId })}
            />
          </Section>
        ) : null}

        {group.description || group.audience ? (
          <Section title="About">
            {group.description ? <Text style={[type.body]}>{group.description}</Text> : null}
            {group.audience ? (
              <View style={styles.inlineRow}>
                <Ionicons name="people-outline" size={16} color={colors.muted} />
                <Text style={[styles.audience, { color: colors.muted }]}>For {group.audience}</Text>
              </View>
            ) : null}
          </Section>
        ) : null}

        <Section title="Rules & moderation">
          <Text style={type.body}>
            {group.rules ||
              "Be respectful and help each other learn. Moderators can remove members who break the rules."}
          </Text>
          <Text style={[styles.audience, { color: colors.muted }]}>
            Owner: {group.owner.displayName}
            {group.moderators.length
              ? ` · Moderators: ${group.moderators.map((m) => m.displayName).join(", ")}`
              : ""}
          </Text>
        </Section>

        {moderator && (requests.data?.length ?? 0) > 0 ? (
          <Section title={`Join requests (${requests.data!.length})`}>
            {requests.data!.map((request) => (
              <MemberRow
                key={request.id}
                member={request}
                onPress={() => openProfile(request.id)}
                trailing={
                  <>
                    <TextAction
                      label="Approve"
                      disabled={actions.approve.isPending}
                      onPress={() => actions.approve.mutate(request.id, { onError: showError })}
                    />
                    <TextAction
                      label="Decline"
                      danger
                      disabled={actions.remove.isPending}
                      onPress={() => actions.remove.mutate(request.id, { onError: showError })}
                    />
                  </>
                }
              />
            ))}
          </Section>
        ) : null}

        {isMember ? (
          <Section title={`Members (${group.memberCount})`}>
            {members.isPending ? (
              <ActivityIndicator color={colors.accent} />
            ) : members.isError ? (
              <TextAction
                label="Could not load members — retry"
                onPress={() => void members.refetch()}
              />
            ) : (
              visibleMembers.map((member) => {
                const self = member.id === userId;
                const canRemove =
                  !self &&
                  member.role !== "OWNER" &&
                  (owner || (moderator && member.role === "MEMBER"));
                return (
                  <MemberRow
                    key={member.id}
                    member={member}
                    onPress={() => openProfile(member.id)}
                    trailing={
                      self ? null : (
                        <>
                          {owner && member.role !== "OWNER" ? (
                            <TextAction
                              label={member.role === "MODERATOR" ? "Demote" : "Make mod"}
                              onPress={() =>
                                actions.changeRole.mutate(
                                  {
                                    userId: member.id,
                                    role: member.role === "MODERATOR" ? "MEMBER" : "MODERATOR",
                                  },
                                  { onError: showError },
                                )
                              }
                            />
                          ) : null}
                          {owner && member.role !== "OWNER" ? (
                            <TextAction
                              label="Make owner"
                              onPress={() =>
                                confirmAction({
                                  title: "Transfer ownership",
                                  message: `Make ${member.displayName} the owner? You'll become a moderator.`,
                                  confirmLabel: "Transfer",
                                  onConfirm: () =>
                                    actions.transfer.mutate(member.id, { onError: showError }),
                                })
                              }
                            />
                          ) : null}
                          {canRemove ? (
                            <TextAction
                              label="Remove"
                              danger
                              onPress={() =>
                                confirmAction({
                                  title: "Remove member",
                                  message: `Remove ${member.displayName} from the group?`,
                                  confirmLabel: "Remove",
                                  onConfirm: () =>
                                    actions.remove.mutate(member.id, { onError: showError }),
                                })
                              }
                            />
                          ) : null}
                        </>
                      )
                    }
                  />
                );
              })
            )}
            {(members.data?.length ?? 0) > 8 ? (
              <TextAction
                label={membersExpanded ? "Show fewer" : `Show all ${members.data!.length}`}
                onPress={() => setMembersExpanded((value) => !value)}
              />
            ) : null}
          </Section>
        ) : (
          <Section title="Members">
            <Text style={[styles.audience, { color: colors.muted }]}>
              {group.memberCount} {group.memberCount === 1 ? "person has" : "people have"} joined.
              The member list is visible to members.
            </Text>
          </Section>
        )}

        {isMember && !owner ? (
          <TextAction
            label="Leave group"
            danger
            onPress={() =>
              confirmAction({
                title: "Leave group",
                message:
                  group.visibility === "PRIVATE"
                    ? "You'll need approval to rejoin."
                    : "You can rejoin any time.",
                confirmLabel: "Leave",
                onConfirm: () => actions.leave.mutate(undefined, { onError: showError }),
              })
            }
          />
        ) : null}
        {owner ? (
          <>
            <Text style={[styles.note, { color: colors.muted }]}>
              As the owner, transfer ownership before leaving.
            </Text>
            <TextAction
              label="Delete group"
              danger
              disabled={deleteGroup.isPending}
              onPress={() =>
                confirmAction({
                  title: "Delete group",
                  message:
                    "This removes the group and its discussion for everyone. This cannot be undone.",
                  confirmLabel: "Delete",
                  onConfirm: () =>
                    deleteGroup.mutate(groupId, {
                      onSuccess: () => navigation.goBack(),
                      onError: showError,
                    }),
                })
              }
            />
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xl },
  hero: { alignItems: "center", gap: 8, paddingVertical: spacing.sm },
  flagTile: {
    width: 72,
    height: 72,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  flag: { fontSize: 36 },
  center: { textAlign: "center" },
  heroMeta: { fontSize: 14, fontWeight: "600" },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  centerRow: { justifyContent: "center" },
  primary: {
    minHeight: 54,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  primaryText: { fontSize: 16, fontWeight: "700" },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { fontSize: 12, fontWeight: "800" },
  note: { fontSize: 13, fontWeight: "500", textAlign: "center" },
  section: { borderRadius: radius.lg, borderWidth: 1, padding: spacing.md, gap: 10 },
  inlineRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  audience: { fontSize: 13, fontWeight: "500", lineHeight: 18 },
  memberRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  memberMain: { flex: 1, minWidth: 160 },
  memberInner: { flexDirection: "row", alignItems: "center", gap: 10 },
  memberCopy: { flex: 1, minWidth: 0 },
  memberName: { fontSize: 15, fontWeight: "700" },
  memberMeta: { fontSize: 12, fontWeight: "600" },
  memberActions: { flexDirection: "row", gap: 4 },
  textAction: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 8,
    alignSelf: "center",
  },
  textActionLabel: { fontSize: 14, fontWeight: "700" },
});
