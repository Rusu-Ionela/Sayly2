import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { PARTY_MAX_SPEAKERS, PARTY_TITLE_MAX, PARTY_TITLE_MIN } from "@sayly/shared";
import { useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";

import { usePracticeLanguages } from "@/features/icebreakers/hooks";
import { isApiError } from "@/lib/api/errors";
import type { AppStackParamList } from "@/navigation/types";
import { Button } from "@/shared/components/Button";
import { Chip } from "@/shared/components/Chip";
import { Screen } from "@/shared/components/Screen";
import { TextField } from "@/shared/components/TextField";
import { useColors } from "@/shared/theme";
import { spacing } from "@/shared/theme/spacing";

import { useCreatePartyRoom } from "../hooks/usePartyRooms";

/** Title and language. A room started from a group is in the group's language. */
export function CreatePartyRoomScreen() {
  const route = useRoute<RouteProp<AppStackParamList, "CreatePartyRoom">>();
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const colors = useColors();
  const group = route.params?.group;
  const practice = usePracticeLanguages();
  const create = useCreatePartyRoom();
  const [title, setTitle] = useState("");
  const [picked, setPicked] = useState<string | null>(null);

  const languageId = group?.languageId ?? picked ?? practice[0]?.id ?? null;
  const trimmed = title.trim();
  const valid = trimmed.length >= PARTY_TITLE_MIN && languageId !== null;

  const goLive = () => {
    if (!languageId) return;
    create.mutate(
      { title: trimmed, languageId, groupId: group?.id },
      {
        onSuccess: ({ id }) => navigation.replace("PartyRoom", { roomId: id }),
        onError: (error) =>
          Alert.alert(
            "Could not start the room",
            isApiError(error) ? error.message : "Please try again.",
          ),
      },
    );
  };

  return (
    <Screen includeBottomInset>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <TextField
          label="What's the room about?"
          value={title}
          onChangeText={setTitle}
          placeholder="e.g. Coffee chat in Spanish ☕"
          maxLength={PARTY_TITLE_MAX}
          showCounter
          autoFocus
        />

        <View style={styles.block}>
          <Text style={[styles.label, { color: colors.text }]}>Language</Text>
          {group ? (
            <Chip tone="soft" icon="people" label={`${group.languageLabel} · ${group.name}`} />
          ) : practice.length === 0 ? (
            <Text style={[styles.hint, { color: colors.muted }]}>
              Add a language you’re learning in your profile to host a room.
            </Text>
          ) : (
            <View style={styles.chips}>
              {practice.map((language) => (
                <Chip
                  key={language.id}
                  label={`${language.flagEmoji ?? ""} ${language.name}`.trim()}
                  selected={language.id === languageId}
                  onPress={() => setPicked(language.id)}
                />
              ))}
            </View>
          )}
        </View>

        <Text style={[styles.hint, { color: colors.muted }]}>
          You’ll be the host. Listeners can raise a hand, and you can invite up to{" "}
          {PARTY_MAX_SPEAKERS - 1} of them on stage.
        </Text>

        <Button label="Go live" disabled={!valid} loading={create.isPending} onPress={goLive} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.lg, paddingVertical: spacing.md },
  block: { gap: spacing.sm },
  label: { fontSize: 15, fontWeight: "700" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  hint: { fontSize: 13, fontWeight: "500", lineHeight: 19 },
});
