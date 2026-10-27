import { Ionicons } from "@expo/vector-icons";
import {
  STORY_CAPTION_MAX,
  STORY_TEXT_MAX,
  STORY_VOICE_MAX_MS,
  type StoryMediaType,
} from "@sayly/shared";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { PracticeLanguage } from "@/features/icebreakers/hooks";
import { compressImage, pickImage } from "@/features/profile/model/imageCompression";
import type { RecordedNote } from "@/features/pulse/api";
import { formatCountdown } from "@/features/pulse/model";
import { useVoiceNoteRecorder } from "@/features/pulse/voiceRecorder";
import { radius } from "@/shared/theme/radius";
import { spacing } from "@/shared/theme/spacing";

import type { StoryDraft } from "../api";
import { useCreateStory } from "../hooks";
import { storyPalette, textStoryBackgrounds } from "../palette";

/** Long edge of an uploaded story photo; plenty for a phone screen, small to upload. */
const PHOTO_MAX_EDGE = 1440;

const MODES: readonly {
  id: StoryMediaType;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { id: "TEXT", label: "Text", icon: "text" },
  { id: "PHOTO", label: "Photo", icon: "image" },
  { id: "VOICE", label: "Voice", icon: "mic" },
];

type StoryComposerProps = {
  visible: boolean;
  languages: PracticeLanguage[];
  onClose: () => void;
};

