import { CommonActions } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import type { AuthStackParamList } from "@/navigation/types";

type AuthNav = NativeStackNavigationProp<AuthStackParamList>;

/** Clear auth stack — only Welcome remains (fixes back showing login/signup again). */
export function resetToWelcome(navigation: AuthNav) {
  navigation.dispatch(
    CommonActions.reset({
      index: 0,
      routes: [{ name: "Welcome" }],
    }),
  );
}

export function openLogin(navigation: AuthNav) {
  navigation.navigate("Login");
}

export function openSignUp(navigation: AuthNav) {
  navigation.navigate("SignUp");
}

/** Swap between login ↔ signup without stacking both on back history. */
export function switchToLogin(navigation: AuthNav) {
  navigation.replace("Login");
}

export function switchToSignUp(navigation: AuthNav) {
  navigation.replace("SignUp");
}

/** Clear password-reset screens and land on login. */
export function backToLogin(navigation: AuthNav) {
  navigation.dispatch(
    CommonActions.reset({
      index: 0,
      routes: [{ name: "Login" }],
    }),
  );
}
