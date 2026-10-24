import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import type { AppStackParamList } from "@/navigation/types";
import { MemberRow } from "@/shared/components/MemberRow";
import { Screen } from "@/shared/components/Screen";
import { SectionCard } from "@/shared/components/SectionCard";
import { WarmEmptyState } from "@/shared/components/WarmEmptyState";
import { WarmErrorState } from "@/shared/components/WarmErrorState";
import { WarmLoadingView } from "@/shared/components/WarmLoadingView";
import { useColors } from "@/shared/theme";
import { radius } from "@/shared/theme/radius";
import { spacing } from "@/shared/theme/spacing";

import type { Connection } from "../api/connectionsApi";
import { useConnectionAction, useConnections } from "../hooks/useConnections";

type Nav = NativeStackNavigationProp<AppStackParamList>;

function RequestRow({ connection }: { connection: Connection }) {
  const navigation = useNavigation<Nav>();
  const colors = useColors();
  const actions = useConnectionAction(connection.member.id);
  const busy = actions.respond.isPending;
  const action = (kind: "ACCEPT" | "DECLINE" | "CANCEL" | "REMOVE") => {
    actions.respond.mutate(
      { id: connection.id, action: kind },
      { onError: () => Alert.alert("Could not update connection", "Please try again.") },
    );
  };

  const trailing =
    connection.status === "ACCEPTED" ? (
      <View style={styles.actions}>
        <Text style={[styles.connected, { color: colors.accent }]}>Connected</Text>
        <Pressable
          disabled={busy}
          style={[styles.action, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
          onPress={() =>
            Alert.alert(
              "Remove connection",
              "You will keep your conversation history, but this person will no longer be an active connection.",
              [
                { text: "Cancel", style: "cancel" },
                { text: "Remove", style: "destructive", onPress: () => action("REMOVE") },
              ],
            )
          }
          accessibilityRole="button"
          accessibilityLabel={`Remove connection with ${connection.member.displayName}`}
        >
          <Text style={[styles.actionLabel, { color: colors.rose }]}>Remove</Text>
        </Pressable>
      </View>
    ) : connection.direction === "INCOMING" ? (
      <View style={styles.actions}>
        <Pressable
          disabled={busy}
          style={[
            styles.action,
            { backgroundColor: colors.accentSoft, borderColor: colors.accent },
          ]}
          onPress={() => action("DECLINE")}
          accessibilityRole="button"
          accessibilityLabel={`Decline ${connection.member.displayName}`}
        >
          <Text style={[styles.actionLabel, { color: colors.accent }]}>Decline</Text>
        </Pressable>
        <Pressable
          disabled={busy}
          style={[styles.action, { backgroundColor: colors.accent, borderColor: colors.accent }]}
          onPress={() => action("ACCEPT")}
          accessibilityRole="button"
          accessibilityLabel={`Accept ${connection.member.displayName}`}
        >
          <Text style={[styles.actionLabel, { color: colors.onPrimary }]}>Accept</Text>
        </Pressable>
      </View>
    ) : (
      <Pressable
        disabled={busy}
        style={[styles.action, { backgroundColor: colors.accentSoft, borderColor: colors.accent }]}
        onPress={() => action("CANCEL")}
        accessibilityRole="button"
        accessibilityLabel={`Cancel request to ${connection.member.displayName}`}
      >
        <Text style={[styles.actionLabel, { color: colors.accent }]}>Cancel</Text>
      </Pressable>
    );

  return (
    <View>
      <MemberRow
        member={connection.member}
        onPress={() => navigation.navigate("PublicProfile", { userId: connection.member.id })}
        trailing={trailing}
      />
      {connection.introMessage ? (
        <Text style={[styles.message, { color: colors.muted }]} numberOfLines={2}>
          “{connection.introMessage}”
        </Text>
      ) : null}
    </View>
  );
}

function ConnectionSection({ title, items }: { title: string; items: Connection[] }) {
  if (!items.length) return null;
  return (
    <SectionCard title={title} variant="content">
      {items.map((connection) => (
        <RequestRow key={connection.id} connection={connection} />
      ))}
    </SectionCard>
  );
}

/** Incoming/outgoing request inbox, plus accepted language partners. */
export function ConnectionsScreen() {
  const query = useConnections();

  if (query.isPending) {
    return (
      <Screen includeBottomInset>
        <WarmLoadingView />
      </Screen>
    );
  }
  if (query.isError || !query.data) {
    return (
      <Screen includeBottomInset>
        <WarmErrorState
          title="Could not load connections"
          body="Check your connection and try again."
          onAction={() => void query.refetch()}
        />
      </Screen>
    );
  }

  const { incoming, outgoing, accepted } = query.data;
  if (!incoming.length && !outgoing.length && !accepted.length) {
    return (
      <Screen includeBottomInset>
        <WarmEmptyState
          title="No connections yet"
          body="Send a Connect request from a member’s profile to start practising together."
        />
      </Screen>
    );
  }

  return (
    <Screen includeBottomInset>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ConnectionSection title="Requests for you" items={incoming} />
        <ConnectionSection title="Sent requests" items={outgoing} />
        <ConnectionSection title="Your connections" items={accepted} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xl },
  actions: { flexDirection: "row", gap: spacing.xs },
  action: {
    borderWidth: 1,
    borderRadius: radius.pill,
    minHeight: 34,
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
  },
  actionLabel: { fontSize: 12, fontWeight: "700" },
  connected: { fontSize: 13, fontWeight: "700" },
  message: { fontSize: 13, lineHeight: 18, marginHorizontal: spacing.sm, marginTop: -spacing.xs },
});
