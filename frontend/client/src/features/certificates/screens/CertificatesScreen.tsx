import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { CertificateList } from "@/features/profile/components/CertificateList";
import { useProfile, useUpdateSettings } from "@/features/profile/hooks/useProfile";
import { certificateRows } from "@/features/profile/model/certificates";
import type { AppStackParamList } from "@/navigation/types";
import { Button } from "@/shared/components/Button";
import { Screen } from "@/shared/components/Screen";
import { SectionCard } from "@/shared/components/SectionCard";
import { SegmentedControl } from "@/shared/components/SegmentedControl";
import { SettingRow } from "@/shared/components/SettingRow";
import { Skeleton } from "@/shared/components/Skeleton";
import { WarmErrorState } from "@/shared/components/WarmErrorState";
import { useColors } from "@/shared/theme";
import { radius } from "@/shared/theme/radius";
import { spacing } from "@/shared/theme/spacing";

import type { CertificateTest } from "../api/certificatesApi";
import { FaqItem } from "@/shared/components/FaqItem";
import { useCertificateOffers } from "../hooks/useCertificateOffers";
import {
  CERTIFICATE_FAQ,
  discountPercent,
  formatPrice,
  recommendedTestLevel,
  TEST_LEVELS,
  WHAT_YOU_GET,
  type TestLevel,
} from "../model/certificateContent";

const TABS = [
  { id: "get", label: "Get certificate" },
  { id: "mine", label: "Your certificates" },
] as const;

function OffersSkeleton() {
  return (
    <View style={styles.gap}>
      <Skeleton height={150} radius={radius.xl} />
      <Skeleton height={64} radius={radius.lg} />
      <Skeleton height={64} radius={radius.lg} />
    </View>
  );
}

function Fact({
  icon,
  label,
}: {
  icon: "globe-outline" | "time-outline" | "flash-outline";
  label: string;
}) {
  const colors = useColors();
  return (
    <View style={[styles.fact, { backgroundColor: colors.inputBg }]}>
      <Ionicons name={icon} size={16} color={colors.accent} />
      <Text style={[styles.factText, { color: colors.text }]}>{label}</Text>
    </View>
  );
}

