import { Component, type ErrorInfo, type ReactNode } from "react";
import { Appearance, Pressable, StyleSheet, Text, View } from "react-native";

import { darkColors, lightColors, type ThemeColors } from "@/shared/theme/colors";
import { spacing } from "@/shared/theme/spacing";

type ErrorBoundaryProps = {
  children: ReactNode;
  onReset?: () => void;
};

type ErrorBoundaryState = {
  hasError: boolean;
};

function colorsForSystem(): ThemeColors {
  return Appearance.getColorScheme() === "dark" ? darkColors : lightColors;
}

/**
 * Last-resort UI when a screen throws. Keeps the app from white-screening.
 * Uses system appearance so it stays readable without ThemeProvider.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error.message, info.componentStack);
  }

  private handleReset = () => {
    this.setState({ hasError: false });
    this.props.onReset?.();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const colors = colorsForSystem();

    return (
      <View style={[styles.root, { backgroundColor: colors.background }]} accessibilityRole="alert">
        <Text style={[styles.title, { color: colors.text }]}>Something went wrong</Text>
        <Text style={[styles.body, { color: colors.muted }]}>
          Sayly hit an unexpected error. You can try again without losing your account session.
        </Text>
        <Pressable
          onPress={this.handleReset}
          style={[styles.button, { backgroundColor: colors.accent }]}
          accessibilityRole="button"
          accessibilityLabel="Try again"
        >
          <Text style={[styles.buttonText, { color: colors.onPrimary }]}>Try again</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    marginBottom: spacing.sm,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  button: {
    alignSelf: "flex-start",
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    borderRadius: 14,
  },
  buttonText: {
    fontWeight: "800",
    fontSize: 15,
  },
});
