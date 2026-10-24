import { useCallback, useState } from "react";
import { Alert, Share } from "react-native";

import { shareProfileMessage } from "../model/profileMenu";
import type { CurrentUserProfile } from "../types";

import { useUpdateSettings } from "./useProfile";

/**
 * "Share profile": shares your Sayly ID link. Sharing needs "Show my Sayly ID" on — when
 * it is off, `promptOpen` asks to turn it on first (`turnOnAndShare`).
 */
export function useShareProfile(profile: CurrentUserProfile | undefined) {
  const [promptOpen, setPromptOpen] = useState(false);
  const { saveAsync, isSaving } = useUpdateSettings();

  const shareNow = useCallback((saylyId: string) => {
    void Share.share({ message: shareProfileMessage(saylyId) }).catch(() => undefined);
  }, []);

  const share = useCallback(() => {
    if (!profile) return;
    if (!profile.settings.showSaylyId) {
      setPromptOpen(true);
      return;
    }
    shareNow(profile.saylyId);
  }, [profile, shareNow]);

  const turnOnAndShare = useCallback(async () => {
    if (!profile) return;
    try {
      await saveAsync({ showSaylyId: true });
      setPromptOpen(false);
      shareNow(profile.saylyId);
    } catch {
      Alert.alert("Could not turn on your Sayly ID", "Check your connection and try again.");
    }
  }, [profile, saveAsync, shareNow]);

  return {
    share,
    promptOpen,
    closePrompt: () => setPromptOpen(false),
    turnOnAndShare,
    turningOn: isSaving,
  };
}
