import { useState } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from "react-native";
import Svg, { Path } from "react-native-svg";

import { radius } from "@/shared/theme/radius";

type AuthFieldProps = TextInputProps & {
  label: string;
  labelId: string;
  error?: string;
  /** `dark` for mosaic/auth night screens; `light` for daytime forms. */
  tone?: "light" | "dark";
};

type FieldPalette = {
  label: string;
  placeholder: string;
  text: string;
  background: string;
  border: string;
  borderFocused: string;
  borderError: string;
  backgroundFocused?: string;
  backgroundError?: string;
  error: string;
  eye: string;
  borderWidth: number;
};

const LIGHT: FieldPalette = {
  label: "#334155",
  placeholder: "#8A8F98",
  text: "#111827",
  background: "#FFFFFF",
  border: "#E2E8F0",
  borderFocused: "#4F46E5",
  borderError: "#DC2626",
  error: "#DC2626",
  eye: "#64748B",
  borderWidth: 1,
};

const DARK: FieldPalette = {
  label: "rgba(255,255,255,0.88)",
  placeholder: "rgba(255,255,255,0.42)",
  text: "#FFFFFF",
  background: "rgba(12, 10, 28, 0.88)",
  border: "rgba(255,255,255,0.22)",
  borderFocused: "#818CF8",
  borderError: "#F87171",
  backgroundFocused: "rgba(18, 16, 38, 0.95)",
  backgroundError: "rgba(28, 12, 18, 0.9)",
  error: "#FCA5A5",
  eye: "rgba(255,255,255,0.6)",
  borderWidth: 1.5,
};

function EyeIcon({ visible, color, size }: { visible: boolean; color: string; size: number }) {
  if (visible) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
          d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"
          stroke={color}
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path
          d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"
          stroke={color}
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    );
  }

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M1 1l22 22"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function AuthField({
  label,
  labelId,
  error,
  tone = "light",
  style,
  onFocus,
  onBlur,
  ...props
}: AuthFieldProps) {
  const [focused, setFocused] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const isPassword = props.secureTextEntry === true;
  const isDark = tone === "dark";
  const palette = isDark ? DARK : LIGHT;

  const inputBackground = error
    ? (palette.backgroundError ?? palette.background)
    : focused
      ? (palette.backgroundFocused ?? palette.background)
      : palette.background;
  const inputBorder = error
    ? palette.borderError
    : focused
      ? palette.borderFocused
      : palette.border;

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: palette.label }]} nativeID={labelId}>
        {label}
      </Text>
      <View style={styles.inputWrap}>
        <TextInput
          {...props}
          secureTextEntry={isPassword ? !passwordVisible : props.secureTextEntry}
          accessibilityLabelledBy={labelId}
          placeholderTextColor={palette.placeholder}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          style={[
            styles.input,
            isDark && styles.inputDarkElevation,
            {
              backgroundColor: inputBackground,
              borderColor: inputBorder,
              borderWidth: palette.borderWidth,
              color: palette.text,
              borderRadius: isDark ? radius.lg : 14,
              paddingVertical: isDark && Platform.OS === "ios" ? 16 : 14,
            },
            isPassword ? styles.inputWithEye : null,
            style,
          ]}
        />
        {isPassword ? (
          <Pressable
            style={styles.eyeButton}
            onPress={() => setPasswordVisible((value) => !value)}
            accessibilityRole="button"
            accessibilityLabel={passwordVisible ? "Hide password" : "Show password"}
            hitSlop={8}
          >
            <EyeIcon visible={passwordVisible} color={palette.eye} size={isDark ? 22 : 20} />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text style={[styles.error, { color: palette.error }]} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 18,
  },
  label: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  inputWrap: {
    position: "relative",
  },
  input: {
    paddingHorizontal: 16,
    minHeight: 54,
    fontSize: 16,
  },
  inputWithEye: {
    paddingRight: 48,
  },
  inputDarkElevation: {
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 6,
      },
      android: {
        elevation: 3,
      },
      default: {},
    }),
  },
  eyeButton: {
    position: "absolute",
    right: 12,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    width: 32,
  },
  error: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: "500",
    lineHeight: 16,
  },
});
