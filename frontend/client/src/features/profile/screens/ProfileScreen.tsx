import { Ionicons } from "@expo/vector-icons";
import { useMemo } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { CompositeNavigationProp } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { recommendedTestLevel } from "@/features/certificates/model/certificateContent";
import { useConnections } from "@/features/connections/hooks/useConnections";
import { useStreak } from "@/features/streaks";
import { NotificationsBell } from "@/features/notifications";
import { ReferencesSection } from "@/features/references";
import { PROFILE_SECTIONS, SettingsSections } from "@/features/settings";
import { showProInfo } from "@/features/subscription";
import type { AppStackParamList, MainTabParamList } from "@/navigation/types";
import { useFloatingTabBarPadding } from "@/navigation/floatingTabBar";
import { ActionSheet } from "@/shared/components/ActionSheet";
import { AppRefreshControl } from "@/shared/components/AppRefreshControl";
import { Avatar } from "@/shared/components/Avatar";
import { EmptyStateCard } from "@/shared/components/EmptyStateCard";
import { PressableScale } from "@/shared/components/PressableScale";
import { ProBadge } from "@/shared/components/ProBadge";
import { Screen } from "@/shared/components/Screen";
import { SectionCard } from "@/shared/components/SectionCard";
import { SettingRow } from "@/shared/components/SettingRow";
import { WarmErrorState } from "@/shared/components/WarmErrorState";
import { useColors } from "@/shared/theme";
import { radius } from "@/shared/theme/radius";
import { spacing } from "@/shared/theme/spacing";
import { getTypography } from "@/shared/theme/typography";
import { PRACTICE_GOALS, TOPICS } from "@sayly/shared";

import { PhotoGallery } from "../components/PhotoGallery";
import { ProfileHeader } from "../components/ProfileHeader";
import { ProfileSkeleton } from "../components/ProfileSkeleton";
import { ProfileStatsRow, type ProfileStat } from "../components/ProfileStatsRow";
import { PromoCarousel, type PromoCard } from "../components/PromoCarousel";
import { QuickAction } from "../components/QuickAction";
import { TagList } from "../components/TagList";
import { useProfile, useUpdateSettings } from "../hooks/useProfile";
import { useShareProfile } from "../hooks/useShareProfile";
import { profileAvatarUrl } from "../model/avatar";
import { buildProfileMenu, type ProfileMenuRoute } from "../model/profileMenu";
import type { CurrentUserProfile } from "../types";

type ProfileNav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, "Profile">,
  NativeStackNavigationProp<AppStackParamList>
>;

function promoCards(profile: CurrentUserProfile, navigation: ProfileNav): PromoCard[] {
  const learning = profile.learningLanguages[0];
  const level = recommendedTestLevel(learning?.proficiency);
  const cards: PromoCard[] = [];

  if (!profile.isPro) {
    cards.push({
      key: "pro",
      icon: "star",
      eyebrow: "SAYLY PRO",
      title: "Get your spot on the Pro team",
      body: "Learn faster, smarter, better. See your visitors and every profile you viewed.",
      cta: "Join team Pro",
      gradient: ["#F59E0B", "#C2410C"],
      onPress: () => showProInfo(false),
    });
  }
  cards.push({
    key: "certificate",
    icon: "shield-checkmark",
    eyebrow: "LANGUAGE TEST",
    title: `Get your ${level} certificate`,
    body: learning
      ? `Prove your ${learning.name} level with a 45-minute online test and an instant result.`
      : "Prove your level with a 45-minute online test and an instant result.",
    cta: "Take the test",
    gradient: ["#0EA5E9", "#4C35F5"],
    onPress: () => navigation.navigate("Certificates", { tab: "get" }),
  });
  return cards;
}

/**
 * The Profile tab — your card, About me, references, Community visibility and preview,
 * promos, the profile menu, then feedback, help, community links, legal, privacy toggles
 * and Sign out. Notifications, appearance and account live behind the gear (Settings).
 */
