import { type ReactElement } from "react";
import { ActivityIndicator, FlatList, StyleSheet, View } from "react-native";

import { AppRefreshControl } from "@/shared/components/AppRefreshControl";
import { Skeleton } from "@/shared/components/Skeleton";
import { WarmErrorState } from "@/shared/components/WarmErrorState";
import { useColors } from "@/shared/theme";
import { spacing } from "@/shared/theme/spacing";

/** The slice of a TanStack infinite query the list needs. */
type PagedListState = {
  isPending: boolean;
  isError: boolean;
  isRefetching: boolean;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  refetch: () => unknown;
  fetchNextPage: () => unknown;
};

type MemberListProps<TItem> = {
  state: PagedListState;
  items: TItem[];
  keyOf: (item: TItem) => string;
  renderItem: (item: TItem) => ReactElement;
  header?: ReactElement | null;
  empty: ReactElement;
  errorTitle: string;
};

function SkeletonRows() {
  return (
    <View style={styles.list}>
      {[0, 1, 2, 3, 4].map((key) => (
        <View key={key} style={styles.skeletonRow}>
          <Skeleton width={52} height={52} radius={26} />
          <View style={styles.skeletonCopy}>
            <Skeleton width="55%" height={16} />
            <Skeleton width="80%" height={12} />
          </View>
        </View>
      ))}
    </View>
  );
}

/** Paged list of members: skeleton, pull to refresh, infinite scroll, empty and error states. */
export function MemberList<TItem>({
  state,
  items,
  keyOf,
  renderItem,
  header,
  empty,
  errorTitle,
}: MemberListProps<TItem>) {
  const colors = useColors();

  if (state.isPending) {
    return (
      <>
        {header}
        <SkeletonRows />
      </>
    );
  }

  if (state.isError && items.length === 0) {
    return (
      <WarmErrorState
        title={errorTitle}
        body="Check your connection and try again."
        onAction={() => void state.refetch()}
      />
    );
  }

  return (
    <FlatList
      data={items}
      keyExtractor={keyOf}
      renderItem={({ item }) => renderItem(item)}
      ListHeaderComponent={header}
      ListEmptyComponent={empty}
      contentContainerStyle={styles.list}
      showsVerticalScrollIndicator={false}
      onEndReachedThreshold={0.4}
      onEndReached={() => {
        if (state.hasNextPage && !state.isFetchingNextPage) void state.fetchNextPage();
      }}
      ListFooterComponent={
        state.isFetchingNextPage ? (
          <ActivityIndicator color={colors.accent} style={styles.footer} />
        ) : null
      }
      refreshControl={
        <AppRefreshControl
          refreshing={state.isRefetching && !state.isFetchingNextPage}
          onRefresh={() => void state.refetch()}
        />
      }
    />
  );
}

const styles = StyleSheet.create({
  list: {
    flexGrow: 1,
    gap: spacing.sm,
    paddingBottom: spacing.xl,
  },
  skeletonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: 12,
  },
  skeletonCopy: {
    flex: 1,
    gap: 8,
  },
  footer: {
    marginVertical: spacing.md,
  },
});
