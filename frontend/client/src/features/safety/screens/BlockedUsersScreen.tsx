import { FlashList } from "@shopify/flash-list";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";

import { Screen } from "@/shared/components/Screen";
import { WarmEmptyState } from "@/shared/components/WarmEmptyState";
import { useColors } from "@/shared/theme";
import { spacing } from "@/shared/theme/spacing";
import { getTypography } from "@/shared/theme/typography";

import { useBlockedUsers, useUnblockUser } from "../hooks/useSafety";

export function BlockedUsersScreen() {
  const colors = useColors();
  const type = getTypography(colors);
  const blocksQuery = useBlockedUsers();
  const unblock = useUnblockUser();

  const items = blocksQuery.data?.items ?? [];

  return (
    <Screen includeBottomInset>
      <Text style={type.screenTitle}>Blocked users</Text>
      <Text style={[type.screenSubtitle, { marginTop: 4, marginBottom: spacing.md }]}>
        Unblock someone to see them in Discover again.
      </Text>

      {blocksQuery.isLoading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.lg }} />
      ) : blocksQuery.isError ? (
        <View style={styles.centered}>
          <Text style={{ color: colors.rose, fontWeight: "700" }}>
            Could not load blocked users.
          </Text>
          <Pressable onPress={() => void blocksQuery.refetch()}>
            <Text style={{ color: colors.accent, fontWeight: "800", marginTop: 8 }}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <FlashList
          showsVerticalScrollIndicator={false}
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <WarmEmptyState
              title="No blocked users"
              body="People you block disappear from Discover and messaging."
            />
          }
          renderItem={({ item }) => (
            <View
              style={[styles.row, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
            >
              <View style={styles.copy}>
                <Text style={[styles.name, { color: colors.text }]}>{item.user.displayName}</Text>
                <Text style={{ color: colors.muted }}>
                  {item.user.country || "Unknown country"}
                </Text>
              </View>
              <Pressable
                onPress={() => {
                  Alert.alert("Unblock user", `Unblock ${item.user.displayName}?`, [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Unblock",
                      onPress: () =>
                        unblock.mutate(item.user.id, {
                          onError: () => Alert.alert("Could not unblock", "Please try again."),
                        }),
                    },
                  ]);
                }}
                disabled={unblock.isPending}
                accessibilityRole="button"
                accessibilityLabel={`Unblock ${item.user.displayName}`}
              >
                <Text style={{ color: colors.accent, fontWeight: "800" }}>Unblock</Text>
              </Pressable>
            </View>
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: {
    flexGrow: 1,
    gap: spacing.sm,
    paddingBottom: spacing.xl,
  },
  row: {
    borderWidth: 1,
    borderRadius: 16,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontWeight: "800",
    fontSize: 16,
  },
  centered: {
    alignItems: "center",
    marginTop: spacing.xl,
  },
});
