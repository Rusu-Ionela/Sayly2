import * as Haptics from "expo-haptics";
import { StyleSheet, View } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { CertificatesScreen } from "@/features/certificates";
import { ChatDetailScreen, ChatsScreen } from "@/features/chat";
import { CollectionScreen } from "@/features/collections";
import { DiscoverScreen } from "@/features/discovery";
import { FollowingScreen } from "@/features/follows";
import { ConnectionsScreen } from "@/features/connections";
import {
  CreateGroupScreen,
  GroupChatScreen,
  GroupDetailScreen,
  GroupsScreen,
} from "@/features/groups";
import { LanguagePreferencesScreen } from "@/features/languages";
import {
  NotificationsBridge,
  NotificationsScreen,
  useNotificationBadges,
} from "@/features/notifications";
import {
  EditProfileScreen,
  LearningPreferencesScreen,
  ProfileScreen,
  PublicProfileScreen,
  SharedProfileScreen,
} from "@/features/profile";
import { BlockedUsersScreen } from "@/features/safety";
import { FaqScreen, GuidelinesScreen, SupportFormScreen } from "@/features/support";
import { LegalDocumentScreen, SettingsScreen } from "@/features/settings";
import { TopicsScreen } from "@/features/topics";
import { ProfileVisitsScreen } from "@/features/visitors";
import { ConnectionStatusBanner } from "@/shared/components/ConnectionStatusBanner";
import { useColors, useThemeScheme } from "@/shared/theme";

import { ionicon } from "./tabIcons";
import type { AppStackParamList, MainTabParamList } from "./types";

const Tab = createBottomTabNavigator<MainTabParamList>();
const Stack = createNativeStackNavigator<AppStackParamList>();

function MainTabs() {
  const colors = useColors();
  const scheme = useThemeScheme();
  const dark = scheme === "dark";
  const badges = useNotificationBadges();

  return (
    <View style={{ flex: 1 }}>
      <ConnectionStatusBanner />
      <Tab.Navigator
        screenListeners={{
          tabPress: () => {
            // Light tick on every tab press, like native tab bars.
            void Haptics.selectionAsync().catch(() => undefined);
          },
        }}
        screenOptions={{
          sceneStyle: { backgroundColor: "transparent" },
          headerStyle: {
            backgroundColor: dark ? "rgba(15, 23, 42, 0.92)" : "rgba(248, 249, 254, 0.92)",
          },
          headerTintColor: colors.text,
          headerShadowVisible: false,
          headerTitleStyle: { fontWeight: "700" },
          tabBarActiveTintColor: colors.text,
          tabBarInactiveTintColor: colors.muted,
          tabBarLabelStyle: { fontSize: 11, fontWeight: "700" },
          tabBarHideOnKeyboard: true,
          tabBarStyle: {
            backgroundColor: colors.card,
            borderTopColor: colors.border,
            borderTopWidth: StyleSheet.hairlineWidth,
          },
          tabBarItemStyle: { paddingTop: 6 },
        }}
      >
        <Tab.Screen
          name="Community"
          component={DiscoverScreen}
          options={{
            headerShown: false,
            tabBarIcon: ionicon("earth", "earth-outline"),
          }}
        />
        <Tab.Screen
          name="Chats"
          component={ChatsScreen}
          options={{
            headerShown: false,
            tabBarIcon: ionicon("chatbubbles", "chatbubbles-outline"),
            tabBarBadge: badges.chats,
          }}
        />
        <Tab.Screen
          name="Groups"
          component={GroupsScreen}
          options={{
            headerShown: false,
            tabBarLabel: "Social",
            tabBarIcon: ionicon("people", "people-outline"),
          }}
        />
        <Tab.Screen
          name="Profile"
          component={ProfileScreen}
          options={{
            headerShown: false,
            tabBarIcon: ionicon("person-circle", "person-circle-outline"),
          }}
        />
      </Tab.Navigator>
    </View>
  );
}

