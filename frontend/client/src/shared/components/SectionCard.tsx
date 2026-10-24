import { Children, Fragment, isValidElement, memo, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useColors } from "@/shared/theme";
import { radius } from "@/shared/theme/radius";
import { spacing } from "@/shared/theme/spacing";

type SectionCardProps = {
  title?: string;
  /** Small print under the card (e.g. what a privacy toggle does). */
  footer?: string;
  /** Right side of the title row (e.g. an "Edit" link). */
  action?: ReactNode;
  /** `rows`: hairline dividers between children (lists). `content`: padded free layout. */
  variant?: "rows" | "content";
  children: ReactNode;
};

/** Titled, rounded group — the single grouping primitive of Profile and Settings. */
export const SectionCard = memo(function SectionCard({
  title,
  footer,
  action,
  variant = "rows",
  children,
}: SectionCardProps) {
  const colors = useColors();
  const items = Children.toArray(children).filter(isValidElement);

  if (items.length === 0) {
    return null;
  }

  return (
    <View style={styles.section}>
      {title || action ? (
        <View style={styles.header}>
          {title ? <Text style={[styles.title, { color: colors.muted }]}>{title}</Text> : <View />}
          {action}
        </View>
      ) : null}

      <View
        style={[
          styles.card,
          variant === "content" && styles.content,
          { backgroundColor: colors.card, borderColor: colors.cardBorder },
        ]}
      >
        {variant === "rows"
          ? items.map((item, index) => (
              <Fragment key={item.key ?? index}>
                {index > 0 ? (
                  <View style={[styles.divider, { backgroundColor: colors.border }]} />
                ) : null}
                {item}
              </Fragment>
            ))
          : items}
      </View>

      {footer ? <Text style={[styles.footer, { color: colors.muted }]}>{footer}</Text> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  section: {
    marginTop: spacing.lg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  title: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: "hidden",
  },
  content: {
    padding: spacing.md,
    gap: spacing.md,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 60,
  },
  footer: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 6,
    paddingHorizontal: spacing.xs,
  },
});
