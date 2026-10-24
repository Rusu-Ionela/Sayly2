import { Ionicons } from "@expo/vector-icons";
import { useLayoutEffect } from "react";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import type { AppStackParamList } from "@/navigation/types";
import { Button } from "@/shared/components/Button";
import { Screen } from "@/shared/components/Screen";
import { SectionCard } from "@/shared/components/SectionCard";
import { useColors } from "@/shared/theme";
import { spacing } from "@/shared/theme/spacing";

import { SupportIntro } from "../components/SupportIntro";
import { guidelinesFor } from "../model/guidelines";

/** Community guidelines or the Language Parties rules: one numbered, icon-led rule per row. */
export function GuidelinesScreen() {
  const colors = useColors();
  const navigation = useNavigation();
  const { params } = useRoute<RouteProp<AppStackParamList, "Guidelines">>();
  const page = guidelinesFor(params?.kind);

  useLayoutEffect(() => {
    navigation.setOptions({ title: page.heading });
  }, [navigation, page.heading]);

  return (
    <Screen includeBottomInset>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <SupportIntro icon={page.icon} heading={page.heading} body={page.intro} />

        <SectionCard>
          {page.rules.map((rule, index) => (
            <View
              key={rule.title}
              style={styles.rule}
              accessible
              accessibilityLabel={`Rule ${index + 1}: ${rule.title}. ${rule.body}`}
            >
              <View style={[styles.icon, { backgroundColor: colors.accentSoft }]}>
                <Ionicons name={rule.icon} size={20} color={colors.accent} />
              </View>
              <View style={styles.copy}>
                <Text style={[styles.title, { color: colors.text }]}>{rule.title}</Text>
                <Text style={[styles.body, { color: colors.muted }]}>{rule.body}</Text>
              </View>
            </View>
          ))}
        </SectionCard>

        <Text style={[styles.note, { color: colors.muted }]}>{page.note}</Text>

        <Button label="Got it" onPress={() => navigation.goBack()} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  rule: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    padding: spacing.md,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  copy: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
  },
  note: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
    paddingHorizontal: spacing.md,
  },
});
