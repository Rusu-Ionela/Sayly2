import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { StyleSheet, Text, useWindowDimensions, View } from "react-native";

import type { AuthStackParamList } from "@/navigation/types";

import { AuthBackdrop } from "../components/AuthBackdrop";
import { openLogin, openSignUp } from "../authNavigation";
import { WelcomeActionButton } from "../components/WelcomeActionButton";
import { WelcomeHeroCarousel } from "../components/WelcomeHeroCarousel";
import { useAuthCopyColors } from "../components/useAuthCopyColors";
import { WELCOME_SLIDES } from "@/features/auth/welcomeAssets";

export function WelcomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const { height, width } = useWindowDimensions();
  const copy = useAuthCopyColors();

  const heroHeight = Math.min(height * 0.5, 460);
  const heroWidth = Math.min(width * 0.62, 280);

  return (
    <AuthBackdrop>
      <View style={styles.body}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: copy.title }]} accessibilityRole="header">
            Welcome to Sayly!
          </Text>
          <Text style={[styles.subtitle, { color: copy.subtitle }]}>
            Learn languages and make friends with real people around the world!
          </Text>
        </View>

        <WelcomeHeroCarousel slides={WELCOME_SLIDES} width={heroWidth} height={heroHeight} />

        <View style={styles.actions}>
          <WelcomeActionButton label="Create account" onPress={() => openSignUp(navigation)} />
          <WelcomeActionButton label="Log in" onPress={() => openLogin(navigation)} />
        </View>
      </View>
    </AuthBackdrop>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    justifyContent: "space-between",
    alignSelf: "stretch",
    width: "100%",
  },
  header: {
    alignItems: "center",
    gap: 10,
    zIndex: 2,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.4,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "400",
    textAlign: "center",
    maxWidth: 340,
    paddingHorizontal: 8,
  },
  actions: {
    flexDirection: "row",
    alignSelf: "stretch",
    alignItems: "stretch",
    gap: 10,
    zIndex: 3,
    width: "100%",
    minHeight: 52,
  },
});
