import Constants from "expo-constants";
import * as Device from "expo-device";
import { Platform } from "react-native";
import type { DeviceContext, DevicePlatform } from "@sayly/shared";

export function toDevicePlatform(os: string): DevicePlatform {
  if (os === "ios") return "IOS";
  if (os === "android") return "ANDROID";
  return "WEB";
}

/** Limits match the backend schema; longer values are cut instead of failing the request. */
function clip(value: string | null | undefined, max: number) {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, max) : undefined;
}

/** App version, platform, OS version and device model of this phone. */
export function currentDeviceContext(): DeviceContext {
  const context: DeviceContext = {
    appVersion: clip(Constants.expoConfig?.version, 32) ?? "unknown",
    platform: toDevicePlatform(Platform.OS),
  };
  const osVersion = clip(Device.osVersion ?? String(Platform.Version), 32);
  const deviceModel = clip(Device.modelName, 80);
  if (osVersion) context.osVersion = osVersion;
  if (deviceModel) context.deviceModel = deviceModel;
  return context;
}

/** "Sayly 1.0.0 · Android 15 · Pixel 9" — shown so the member sees what is attached. */
export function describeDeviceContext(context: DeviceContext) {
  const platformName = { IOS: "iOS", ANDROID: "Android", WEB: "Web" }[context.platform];
  return [
    `Sayly ${context.appVersion}`,
    [platformName, context.osVersion].filter(Boolean).join(" "),
    context.deviceModel,
  ]
    .filter(Boolean)
    .join(" · ");
}
