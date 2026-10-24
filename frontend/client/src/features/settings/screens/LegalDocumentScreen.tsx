import { ScrollView, StyleSheet, Text } from "react-native";
import { useRoute, type RouteProp } from "@react-navigation/native";

import type { AppStackParamList, AuthStackParamList } from "@/navigation/types";
import { Screen } from "@/shared/components/Screen";
import { useColors } from "@/shared/theme";
import { spacing } from "@/shared/theme/spacing";

import { LEGAL_DOCUMENTS, type LegalDocumentId } from "../model/legalDocuments";

type LegalRoute = RouteProp<AppStackParamList & AuthStackParamList, LegalDocumentId>;

export function LegalDocumentScreen() {
  const route = useRoute<LegalRoute>();
  const colors = useColors();
  const { title, body } = LEGAL_DOCUMENTS[route.name];

  return (
    <Screen includeBottomInset>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
          {title}
        </Text>
        <Text style={[styles.body, { color: colors.muted }]}>{body}</Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  body: {
    fontSize: 15,
    lineHeight: 24,
    fontWeight: "500",
  },
});
