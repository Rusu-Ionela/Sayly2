import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, View } from "react-native";

import { useColors } from "@/shared/theme";

import { RATING_LABELS, RATING_MAX } from "../model/referenceSummary";

type StarRatingProps = {
  value: number;
  size?: number;
  /** Pass to make the stars tappable. */
  onChange?: (rating: number) => void;
};

const STARS = Array.from({ length: RATING_MAX }, (_, index) => index + 1);

/** 1–5 stars: read-only on a reference card, tappable in the editor. */
export function StarRating({ value, size = 16, onChange }: StarRatingProps) {
  const colors = useColors();

  if (!onChange) {
    return (
      <View
        style={styles.row}
        accessible
        accessibilityLabel={`${value} out of ${RATING_MAX} stars`}
      >
        {STARS.map((star) => (
          <Ionicons
            key={star}
            name={star <= value ? "star" : "star-outline"}
            size={size}
            color={colors.pro}
          />
        ))}
      </View>
    );
  }

  return (
    <View style={styles.row} accessibilityRole="adjustable" accessibilityLabel="Rating">
      {STARS.map((star) => (
        <Pressable
          key={star}
          onPress={() => onChange(star)}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityState={{ selected: star === value }}
          accessibilityLabel={`${star} ${star === 1 ? "star" : "stars"}: ${RATING_LABELS[star]}`}
        >
          <Ionicons name={star <= value ? "star" : "star-outline"} size={size} color={colors.pro} />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
});
