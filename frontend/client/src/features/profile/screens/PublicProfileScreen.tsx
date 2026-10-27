import { Ionicons } from "@expo/vector-icons";
import { useCallback, useLayoutEffect, useMemo, useState } from "react";
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { useAuth } from "@/features/auth";
import { useCallUser } from "@/features/calls/hooks/useCallUser";
import { useOpenChat } from "@/features/chat/hooks/useOpenChat";
import { ConnectionRequestSheet, useConnection, useConnectionAction } from "@/features/connections";
import { useToggleFollow } from "@/features/follows";
import { ONBOARDING_QUESTIONS } from "@/features/onboarding/model/onboardingFlow";
import { ReferenceSummaryLine, ReferencesSection } from "@/features/references";
import { BlockReportMenu } from "@/features/safety";
import type { AppStackParamList } from "@/navigation/types";
import { Screen } from "@/shared/components/Screen";
import { SectionCard } from "@/shared/components/SectionCard";
import { useColors } from "@/shared/theme";
import { radius } from "@/shared/theme/radius";
import { spacing } from "@/shared/theme/spacing";
import { getTypography } from "@/shared/theme/typography";
import { PRACTICE_GOALS, TOPICS } from "@sayly/shared";

import { CertificateList } from "../components/CertificateList";
import { LanguageChips } from "../components/LanguageChips";
import { PhotoGallery } from "../components/PhotoGallery";
import { ProfileActionButton } from "../components/ProfileActionButton";
import { LearningPreferencesCard } from "../components/LearningPreferencesCard";
import { ProfileHeader } from "../components/ProfileHeader";
import { ProfileMap } from "../components/ProfileMap";
import { ProfileSkeleton } from "../components/ProfileSkeleton";
import { TagList } from "../components/TagList";
import { TranslatableCard } from "../components/TranslatableCard";
import { useProfile, usePublicProfile } from "../hooks/useProfile";
import { profileAvatarUrl } from "../model/avatar";
import { certificateRows } from "../model/certificates";
import type { CurrentUserProfile, PublicUserProfile } from "../types";

type PublicProfileRoute = RouteProp<AppStackParamList, "PublicProfile" | "UserPreview">;

function mapMeToPublicLayout(me: CurrentUserProfile): PublicUserProfile {
  const avatarUrl = profileAvatarUrl(me) ?? null;
  return {
    id: me.id,
    displayName: me.displayName,
    avatarUrl,
    profileImageUrl: avatarUrl,
    country: me.settings.showLocation ? me.country : "",
    bio: me.bio,
    spokenLanguages: me.spokenLanguages,
    learningLanguages: me.learningLanguages,
    practiceGoals: me.practiceGoals,
    isPro: me.isPro,
    // Preview shows what others see: location only if you share it.
    city: me.settings.showLocation ? me.city : null,
    topics: me.topics,
    photos: me.photos,
    certificates: me.settings.showCertificates ? me.certificates : [],
    mainTopic: me.mainTopic,
    references: me.references,
    learningPreferences: me.learningPreferences,
    profileAnswers: me.profileAnswers ?? [],
    onlineStatus: "UNKNOWN",
    conversationId: null,
    isFollowing: false,
    followerCount: 0,
    location: me.settings.showLocation ? me.location : null,
  };
}

