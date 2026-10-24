import { useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import { Avatar } from "@/shared/components/Avatar";
import { SectionCard } from "@/shared/components/SectionCard";
import { Skeleton } from "@/shared/components/Skeleton";
import { useColors } from "@/shared/theme";
import { radius } from "@/shared/theme/radius";
import { spacing } from "@/shared/theme/spacing";

import { useReferenceMutations, useReferences } from "../hooks/useReferences";
import { describeReferences, referenceErrorMessage } from "../model/referenceSummary";
import { ReferenceModal } from "./ReferenceModal";
import { StarRating } from "./StarRating";

type ReferencesSectionProps = {
  userId: string;
  /** First name, for "Write a reference for Ana". */
  name: string;
  /** Your own profile: no write button, and "you" in the empty state. */
  isSelf?: boolean;
};

/** A member's references with their summary, and the viewer's own reference editor. */
export function ReferencesSection({ userId, name, isSelf = false }: ReferencesSectionProps) {
  const colors = useColors();
  const references = useReferences(userId);
  const { save, remove } = useReferenceMutations(userId);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const items = useMemo(
    () => references.data?.pages.flatMap((page) => page.items) ?? [],
    [references.data],
  );
  const first = references.data?.pages[0];
  const mine = first?.mine ?? null;

  const close = () => {
    setEditing(false);
    setError(null);
  };

  const confirmDelete = () =>
    Alert.alert("Delete your reference?", "It will disappear from their profile.", [
      { text: "Keep", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () =>
          remove.mutate(undefined, {
            onSuccess: close,
            onError: (err) =>
              setError(referenceErrorMessage(err, "Could not delete. Please try again.")),
          }),
      },
    ]);

  const emptyText = isSelf
    ? "You don't have any references yet. Partners can leave one after you've chatted."
    : `${name} doesn't have any references yet.`;

  return (
    <SectionCard
      title="References"
      variant="content"
      // The empty state already says "no references", so the count shows only when there are some.
      footer={first?.summary.total ? describeReferences(first.summary) : undefined}
    >
      {references.isPending ? (
        <Skeleton height={72} radius={radius.lg} />
      ) : references.isError ? (
        <Pressable onPress={() => void references.refetch()} accessibilityRole="button">
          <Text style={[styles.link, { color: colors.accent }]}>
            Could not load references. Tap to retry.
          </Text>
        </Pressable>
      ) : items.length === 0 ? (
        <Text style={[styles.empty, { color: colors.muted }]}>{emptyText}</Text>
      ) : (
        items.map((item) => (
          <View key={item.id} style={[styles.card, { backgroundColor: colors.surface }]}>
            <View style={styles.author}>
              <Avatar uri={item.author.avatarUrl} name={item.author.displayName} size={32} />
              <View style={styles.flex}>
                <Text style={[styles.authorName, { color: colors.text }]} numberOfLines={1}>
                  {item.author.displayName}
                </Text>
                <Text style={[styles.date, { color: colors.muted }]}>
                  {new Date(item.createdAt).toLocaleDateString()}
                </Text>
              </View>
              <StarRating value={item.rating} size={14} />
            </View>
            <Text style={[styles.body, { color: colors.text }]}>{item.body}</Text>
          </View>
        ))
      )}

      {references.hasNextPage ? (
        <Pressable
          onPress={() => void references.fetchNextPage()}
          disabled={references.isFetchingNextPage}
          accessibilityRole="button"
        >
          <Text style={[styles.link, { color: colors.accent }]}>
            {references.isFetchingNextPage ? "Loading…" : "Show more"}
          </Text>
        </Pressable>
      ) : null}

      {!isSelf && first?.canWrite ? (
        <Pressable
          onPress={() => setEditing(true)}
          style={[styles.writeBtn, { borderColor: colors.accent }]}
          accessibilityRole="button"
        >
          <Text style={[styles.writeText, { color: colors.accent }]}>
            {mine ? "Edit your reference" : "Write a reference"}
          </Text>
        </Pressable>
      ) : null}

      {!isSelf ? (
        <ReferenceModal
          visible={editing}
          name={name}
          initialBody={mine?.body ?? ""}
          initialRating={mine?.rating ?? 0}
          saving={save.isPending || remove.isPending}
          error={error}
          onSave={(input) =>
            save.mutate(input, {
              onSuccess: close,
              onError: (err) =>
                setError(referenceErrorMessage(err, "Could not save. Please try again.")),
            })
          }
          onDelete={mine ? confirmDelete : undefined}
          onClose={close}
        />
      ) : null}
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  empty: { fontSize: 15, lineHeight: 21 },
  link: { fontWeight: "600" },
  card: { borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm },
  author: { flexDirection: "row", alignItems: "center", gap: 10 },
  authorName: { fontSize: 15, fontWeight: "700" },
  date: { fontSize: 12 },
  body: { fontSize: 15, lineHeight: 22 },
  writeBtn: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  writeText: { fontSize: 15, fontWeight: "700" },
});