export function ProfileScreen() {
  const colors = useColors();
  const type = getTypography(colors);
  const navigation = useNavigation<ProfileNav>();
  const tabBarPadding = useFloatingTabBarPadding();
  const profileQuery = useProfile();
  const { save } = useUpdateSettings({
    onError: (message) => Alert.alert("Could not update setting", message),
  });
  const profile = profileQuery.data;
  const shareProfile = useShareProfile(profile);

  const connections = useConnections();
  const incomingRequests = connections.data?.incoming.length ?? 0;
  const partnerCount = connections.data?.accepted.length ?? null;
  const streak = useStreak().data;
  const menu = useMemo(
    () => (profile ? buildProfileMenu(profile, incomingRequests) : []),
    [profile, incomingRequests],
  );
  const stats = useMemo<ProfileStat[]>(
    () => [
      { key: "streak", emoji: "🔥", value: streak?.current ?? null, label: "Day streak" },
      { key: "best", emoji: "🏆", value: streak?.longest ?? null, label: "Best streak" },
      { key: "partners", emoji: "🤝", value: partnerCount, label: "Partners" },
    ],
    [streak, partnerCount],
  );
  const promos = useMemo(
    () => (profile ? promoCards(profile, navigation) : []),
    [profile, navigation],
  );

  if (profileQuery.isLoading) {
    return (
      <Screen>
        <ProfileSkeleton />
      </Screen>
    );
  }

  if (!profile) {
    return (
      <Screen>
        <WarmErrorState
          title="Could not load your profile"
          body="Check your connection and try again."
          onAction={() => void profileQuery.refetch()}
        />
      </Screen>
    );
  }

  const editProfile = () => navigation.navigate("EditProfile");
  const openMenu = (route: ProfileMenuRoute) =>
    route.name === "ProfileVisits"
      ? navigation.navigate("ProfileVisits", route.params)
      : navigation.navigate(route.name);

  const headerButton = (
    icon: "share-outline" | "settings-outline",
    label: string,
    onPress: () => void,
  ) => (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      style={({ pressed }) => [
        styles.headerButton,
        { backgroundColor: colors.card, borderColor: colors.cardBorder },
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons name={icon} size={21} color={colors.text} />
    </Pressable>
  );

  const bio = profile.bio.trim();
  const hasAbout = Boolean(
    bio || profile.topics.length || profile.practiceGoals.length || profile.photos.length,
  );

  return (
    <Screen>
      <View style={styles.titleRow}>
        <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
          Profile
        </Text>
        <View style={styles.headerActions}>
          <NotificationsBell />
          {headerButton("share-outline", "Share profile", shareProfile.share)}
          {headerButton("settings-outline", "Settings", () => navigation.navigate("Settings"))}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: tabBarPadding }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <AppRefreshControl
            refreshing={profileQuery.isRefetching}
            onRefresh={() => void profileQuery.refetch()}
          />
        }
      >
        {/* 1. Identity */}
        <ProfileHeader
          displayName={profile.displayName}
          country={profile.country}
          city={profile.city}
          isPro={profile.isPro}
          // You are online while looking at this; grey when you hide your status from others.
          onlineStatus={profile.settings.showOnlineStatus ? "ONLINE" : "OFFLINE"}
          statusLabel={profile.settings.showOnlineStatus ? "Online" : "Status hidden"}
          avatarUrl={profileAvatarUrl(profile)}
          spokenLanguages={profile.spokenLanguages}
          learningLanguages={profile.learningLanguages}
          saylyId={profile.settings.showSaylyId ? profile.saylyId : null}
          avatarSlot={
            <PressableScale
              onPress={editProfile}
              // Fixed size: PressableScale stretches to fill its parent otherwise.
              style={styles.avatarButton}
              accessibilityRole="button"
              accessibilityLabel="Change profile photo"
            >
              <Avatar uri={profileAvatarUrl(profile)} name={profile.displayName} size={96} />
              <View
                style={[
                  styles.cameraBadge,
                  { backgroundColor: colors.accent, borderColor: colors.card },
                ]}
              >
                <Ionicons name="camera" size={15} color={colors.onPrimary} />
              </View>
            </PressableScale>
          }
          stats={<ProfileStatsRow stats={stats} />}
          actions={
            <QuickAction
              icon="create-outline"
              label="Edit profile"
              onPress={editProfile}
              primary
              compact
            />
          }
        />

        <SectionCard
          title="About me"
          variant="content"
          action={
            <Pressable
              onPress={editProfile}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Edit about me"
            >
              <Text style={[styles.cta, { color: colors.accent }]}>Edit</Text>
            </Pressable>
          }
        >
          {hasAbout ? (
            <>
              {bio ? <Text style={type.body}>{bio}</Text> : null}
              {profile.topics.length ? (
                <View style={styles.group}>
                  <Text style={[styles.label, { color: colors.muted }]}>Interests</Text>
                  <TagList options={TOPICS} selected={profile.topics} />
                </View>
              ) : null}
              {profile.practiceGoals.length ? (
                <View style={styles.group}>
                  <Text style={[styles.label, { color: colors.muted }]}>Learning goals</Text>
                  <TagList options={PRACTICE_GOALS} selected={profile.practiceGoals} />
                </View>
              ) : null}
              {profile.photos.length ? <PhotoGallery photos={profile.photos} /> : null}
            </>
          ) : (
            <EmptyStateCard
              icon="sparkles"
              title="Make a great first impression"
              body="Partners reply more when they know you. Add a short bio, your interests and learning goals."
              action={{ label: "Add about me", onPress: editProfile }}
            />
          )}
        </SectionCard>

        {/* Same section everyone sees on your public profile. */}
        <ReferencesSection
          userId={profile.id}
          name={profile.displayName}
          isSelf
          onEmptyAction={() => navigation.navigate("Community")}
        />

        <SectionCard
          footer={
            profile.settings.discoverable
              ? "New partners can find you in the Community."
              : "You're hidden. Only people you already talk to can see you."
          }
        >
          <SettingRow
            kind="toggle"
            icon="earth-outline"
            title="Show me in the Community"
            value={profile.settings.discoverable}
            onValueChange={(next) => save({ discoverable: next })}
          />
          <SettingRow
            kind="link"
            icon="eye-outline"
            title="Preview profile"
            subtitle="See your profile the way others do"
            onPress={() => navigation.navigate("PublicProfile", { userId: profile.id })}
          />
        </SectionCard>

        <PromoCarousel cards={promos} />

        {/* 2. Profile menu */}
        <SectionCard title="Your profile">
          {menu.map((item) => (
            <SettingRow
              key={item.key}
              kind="link"
              icon={item.icon}
              title={item.title}
              subtitle={item.subtitle}
              onPress={() => openMenu(item.route)}
              trailing={
                item.pro || item.badge ? (
                  <View style={styles.trailing}>
                    {item.badge ? (
                      <View style={[styles.counter, { backgroundColor: colors.accent }]}>
                        <Text style={[styles.counterText, { color: colors.onPrimary }]}>
                          {item.badge > 99 ? "99+" : item.badge}
                        </Text>
                      </View>
                    ) : null}
                    {item.pro ? <ProBadge /> : null}
                    <Ionicons name="chevron-forward" size={18} color={colors.muted} />
                  </View>
                ) : undefined
              }
            />
          ))}
        </SectionCard>

        {/* 3–6. Feedback, help, community, legal, privacy toggles, Sign out */}
        <SettingsSections profile={profile} sections={PROFILE_SECTIONS} showSignOut />
      </ScrollView>

      <ActionSheet
        visible={shareProfile.promptOpen}
        onClose={shareProfile.closePrompt}
        icon="qr-code-outline"
        title="Turn on your Sayly ID"
        message="Your Sayly ID needs to be turned on to share your profile."
        actions={[
          {
            label: "Turn on",
            tone: "primary",
            loading: shareProfile.turningOn,
            onPress: () => void shareProfile.turnOnAndShare(),
          },
        ]}
        cancelLabel="Not now"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    // Dev builds: keep clear of the Expo Go tools button in the top-right corner.
    marginRight: __DEV__ ? 56 : 0,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.6,
  },
  avatarButton: {
    width: 96,
    height: 96,
  },
  cameraBadge: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  trailing: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  counter: {
    minWidth: 22,
    height: 22,
    borderRadius: radius.pill,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  counterText: {
    fontSize: 12,
    fontWeight: "800",
  },
  group: {
    gap: spacing.sm,
  },
  label: {
    fontSize: 13,
    fontWeight: "700",
  },
  cta: {
    fontWeight: "700",
  },
});
