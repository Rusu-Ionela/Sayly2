import { memo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { UserLanguageDto } from "@/features/languages/types";
import { useColors } from "@/shared/theme";
import { radius } from "@/shared/theme/radius";
import { spacing } from "@/shared/theme/spacing";

import { certificateFormSchema, type CertificateFormValues } from "../schema";

import { TextField } from "@/shared/components/TextField";
import { CEFR_LEVELS, type CefrLevel } from "@sayly/shared";

type CertificateEditorProps = {
  /** Languages the certificate can be for (the user's spoken + learning ones). */
  languages: readonly UserLanguageDto[];
  onAdd: (certificate: CertificateFormValues) => void;
};

type Draft = { languageId: string; level: CefrLevel; title: string; year: string };

const EMPTY_DRAFT: Draft = { languageId: "", level: "B1", title: "", year: "" };

/** Inline "add certificate" form; validates with the same schema as the edit form. */
export const CertificateEditor = memo(function CertificateEditor({
  languages,
  onAdd,
}: CertificateEditorProps) {
  const colors = useColors();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [error, setError] = useState<string | null>(null);

  const update = (patch: Partial<Draft>) => {
    setDraft((current) => ({ ...current, ...patch }));
    setError(null);
  };

  const submit = () => {
    const parsed = certificateFormSchema.safeParse({
      languageId: draft.languageId,
      level: draft.level,
      title: draft.title,
      issuedYear: draft.year.trim() ? Number(draft.year) : null,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check the certificate details");
      return;
    }
    onAdd(parsed.data);
    setDraft(EMPTY_DRAFT);
    setOpen(false);
  };

  if (!open) {
    return (
      <Pressable onPress={() => setOpen(true)} accessibilityRole="button" hitSlop={8}>
        <Text style={[styles.link, { color: colors.accent }]}>+ Add certificate</Text>
      </Pressable>
    );
  }

  const chip = (selected: boolean) => [
    styles.chip,
    {
      backgroundColor: selected ? colors.accent : colors.card,
      borderColor: selected ? colors.accent : colors.cardBorder,
    },
  ];
  const chipText = (selected: boolean) => [
    styles.chipText,
    { color: selected ? colors.onPrimary : colors.text },
  ];

  return (
    <View style={[styles.form, { borderColor: colors.cardBorder }]}>
      <Text style={[styles.label, { color: colors.muted }]}>Language</Text>
      <View style={styles.row}>
        {languages.map((language) => {
          const selected = draft.languageId === language.languageId;
          return (
            <Pressable
              key={language.languageId}
              onPress={() => update({ languageId: language.languageId })}
              style={chip(selected)}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
            >
              <Text style={chipText(selected)}>
                {language.flagEmoji ? `${language.flagEmoji} ` : ""}
                {language.name}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={[styles.label, { color: colors.muted }]}>Level</Text>
      <View style={styles.row}>
        {CEFR_LEVELS.map((level) => {
          const selected = draft.level === level;
          return (
            <Pressable
              key={level}
              onPress={() => update({ level })}
              style={chip(selected)}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
            >
              <Text style={chipText(selected)}>{level}</Text>
            </Pressable>
          );
        })}
      </View>

      <TextField
        label="Certificate"
        value={draft.title}
        onChangeText={(title) => update({ title })}
        placeholder="e.g. IELTS, DELE, Goethe-Zertifikat"
        maxLength={60}
      />
      <TextField
        label="Year (optional)"
        value={draft.year}
        onChangeText={(year) => update({ year: year.replace(/\D/g, "").slice(0, 4) })}
        placeholder="2024"
        keyboardType="number-pad"
        maxLength={4}
      />

      {error ? <Text style={[styles.error, { color: colors.rose }]}>{error}</Text> : null}

      <View style={styles.actions}>
        <Pressable
          onPress={() => {
            setDraft(EMPTY_DRAFT);
            setError(null);
            setOpen(false);
          }}
          accessibilityRole="button"
          hitSlop={8}
        >
          <Text style={[styles.link, { color: colors.muted }]}>Cancel</Text>
        </Pressable>
        <Pressable
          onPress={submit}
          style={[styles.add, { backgroundColor: colors.accent }]}
          accessibilityRole="button"
        >
          <Text style={[styles.addText, { color: colors.onPrimary }]}>Add</Text>
        </Pressable>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  form: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  label: {
    fontSize: 13,
    fontWeight: "700",
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  chip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipText: {
    fontSize: 14,
    fontWeight: "600",
  },
  error: {
    fontSize: 12,
    fontWeight: "600",
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: spacing.lg,
  },
  link: {
    fontSize: 15,
    fontWeight: "700",
  },
  add: {
    borderRadius: radius.md,
    paddingHorizontal: 20,
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  addText: {
    fontWeight: "800",
  },
});