export function PublicProfileScreen() {
  const route = useRoute<PublicProfileRoute>();
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const colors = useColors();
  const type = getTypography(colors);
  const userId = route.params.userId;
  const { user: me } = useAuth();
  const isSelf = Boolean(me?.id && me.id === userId);

  const [safetyOpen, setSafetyOpen] = useState(false);
  const [connectionRequestOpen, setConnectionRequestOpen] = useState(false);
  const { openChat, busyUserId } = useOpenChat();
  const toggleFollow = useToggleFollow(userId);
  const connectionQuery = useConnection(userId, !isSelf);
  const connectionActions = useConnectionAction(userId);
  const { callUser, busy: calling } = useCallUser();

  // Self-preview reads the (optimistically updated) /me cache; others hit PRO-001.
  const meQuery = useProfile();
  const profileQuery = usePublicProfile(userId, { enabled: !isSelf });
  const activeQuery = isSelf ? meQuery : profileQuery;

  const profile = useMemo(() => {
    if (isSelf) {
      return meQuery.data ? mapMeToPublicLayout(meQuery.data) : null;
    }
    return profileQuery.data ?? null;
  }, [isSelf, meQuery.data, profileQuery.data]);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: profile?.displayName || (isSelf ? "Preview" : "Profile"),
    });
  }, [navigation, profile?.displayName, isSelf]);

  const certificates = useMemo(
    () => certificateRows(profile?.certificates ?? []),
    [profile?.certificates],
  );
  const openSafetyMenu = useCallback(() => setSafetyOpen(true), []);
  const closeSafetyMenu = useCallback(() => setSafetyOpen(false), []);
  const goBack = useCallback(() => navigation.goBack(), [navigation]);
  const refetch = activeQuery.refetch;
  const retry = useCallback(() => void refetch(), [refetch]);

  if (activeQuery.isPending) {
    return (
      <Screen includeBottomInset>
        <ProfileSkeleton />
      </Screen>
    );
  }

  if (activeQuery.isError || !profile) {
    return (
      <Screen includeBottomInset>
        <View style={styles.errorWrap}>
          <Text style={type.cardTitle}>Profile unavailable</Text>
          <Text style={[type.body, { color: colors.muted }]}>
            This profile could not be loaded. They may be private, blocked, or no longer active.
          </Text>
          <Pressable
            style={[styles.retry, { backgroundColor: colors.accent }]}
            onPress={retry}
            accessibilityRole="button"
            accessibilityLabel="Try again"
          >
            <Text style={[styles.retryText, { color: colors.onPrimary }]}>Try again</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  const firstName = profile.displayName.trim().split(/\s+/)[0] || "them";
  const callTarget = {
    id: profile.id,
    displayName: profile.displayName,
    avatarUrl: profile.avatarUrl ?? profile.profileImageUrl ?? null,
    conversationId: profile.conversationId,
  };
  const connection = connectionQuery.data;
  // Legacy chats remain usable, but new chats and calls require accepted consent.
  const canStartConversation = Boolean(profile.conversationId) || connection?.status === "ACCEPTED";
  const connectionBusy = connectionActions.request.isPending || connectionActions.respond.isPending;
  const showConnectionError = () =>
    Alert.alert("Could not update connection", "Check your connection and try again.");
  const handleConnection = () => {
    if (connection?.status === "ACCEPTED") {
      return;
    }
    if (connection?.status === "PENDING" && connection.direction === "INCOMING") {
      Alert.alert("Connection request", `${profile.displayName} would like to practise with you.`, [
        {
          text: "Decline",
          style: "destructive",
          onPress: () =>
            connectionActions.respond.mutate(
              { id: connection.id, action: "DECLINE" },
              { onError: showConnectionError },
            ),
        },
        {
          text: "Accept",
          onPress: () =>
            connectionActions.respond.mutate(
              { id: connection.id, action: "ACCEPT" },
              { onError: showConnectionError },
            ),
        },
        { text: "Not now", style: "cancel" },
      ]);
      return;
    }
    if (connection?.status === "PENDING") {
      connectionActions.respond.mutate(
        { id: connection.id, action: "CANCEL" },
        { onError: showConnectionError },
      );
      return;
    }
    setConnectionRequestOpen(true);
  };
  const submitConnectionRequest = (introMessage?: string) => {
    connectionActions.request.mutate(introMessage, {
      onSuccess: () => setConnectionRequestOpen(false),
      onError: showConnectionError,
    });
  };
  const connectionLabel =
    connection?.status === "ACCEPTED"
      ? "Connected"
      : connection?.status === "PENDING"
        ? connection.direction === "INCOMING"
          ? "Respond"
          : "Requested"
        : "Connect";

  return (
    <Screen includeBottomInset>
      <View style={styles.layout}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          // Read-only content: let Android detach off-screen sections. iOS clipping can blank
          // shadows/modals mid-scroll, and the page is short enough not to need it there.
          removeClippedSubviews={Platform.OS === "android"}
        >
          <View style={styles.topBar}>
            <Text style={type.sectionLabel}>
              {isSelf ? "Preview · how others see you" : "Public profile"}
            </Text>
            {!isSelf ? (
              <Pressable
                onPress={openSafetyMenu}
                style={[
                  styles.menuButton,
                  { backgroundColor: colors.card, borderColor: colors.cardBorder },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Block or report"
              >
                <Text style={[styles.menuButtonText, { color: colors.text }]}>⋮</Text>
              </Pressable>
            ) : null}
          </View>

          {profile.location ? (
            <ProfileMap
              latitude={profile.location.latitude}
              longitude={profile.location.longitude}
              zoom={profile.city ? 10 : 5}
            />
          ) : null}

          <ProfileHeader
            displayName={profile.displayName}
            country={profile.country}
            city={profile.city}
            isPro={profile.isPro}
            onlineStatus={isSelf ? undefined : profile.onlineStatus}
            avatarUrl={profile.avatarUrl ?? profile.profileImageUrl}
            spokenLanguages={profile.spokenLanguages}
            learningLanguages={profile.learningLanguages}
            actions={
              !isSelf ? (
                <View style={styles.actions}>
                  {canStartConversation ? (
                    <>
                      <ProfileActionButton
                        icon="videocam"
                        label="Video"
                        busy={calling}
                        accessibilityLabel={`Video call ${profile.displayName}`}
                        onPress={() => void callUser(callTarget, "VIDEO")}
                      />
                      <ProfileActionButton
                        icon="call"
                        label="Audio"
                        busy={calling}
                        accessibilityLabel={`Audio call ${profile.displayName}`}
                        onPress={() => void callUser(callTarget, "AUDIO")}
                      />
                      <ProfileActionButton
                        icon="chatbubble-ellipses"
                        label="Message"
                        busy={busyUserId === profile.id}
                        accessibilityLabel={`Message ${profile.displayName}`}
                        onPress={() => void openChat(profile.id, profile.conversationId)}
                      />
                    </>
                  ) : null}
                  <ProfileActionButton
                    icon={connection?.status === "ACCEPTED" ? "people" : "person-add"}
                    label={connectionLabel}
                    quiet={connection?.status === "ACCEPTED" || connection?.status === "PENDING"}
                    busy={connectionBusy}
                    disabled={connection?.status === "ACCEPTED"}
                    accessibilityLabel={`${connectionLabel} with ${profile.displayName}`}
                    onPress={handleConnection}
                  />
                  <ProfileActionButton
                    icon={profile.isFollowing ? "checkmark" : "person-add"}
                    label={profile.isFollowing ? "Following" : "Follow"}
                    quiet={profile.isFollowing}
                    busy={toggleFollow.isPending}
                    accessibilityLabel={
                      profile.isFollowing
                        ? `Unfollow ${profile.displayName}`
                        : `Follow ${profile.displayName}`
                    }
                    onPress={() => toggleFollow.mutate(!profile.isFollowing)}
                  />
                </View>
              ) : undefined
            }
          />

          <View style={styles.stats}>
            {/* Visitors see at a glance whether others vouched for this member. */}
            <ReferenceSummaryLine summary={profile.references} />
            {profile.followerCount > 0 ? (
              <Text style={[type.body, styles.followers, { color: colors.muted }]}>
                {profile.followerCount} follower{profile.followerCount === 1 ? "" : "s"}
              </Text>
            ) : null}
          </View>

          {profile.mainTopic ? (
            <SectionCard title="Main topic" variant="content">
              <View style={styles.topicRow}>
                <Ionicons name="chatbubbles-outline" size={20} color={colors.accent} />
                <Text style={[type.body, styles.topicText]}>{profile.mainTopic}</Text>
              </View>
            </SectionCard>
          ) : null}

          <SectionCard title="Languages" variant="content">
            <LanguageChips title="Speaks" items={profile.spokenLanguages} tone="spoken" />
            <LanguageChips title="Learning" items={profile.learningLanguages} tone="learning" />
          </SectionCard>

          <LearningPreferencesCard preferences={profile.learningPreferences} />

          {(profile.profileAnswers ?? []).map((answer, index) =>
            answer.trim() ? (
              <SectionCard
                key={ONBOARDING_QUESTIONS[index] ?? `answer-${index}`}
                title={ONBOARDING_QUESTIONS[index] ?? "Answer"}
                variant="content"
              >
                <Text style={type.body}>{answer.trim()}</Text>
              </SectionCard>
            ) : null,
          )}

          {profile.bio.trim() || profile.topics.length || profile.practiceGoals.length ? (
            <SectionCard title="About me" variant="content">
              {profile.bio.trim() ? (
                <TranslatableCard
                  title="About me"
                  bare
                  body={profile.bio.trim()}
                  translate={isSelf ? undefined : { userId: profile.id, field: "bio" }}
                />
              ) : null}
              <TagList options={TOPICS} selected={profile.topics} />
              <TagList options={PRACTICE_GOALS} selected={profile.practiceGoals} />
            </SectionCard>
          ) : null}

          {profile.photos.length ? (
            <SectionCard title="Photos" variant="content">
              <PhotoGallery photos={profile.photos} />
            </SectionCard>
          ) : null}

          <ReferencesSection userId={profile.id} name={firstName} isSelf={isSelf} />

          {certificates.length ? (
            <SectionCard
              title="Certificates"
              variant="content"
              footer="Self-reported by the member."
            >
              <CertificateList items={certificates} />
            </SectionCard>
          ) : null}
        </ScrollView>
      </View>

      {!isSelf ? (
        <BlockReportMenu
          visible={safetyOpen}
          userId={profile.id}
          userName={profile.displayName}
          onClose={closeSafetyMenu}
          onBlocked={goBack}
        />
      ) : null}
      {!isSelf ? (
        <ConnectionRequestSheet
          visible={connectionRequestOpen}
          userName={profile.displayName}
          busy={connectionActions.request.isPending}
          onClose={() => setConnectionRequestOpen(false)}
          onSubmit={submitConnectionRequest}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  layout: {
    flex: 1,
  },
  content: {
    paddingBottom: spacing.md,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.lg,
  },
  topicRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  topicText: {
    flex: 1,
    fontWeight: "600",
  },
  stats: {
    gap: 4,
    marginBottom: spacing.sm,
  },
  followers: {
    textAlign: "center",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  menuButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  menuButtonText: {
    fontWeight: "700",
    fontSize: 20,
    lineHeight: 22,
  },
  errorWrap: {
    flex: 1,
    justifyContent: "center",
    gap: spacing.sm,
  },
  retry: {
    marginTop: spacing.sm,
    alignSelf: "flex-start",
    borderRadius: radius.lg,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  retryText: {
    fontWeight: "700",
  },
});
