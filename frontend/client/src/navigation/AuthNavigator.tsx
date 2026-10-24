import { createNativeStackNavigator } from "@react-navigation/native-stack";

import {
  ForgotPasswordScreen,
  LoginScreen,
  ResetPasswordScreen,
  SignUpScreen,
  WelcomeScreen,
} from "@/features/auth";
import { LegalDocumentScreen } from "@/features/settings/screens/LegalDocumentScreen";

import type { AuthStackParamList } from "./types";

const Stack = createNativeStackNavigator<AuthStackParamList>();

export function AuthNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName="Welcome">
      <Stack.Screen name="Welcome" component={WelcomeScreen} options={{ gestureEnabled: false }} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="SignUp" component={SignUpScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
      <Stack.Screen
        name="PrivacyPolicy"
        component={LegalDocumentScreen}
        options={{ headerShown: true, title: "Privacy Policy" }}
      />
      <Stack.Screen
        name="TermsOfService"
        component={LegalDocumentScreen}
        options={{ headerShown: true, title: "Terms of Service" }}
      />
    </Stack.Navigator>
  );
}
