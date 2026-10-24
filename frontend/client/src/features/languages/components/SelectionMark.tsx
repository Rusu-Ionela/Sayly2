import { StyleSheet, View } from "react-native";

import { useColors } from "@/shared/theme";

type SelectionMarkProps = {
  selected: boolean;
};

export function SelectionMark({ selected }: SelectionMarkProps) {
  const colors = useColors();

  return (
    <View
      style={[
        styles.outer,
        {
          borderColor: selected ? colors.primary : colors.border,
        },
      ]}
    >
      {selected ? (
        <View
          style={[
            styles.inner,
            {
              backgroundColor: colors.primary,
            },
          ]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  inner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});