/** Get a language certificate (level tests) and manage the certificates you have. */
export function CertificatesScreen() {
  const colors = useColors();
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const route = useRoute<RouteProp<AppStackParamList, "Certificates">>();
  const [tab, setTab] = useState<"get" | "mine">(route.params?.tab ?? "get");

  const profileQuery = useProfile();
  const offersQuery = useCertificateOffers();
  const { save } = useUpdateSettings({
    onError: (message) => Alert.alert("Could not update setting", message),
  });

  const profile = profileQuery.data;
  const learning = profile?.learningLanguages[0];
  const recommended = recommendedTestLevel(learning?.proficiency);
  const [picked, setPicked] = useState<TestLevel | null>(null);
  const level = picked ?? recommended;

  const tests = offersQuery.data?.tests ?? [];
  const selected: CertificateTest | undefined = tests.find((test) => test.level === level);
  const certificates = useMemo(
    () => certificateRows(profile?.certificates ?? []),
    [profile?.certificates],
  );

  const takeTest = () => {
    if (!selected) return;
    Alert.alert(
      learning ? `${selected.level} ${learning.name} test` : `${selected.level} test`,
      offersQuery.data?.purchasable
        ? "Checkout opens next."
        : "Language tests open soon. We will let you know as soon as you can book yours.",
    );
  };

  const getTab = offersQuery.isPending ? (
    <OffersSkeleton />
  ) : !offersQuery.data || !selected ? (
    <WarmErrorState
      title="Could not load the tests"
      body="Check your connection and try again."
      onAction={() => void offersQuery.refetch()}
    />
  ) : (
    <View style={styles.gap}>
      <LinearGradient
        colors={["#0EA5E9", colors.accent]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <Ionicons name="shield-checkmark" size={30} color="#FFFFFF" />
        <Text style={styles.heroTitle}>
          Get your {selected.level} certificate{learning ? ` in ${learning.name}` : ""}
        </Text>
        <Text style={styles.heroBody}>
          Prove your level to partners, schools and employers with an official-style test.
        </Text>
      </LinearGradient>

      <SectionCard title="Choose your level" variant="content">
        <View style={styles.levels}>
          {TEST_LEVELS.map((item) => {
            const active = item === level;
            return (
              <Pressable
                key={item}
                onPress={() => setPicked(item)}
                style={[
                  styles.level,
                  {
                    backgroundColor: active ? colors.accent : colors.inputBg,
                    borderColor: active ? colors.accent : colors.cardBorder,
                  },
                ]}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`${item}${item === recommended ? ", recommended" : ""}`}
              >
                <Text
                  style={[styles.levelText, { color: active ? colors.onPrimary : colors.text }]}
                >
                  {item}
                </Text>
                {item === recommended ? (
                  <Text
                    style={[styles.levelHint, { color: active ? colors.onPrimary : colors.accent }]}
                  >
                    For you
                  </Text>
                ) : null}
              </Pressable>
            );
          })}
        </View>
        <Text style={[styles.levelName, { color: colors.text }]}>
          {selected.level} · {selected.name}
        </Text>
        <Text style={[styles.body, { color: colors.muted }]}>{selected.summary}</Text>
        <View style={styles.facts}>
          <Fact icon="globe-outline" label="Online" />
          <Fact icon="time-outline" label={`${selected.durationMinutes} minutes`} />
          {selected.instantResult ? <Fact icon="flash-outline" label="Instant result" /> : null}
        </View>
      </SectionCard>

      <SectionCard title="What you get">
        {WHAT_YOU_GET.map((item) => (
          <View key={item.title} style={styles.benefit}>
            <Ionicons name={item.icon} size={22} color={colors.accent} />
            <View style={styles.benefitCopy}>
              <Text style={[styles.benefitTitle, { color: colors.text }]}>{item.title}</Text>
              <Text style={[styles.body, { color: colors.muted }]}>{item.body}</Text>
            </View>
          </View>
        ))}
      </SectionCard>

      <SectionCard title="Questions">
        {CERTIFICATE_FAQ.map((item) => (
          <FaqItem key={item.question} question={item.question} answer={item.answer} />
        ))}
      </SectionCard>
    </View>
  );

  const mineTab = (
    <View>
      <SectionCard
        title="Your certificates"
        variant="content"
        footer={
          certificates.length
            ? "Certificates you add yourself are marked as self-reported."
            : undefined
        }
      >
        {certificates.length ? (
          <CertificateList items={certificates} />
        ) : (
          <Text style={[styles.body, { color: colors.muted }]}>
            No certificates yet. Take a test, or add one you already have.
          </Text>
        )}
        <Pressable
          onPress={() => navigation.navigate("EditProfile")}
          style={styles.inlineLink}
          accessibilityRole="button"
          accessibilityLabel="Add a certificate you already have"
        >
          <Ionicons name="add-circle-outline" size={20} color={colors.accent} />
          <Text style={[styles.link, { color: colors.accent }]}>
            Add a certificate you already have
          </Text>
        </Pressable>
      </SectionCard>

      {profile ? (
        <SectionCard footer="When off, partners don't see your certificates.">
          <SettingRow
            kind="toggle"
            icon="eye-outline"
            title="Show certificates on my profile"
            value={profile.settings.showCertificates}
            onValueChange={(next) => save({ showCertificates: next })}
          />
        </SectionCard>
      ) : null}

      <SectionCard title="Purchase history" variant="content">
        <View style={styles.emptyHistory}>
          <Ionicons name="receipt-outline" size={22} color={colors.muted} />
          <Text style={[styles.body, { color: colors.muted }]}>
            No purchases yet. Tests you book will appear here.
          </Text>
        </View>
      </SectionCard>
    </View>
  );

  const price = selected?.price;
  const discount = price ? discountPercent(price) : 0;

  return (
    <Screen includeBottomInset>
      <SegmentedControl options={TABS} value={tab} onChange={setTab} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {tab === "get" ? getTab : mineTab}
      </ScrollView>

      {tab === "get" && selected && price ? (
        <View style={[styles.checkout, { borderTopColor: colors.border }]}>
          <View style={styles.priceRow}>
            <Text style={[styles.price, { color: colors.text }]}>
              {formatPrice(price.amountMinor, price.currency)}
            </Text>
            {discount > 0 ? (
              <>
                <Text style={[styles.oldPrice, { color: colors.muted }]}>
                  {formatPrice(price.originalAmountMinor, price.currency)}
                </Text>
                <View style={[styles.discount, { backgroundColor: colors.proSoft }]}>
                  <Text style={[styles.discountText, { color: colors.pro }]}>-{discount}%</Text>
                </View>
              </>
            ) : null}
          </View>
          <Button label="Take the test" onPress={takeTest} />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  content: {
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  gap: {
    gap: spacing.xs,
  },
  hero: {
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  heroTitle: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "800",
    lineHeight: 30,
  },
  heroBody: {
    color: "rgba(255,255,255,0.88)",
    fontSize: 15,
    lineHeight: 21,
  },
  levels: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  level: {
    flex: 1,
    minHeight: 64,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  levelText: {
    fontSize: 20,
    fontWeight: "800",
  },
  levelHint: {
    fontSize: 11,
    fontWeight: "700",
  },
  levelName: {
    fontSize: 17,
    fontWeight: "800",
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    flexShrink: 1,
  },
  facts: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  fact: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  factText: {
    fontSize: 13,
    fontWeight: "600",
  },
  benefit: {
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.md,
  },
  benefitCopy: {
    flex: 1,
    gap: 2,
  },
  benefitTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  inlineLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: 40,
  },
  link: {
    fontSize: 15,
    fontWeight: "700",
  },
  emptyHistory: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  checkout: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  price: {
    fontSize: 24,
    fontWeight: "800",
  },
  oldPrice: {
    fontSize: 16,
    textDecorationLine: "line-through",
  },
  discount: {
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  discountText: {
    fontSize: 12,
    fontWeight: "800",
  },
});
