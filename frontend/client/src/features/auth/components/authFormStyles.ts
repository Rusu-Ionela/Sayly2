import { StyleSheet } from "react-native";

import { radius } from "@/shared/theme/radius";

/**
 * Layout-only auth form styles.
 * Colors come from `useAuthCopyColors()` at the call site so light/dark mosaic tones stay correct.
 */
export const authFormStyles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingBottom: 16,
  },
  header: {
    alignItems: "center",
    gap: 10,
    marginBottom: 28,
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
    textAlign: "center",
    maxWidth: 320,
  },
  formError: {
    fontSize: 13,
    fontWeight: "500",
    marginBottom: 12,
    lineHeight: 18,
  },
  infoBanner: {
    marginBottom: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: radius.lg,
    borderWidth: 1,
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 20,
  },
  footer: {
    marginTop: 24,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "center",
  },
  footerMuted: {
    fontSize: 15,
  },
  footerLink: {
    fontSize: 15,
    fontWeight: "700",
  },
  textLinkWrap: {
    alignSelf: "center",
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 8,
    marginTop: 8,
  },
  textLink: {
    fontSize: 13,
    fontWeight: "600",
  },
});