export function MainNavigator() {
  const colors = useColors();
  const scheme = useThemeScheme();
  const dark = scheme === "dark";

  return (
    <>
      <NotificationsBridge />
      <Stack.Navigator
        screenOptions={{
          headerStyle: {
            backgroundColor: dark ? "rgba(18, 20, 31, 0.94)" : "rgba(248, 250, 252, 0.94)",
          },
          headerTintColor: colors.text,
          headerShadowVisible: false,
          headerTitleStyle: { fontWeight: "700" },
          headerBackTitle: "Back",
          contentStyle: { backgroundColor: "transparent" },
        }}
      >
        <Stack.Screen
          name="MainTabs"
          component={MainTabs}
          options={{ headerShown: false, title: "Back" }}
        />
        <Stack.Screen
          name="PublicProfile"
          component={PublicProfileScreen}
          options={{ title: "Profile" }}
        />
        <Stack.Screen
          name="UserPreview"
          component={PublicProfileScreen}
          options={{ title: "Profile" }}
        />
        <Stack.Screen
          name="Conversation"
          component={ChatDetailScreen}
          options={{ headerShown: false, title: "Chat" }}
        />
        <Stack.Screen
          name="EditProfile"
          component={EditProfileScreen}
          options={{ title: "Edit profile", headerBackButtonMenuEnabled: false }}
        />
        <Stack.Screen
          name="GroupDetail"
          component={GroupDetailScreen}
          options={{ title: "Group" }}
        />
        <Stack.Screen
          name="GroupChat"
          component={GroupChatScreen}
          options={{ title: "Discussion" }}
        />
        <Stack.Screen
          name="CreateGroup"
          component={CreateGroupScreen}
          options={{ title: "New group", presentation: "modal" }}
        />
        <Stack.Screen
          name="LanguagePreferences"
          component={LanguagePreferencesScreen}
          options={{ title: "Your languages" }}
        />
        <Stack.Screen
          name="Following"
          component={FollowingScreen}
          options={{ title: "Following" }}
        />
        <Stack.Screen
          name="Connections"
          component={ConnectionsScreen}
          options={{ title: "Connections" }}
        />
        <Stack.Screen
          name="Notifications"
          component={NotificationsScreen}
          options={{ title: "Notifications" }}
        />
        <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: "Settings" }} />
        <Stack.Screen
          name="BlockedUsers"
          component={BlockedUsersScreen}
          options={{ title: "Blocked users" }}
        />
        <Stack.Screen
          name="Collection"
          component={CollectionScreen}
          options={{ title: "Collection" }}
        />
        <Stack.Screen
          name="Certificates"
          component={CertificatesScreen}
          options={{ title: "Certificates" }}
        />
        <Stack.Screen
          name="LearningPreferences"
          component={LearningPreferencesScreen}
          options={{ title: "Learning preferences" }}
        />
        <Stack.Screen name="Topics" component={TopicsScreen} options={{ title: "Topics" }} />
        <Stack.Screen
          name="ProfileVisits"
          component={ProfileVisitsScreen}
          options={({ route }) => ({
            title: route.params.mode === "visitors" ? "Visitors" : "Viewed profiles",
          })}
        />
        <Stack.Screen
          name="SharedProfile"
          component={SharedProfileScreen}
          options={{ title: "Profile" }}
        />
        <Stack.Screen
          name="PrivacyPolicy"
          component={LegalDocumentScreen}
          options={{ title: "Privacy Policy" }}
        />
        <Stack.Screen
          name="TermsOfService"
          component={LegalDocumentScreen}
          options={{ title: "Terms of Service" }}
        />
        <Stack.Screen
          name="Imprint"
          component={LegalDocumentScreen}
          options={{ title: "Imprint" }}
        />
        <Stack.Screen
          name="AboutUs"
          component={LegalDocumentScreen}
          options={{ title: "About us" }}
        />
        <Stack.Screen
          name="Guidelines"
          component={GuidelinesScreen}
          options={{ title: "Guidelines" }}
        />
        <Stack.Screen name="Faq" component={FaqScreen} options={{ title: "FAQs" }} />
        <Stack.Screen
          name="SupportForm"
          component={SupportFormScreen}
          options={{ title: "Support" }}
        />
      </Stack.Navigator>
    </>
  );
}