/** "Add Instant": write, snap or say something in a language you're learning, for 24 hours. */
export function StoryComposer({ visible, languages, onClose }: StoryComposerProps) {
  const insets = useSafeAreaInsets();
  const create = useCreateStory();
  const [mode, setMode] = useState<StoryMediaType>("TEXT");
  const [languageId, setLanguageId] = useState<string | undefined>(languages[0]?.id);
  const [text, setText] = useState("");
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [note, setNote] = useState<RecordedNote | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const language = languages.find((item) => item.id === languageId) ?? languages[0];

  useEffect(() => {
    if (!visible) return;
    setMode("TEXT");
    setText("");
    setPhotoUri(null);
    setCaption("");
    setNote(null);
    setProblem(null);
    create.reset();
    // Only on open; `create` is a new object every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const draft: StoryDraft | null = !language
    ? null
    : mode === "TEXT"
      ? text.trim()
        ? { kind: "TEXT", text: text.trim(), targetLanguage: language.id }
        : null
      : mode === "PHOTO"
        ? photoUri
          ? { kind: "PHOTO", uri: photoUri, caption, targetLanguage: language.id }
          : null
        : note
          ? { kind: "VOICE", note, targetLanguage: language.id }
          : null;

  const share = () => {
    if (!draft || create.isPending) return;
    setProblem(null);
    create.mutate(draft, {
      onSuccess: () => {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
          () => undefined,
        );
        onClose();
      },
      // Shown in the sheet: an Alert over a Modal is easy to miss on iOS.
      onError: (error) =>
        setProblem(error instanceof Error ? error.message : "Could not share. Please try again."),
    });
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={[styles.fill, { backgroundColor: storyPalette.backdrop }]}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View
          style={[
            styles.fill,
            { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + spacing.sm },
          ]}
        >
          <View style={styles.topBar}>
            <Pressable
              onPress={onClose}
              hitSlop={12}
              style={styles.iconButton}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Ionicons name="close" size={26} color={storyPalette.white} />
            </Pressable>
            <Text style={styles.title}>New Instant</Text>
            <View style={styles.iconButton} />
          </View>

          <View style={styles.modes} accessibilityRole="tablist">
            {MODES.map((item) => {
              const active = item.id === mode;
              return (
                <Pressable
                  key={item.id}
                  onPress={() => {
                    setMode(item.id);
                    setProblem(null);
                  }}
                  style={[styles.modeChip, active && styles.modeChipActive]}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                >
                  <Ionicons name={item.icon} size={16} color={storyPalette.white} />
                  <Text style={styles.chipText}>{item.label}</Text>
                </Pressable>
              );
            })}
          </View>

          {!language ? (
            <View style={[styles.stage, styles.centered]}>
              <Ionicons name="language" size={40} color={storyPalette.muted} />
              <Text style={styles.hint}>
                Add a language you’re learning to your profile to post Instants.
              </Text>
            </View>
          ) : (
            <>
              {languages.length > 1 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.languageScroll}
                  contentContainerStyle={styles.languageRow}
                >
                  {languages.map((item) => {
                    const active = item.id === language.id;
                    return (
                      <Pressable
                        key={item.id}
                        onPress={() => setLanguageId(item.id)}
                        style={[styles.languageChip, active && styles.modeChipActive]}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        accessibilityLabel={`Post in ${item.name}`}
                      >
                        <Text style={styles.chipText}>
                          {item.flagEmoji ? `${item.flagEmoji} ` : ""}
                          {item.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              ) : null}

              <View style={styles.stage}>
                {mode === "TEXT" ? (
                  <TextEditor value={text} onChange={setText} languageName={language.name} />
                ) : mode === "PHOTO" ? (
                  <PhotoEditor
                    uri={photoUri}
                    caption={caption}
                    onPicked={setPhotoUri}
                    onCaption={setCaption}
                    onProblem={setProblem}
                  />
                ) : (
                  <VoiceEditor
                    note={note}
                    onRecorded={setNote}
                    onProblem={setProblem}
                    languageName={language.name}
                  />
                )}
              </View>
            </>
          )}

          <View style={styles.footer}>
            {problem ? (
              <Text style={styles.problem} accessibilityLiveRegion="polite">
                {problem}
              </Text>
            ) : null}
            <Pressable
              onPress={share}
              disabled={!draft || create.isPending}
              style={({ pressed }) => [
                styles.shareButton,
                (!draft || create.isPending) && styles.disabled,
                pressed && { opacity: 0.85 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Share Instant"
            >
              {create.isPending ? (
                <ActivityIndicator color={storyPalette.white} />
              ) : (
                <>
                  <Ionicons name="paper-plane" size={18} color={storyPalette.white} />
                  <Text style={styles.shareText}>Share for 24h</Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function TextEditor({
  value,
  onChange,
  languageName,
}: {
  value: string;
  onChange: (value: string) => void;
  languageName: string;
}) {
  return (
    <LinearGradient
      colors={textStoryBackgrounds[0]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[StyleSheet.absoluteFill, styles.centered]}
    >
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={`Write something in ${languageName}…`}
        placeholderTextColor="rgba(255, 255, 255, 0.6)"
        maxLength={STORY_TEXT_MAX}
        multiline
        autoFocus
        textAlign="center"
        style={styles.textInput}
        accessibilityLabel="Instant text"
      />
      <Text style={styles.counter}>
        {value.length}/{STORY_TEXT_MAX}
      </Text>
    </LinearGradient>
  );
}

type PhotoEditorProps = {
  uri: string | null;
  caption: string;
  onPicked: (uri: string | null) => void;
  onCaption: (caption: string) => void;
  onProblem: (problem: string | null) => void;
};

function PhotoEditor({ uri, caption, onPicked, onCaption, onProblem }: PhotoEditorProps) {
  const [busy, setBusy] = useState(false);

  const applyPicked = async (asset: ImagePicker.ImagePickerAsset | undefined) => {
    if (!asset) return;
    setBusy(true);
    onProblem(null);
    try {
      onPicked(await compressImage(asset, { maxEdge: PHOTO_MAX_EDGE, output: "file" }));
    } catch {
      onProblem("That photo could not be prepared. Try another one.");
    } finally {
      setBusy(false);
    }
  };

  const fromLibrary = async () => {
    const picked = await pickImage({ square: false });
    if (picked.denied) {
      Alert.alert("Photos needed", "Allow photo access to share a photo Instant.");
      return;
    }
    await applyPicked(picked.asset);
  };

  const fromCamera = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Camera needed", "Allow camera access to take a photo for your Instant.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 1 });
    await applyPicked(result.canceled ? undefined : result.assets[0]);
  };

  if (busy) {
    return (
      <View style={[StyleSheet.absoluteFill, styles.centered]}>
        <ActivityIndicator color={storyPalette.white} />
      </View>
    );
  }

  if (!uri) {
    return (
      <View style={[StyleSheet.absoluteFill, styles.centered, styles.pickRow]}>
        <PickButton icon="images" label="Library" onPress={() => void fromLibrary()} />
        {Platform.OS !== "web" ? (
          <PickButton icon="camera" label="Camera" onPress={() => void fromCamera()} />
        ) : null}
      </View>
    );
  }

  return (
    <View style={StyleSheet.absoluteFill}>
      <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="contain" />
      <Pressable
        onPress={() => onPicked(null)}
        style={[styles.iconButton, styles.removePhoto]}
        accessibilityRole="button"
        accessibilityLabel="Choose another photo"
      >
        <Ionicons name="refresh" size={20} color={storyPalette.white} />
      </Pressable>
      <View style={styles.captionBar}>
        <TextInput
          value={caption}
          onChangeText={onCaption}
          placeholder="Add a caption…"
          placeholderTextColor={storyPalette.muted}
          maxLength={STORY_CAPTION_MAX}
          style={styles.captionInput}
          accessibilityLabel="Caption"
        />
      </View>
    </View>
  );
}

function PickButton({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.pickButton, pressed && { opacity: 0.8 }]}
      accessibilityRole="button"
      accessibilityLabel={`Choose a photo from ${label}`}
    >
      <Ionicons name={icon} size={30} color={storyPalette.white} />
      <Text style={styles.chipText}>{label}</Text>
    </Pressable>
  );
}

type VoiceEditorProps = {
  note: RecordedNote | null;
  onRecorded: (note: RecordedNote | null) => void;
  onProblem: (problem: string | null) => void;
  languageName: string;
};

/** Tap to record, tap again to stop; stops by itself at the limit. */
function VoiceEditor({ note, onRecorded, onProblem, languageName }: VoiceEditorProps) {
  const keep = useCallback(
    (recorded: RecordedNote | null) => {
      if (!recorded) {
        onProblem("That was too short — hold on for at least a second.");
        return;
      }
      onProblem(null);
      onRecorded(recorded);
    },
    [onProblem, onRecorded],
  );
  const recorder = useVoiceNoteRecorder(STORY_VOICE_MAX_MS, keep);

  const toggle = async () => {
    if (recorder.recording) {
      keep(await recorder.stop());
      return;
    }
    onRecorded(null);
    onProblem(null);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    await recorder.start();
  };

  const label = recorder.recording
    ? `Stop · ${formatCountdown(STORY_VOICE_MAX_MS - recorder.elapsedMs)} left`
    : note
      ? `Recorded ${formatCountdown(note.durationMs)} · Record again`
      : `Record in ${languageName}`;

  return (
    <LinearGradient
      colors={textStoryBackgrounds[2]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[StyleSheet.absoluteFill, styles.centered]}
    >
      <Pressable
        onPress={() => void toggle()}
        style={({ pressed }) => [
          styles.micButton,
          recorder.recording && { backgroundColor: storyPalette.danger },
          pressed && { opacity: 0.85 },
        ]}
        accessibilityRole="button"
        accessibilityLabel={recorder.recording ? "Stop recording" : label}
      >
        <Ionicons
          name={recorder.recording ? "stop" : note ? "checkmark" : "mic"}
          size={44}
          color={storyPalette.white}
        />
      </Pressable>
      {recorder.recording ? (
        <View style={styles.recordTrack}>
          <View
            style={[
              styles.recordFill,
              { width: `${(recorder.elapsedMs / STORY_VOICE_MAX_MS) * 100}%` },
            ]}
          />
        </View>
      ) : null}
      <Text style={styles.hint}>{label}</Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  centered: { alignItems: "center", justifyContent: "center", padding: spacing.lg },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
  },
  title: { color: storyPalette.white, fontSize: 18, fontWeight: "800" },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  modes: {
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.sm,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  modeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: storyPalette.glass,
  },
  modeChipActive: { backgroundColor: storyPalette.accent },
  chipText: { color: storyPalette.white, fontSize: 14, fontWeight: "700" },
  languageScroll: { flexGrow: 0, marginTop: spacing.sm },
  languageRow: { gap: spacing.sm, paddingHorizontal: spacing.md },
  languageChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: storyPalette.glass,
  },
  stage: {
    flex: 1,
    marginTop: spacing.md,
    marginHorizontal: spacing.md,
    borderRadius: radius.lg,
    overflow: "hidden",
    backgroundColor: storyPalette.glass,
  },
  textInput: {
    alignSelf: "stretch",
    color: storyPalette.white,
    fontSize: 28,
    fontWeight: "800",
    lineHeight: 36,
    maxHeight: "85%",
  },
  counter: {
    position: "absolute",
    bottom: spacing.md,
    right: spacing.md,
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 12,
    fontWeight: "700",
  },
  hint: {
    color: storyPalette.text,
    fontSize: 15,
    fontWeight: "600",
    textAlign: "center",
    marginTop: spacing.md,
  },
  pickRow: { flexDirection: "row", gap: spacing.md },
  pickButton: {
    width: 120,
    height: 120,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: storyPalette.glass,
    borderWidth: 1,
    borderColor: storyPalette.glassBorder,
  },
  removePhoto: {
    position: "absolute",
    top: spacing.sm,
    right: spacing.sm,
    backgroundColor: storyPalette.scrim,
  },
  captionBar: { position: "absolute", left: spacing.md, right: spacing.md, bottom: spacing.md },
  captionInput: {
    minHeight: 46,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    color: storyPalette.white,
    fontSize: 15,
    backgroundColor: storyPalette.scrim,
    borderWidth: 1,
    borderColor: storyPalette.glassBorder,
  },
  micButton: {
    width: 104,
    height: 104,
    borderRadius: 52,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: storyPalette.scrim,
    borderWidth: 2,
    borderColor: storyPalette.glassBorder,
  },
  recordTrack: {
    alignSelf: "stretch",
    height: 4,
    borderRadius: 2,
    marginTop: spacing.lg,
    backgroundColor: storyPalette.track,
    overflow: "hidden",
  },
  recordFill: { height: 4, backgroundColor: storyPalette.white },
  footer: { paddingHorizontal: spacing.md, paddingTop: spacing.md, gap: spacing.sm },
  problem: { color: storyPalette.danger, fontSize: 14, fontWeight: "700", textAlign: "center" },
  shareButton: {
    flexDirection: "row",
    gap: 10,
    minHeight: 54,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: storyPalette.accent,
  },
  shareText: { color: storyPalette.white, fontSize: 16, fontWeight: "800" },
  disabled: { opacity: 0.45 },
});
