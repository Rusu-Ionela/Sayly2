import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import type { AppStackParamList } from "@/navigation/types";
import { Button } from "@/shared/components/Button";
import { Chip } from "@/shared/components/Chip";
import { FaqItem } from "@/shared/components/FaqItem";
import { Screen } from "@/shared/components/Screen";
import { SearchField } from "@/shared/components/SearchField";
import { SectionCard } from "@/shared/components/SectionCard";
import { WarmEmptyState } from "@/shared/components/WarmEmptyState";
import { useColors } from "@/shared/theme";
import { spacing } from "@/shared/theme/spacing";

import { FAQ_CATEGORIES, type FaqCategory } from "../model/faqContent";

type CategoryFilter = FaqCategory["id"] | "ALL";

function matches(text: string, query: string) {
  return text.toLowerCase().includes(query);
}

/** FAQs grouped by category, with a search box and category chips. */
export function FaqScreen() {
  const colors = useColors();
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("ALL");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return FAQ_CATEGORIES.filter((item) => category === "ALL" || item.id === category)
      .map((item) => ({
        ...item,
        entries: q
          ? item.entries.filter((entry) => matches(entry.question, q) || matches(entry.answer, q))
          : item.entries,
      }))
      .filter((item) => item.entries.length > 0);
  }, [category, query]);

  return (
    <Screen includeBottomInset>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <SearchField
          value={query}
          onChange={setQuery}
          onClear={() => setQuery("")}
          placeholder="Search questions"
        />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          <Chip label="All" selected={category === "ALL"} onPress={() => setCategory("ALL")} />
          {FAQ_CATEGORIES.map((item) => (
            <Chip
              key={item.id}
              label={item.title}
              icon={item.icon}
              selected={category === item.id}
              onPress={() => setCategory(item.id)}
            />
          ))}
        </ScrollView>

        {visible.length === 0 ? (
          <WarmEmptyState title="No answers found" body="Try other words, or ask us directly." />
        ) : (
          visible.map((item) => (
            <SectionCard key={item.id} title={item.title}>
              {item.entries.map((entry) => (
                <FaqItem key={entry.question} question={entry.question} answer={entry.answer} />
              ))}
            </SectionCard>
          ))
        )}

        <View style={styles.help}>
          <Text style={[styles.helpTitle, { color: colors.text }]}>Still need help?</Text>
          <Text style={[styles.helpBody, { color: colors.muted }]}>
            Our team answers every message, usually within two working days.
          </Text>
          <Button
            label="Contact us"
            onPress={() => navigation.navigate("SupportForm", { kind: "contact" })}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  chips: {
    gap: spacing.sm,
  },
  help: {
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  helpTitle: {
    fontSize: 17,
    fontWeight: "800",
    textAlign: "center",
  },
  helpBody: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
});
