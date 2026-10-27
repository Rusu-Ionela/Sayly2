import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { PartyRoomSummaryDto } from "@sayly/shared";
import { FlashList, type ListRenderItem } from "@shopify/flash-list";
import { useCallback } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { isApiError } from "@/lib/api/errors";
import type { AppStackParamList } from "@/navigation/types";
import { Button } from "@/shared/components/Button";
import { Screen } from "@/shared/components/Screen";
import { WarmEmptyState } from "@/shared/components/WarmEmptyState";
import { WarmErrorState } from "@/shared/components/WarmErrorState";
import { useColors } from "@/shared/theme";
import { spacing } from "@/shared/theme/spacing";

import { PartyRoomCard } from "../components/PartyRoomCard";
import { usePartyRooms } from "../hooks/usePartyRooms";

/** Open live rooms (group rooms are listed on their group's screen). */
export function PartyRoomsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const colors = useColors();
  const rooms = usePartyRooms({});

  const open = useCallback(
    (room: PartyRoomSummaryDto) => navigation.navigate("PartyRoom", { roomId: room.id }),
    [navigation],
  );
  const renderItem = useCallback<ListRenderItem<PartyRoomSummaryDto>>(
    ({ item }) => <PartyRoomCard room={item} onOpen={open} />,
    [open],
  );

  return (
    <Screen padded={false} includeBottomInset>
      {rooms.isError && !rooms.data ? (
        <WarmErrorState
          title="Could not load rooms"
          body={
            isApiError(rooms.error) ? rooms.error.message : "Check your connection and try again."
          }
          onAction={() => void rooms.refetch()}
        />
      ) : (
        <FlashList
          data={rooms.data ?? []}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={Separator}
          onRefresh={() => void rooms.refetch()}
          refreshing={rooms.isRefetching}
          ListEmptyComponent={
            rooms.isPending ? (
              <ActivityIndicator color={colors.accent} style={styles.loading} />
            ) : (
              <WarmEmptyState
                title="No rooms live right now 🎙️"
                body="Start one: you host, others listen in and raise a hand to speak."
              />
            )
          }
        />
      )}
      <View style={styles.footer}>
        <Button label="Start a room" onPress={() => navigation.navigate("CreatePartyRoom")} />
      </View>
    </Screen>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  list: { padding: spacing.md, flexGrow: 1 },
  separator: { height: spacing.sm + 4 },
  loading: { marginTop: spacing.xl },
  footer: { padding: spacing.md },
});
