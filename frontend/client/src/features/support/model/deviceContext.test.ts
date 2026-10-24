jest.mock("expo-constants", () => ({
  __esModule: true,
  default: { expoConfig: { version: "1.2.3" } },
}));
jest.mock("expo-device", () => ({ osVersion: "15", modelName: "Pixel 9" }));
jest.mock("react-native", () => ({ Platform: { OS: "android", Version: 35 } }));

import { currentDeviceContext, describeDeviceContext, toDevicePlatform } from "./deviceContext";

describe("device context", () => {
  it("maps the platform to the backend enum", () => {
    expect(toDevicePlatform("ios")).toBe("IOS");
    expect(toDevicePlatform("android")).toBe("ANDROID");
    expect(toDevicePlatform("web")).toBe("WEB");
  });

  it("collects the app version, OS and model", () => {
    expect(currentDeviceContext()).toEqual({
      appVersion: "1.2.3",
      platform: "ANDROID",
      osVersion: "15",
      deviceModel: "Pixel 9",
    });
  });

  it("describes what gets attached", () => {
    expect(describeDeviceContext({ appVersion: "1.2.3", platform: "IOS", osVersion: "18.1" })).toBe(
      "Sayly 1.2.3 · iOS 18.1",
    );
  });
});
