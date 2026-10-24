import { useEffect } from "react";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/features/auth";
import type { AppStackParamList } from "@/navigation/types";
import { Screen } from "@/shared/components/Screen";
import { WarmErrorState } from "@/shared/components/WarmErrorState";

import { findBySaylyId } from "../api/profileApi";
import { ProfileSkeleton } from "../components/ProfileSkeleton";

/**
 * Landing screen for https://sayly.app/u/<SAYLY ID>: resolves the code and replaces
 * itself with the profile (or your own Profile tab when the link is yours).
 */
export function SharedProfileScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const { saylyId } = useRoute<RouteProp<AppStackParamList, "SharedProfile">>().params;
  const { user } = useAuth();
  const code = saylyId.trim().toUpperCase();

  const lookup = useQuery({
    queryKey: ["sayly-id", code],
    queryFn: () => findBySaylyId(code),
    retry: false,
  });
  const userId = lookup.data?.userId;

  useEffect(() => {
    if (!userId) return;
    if (userId === user?.id) {
      navigation.replace("MainTabs", { screen: "Profile" });
    } else {
      navigation.replace("PublicProfile", { userId });
    }
  }, [navigation, user?.id, userId]);

  if (lookup.isError) {
    return (
      <Screen includeBottomInset>
        <WarmErrorState
          title="This profile link isn't available"
          body="The member may have turned off their Sayly ID, or the link is mistyped."
          actionLabel="Go back"
          onAction={() =>
            navigation.canGoBack()
              ? navigation.goBack()
              : navigation.navigate("MainTabs", { screen: "Community" })
          }
        />
      </Screen>
    );
  }

  return (
    <Screen includeBottomInset>
      <ProfileSkeleton />
    </Screen>
  );
}
