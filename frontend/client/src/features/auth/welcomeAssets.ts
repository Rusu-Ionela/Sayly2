import { Image, Platform, type ImageSourcePropType } from "react-native";

export type WelcomeSlide = {
  id: string;
  image: ImageSourcePropType;
  greeting: string;
};

const HERO_IMAGES = [
  require("../../assets/welcome/hero.png"),
  require("../../assets/welcome/hero-2.png"),
  require("../../assets/welcome/hero-3.png"),
  require("../../assets/welcome/hero-4.png"),
] as const;

export const WELCOME_SLIDES: readonly WelcomeSlide[] = [
  {
    id: "en",
    image: HERO_IMAGES[0],
    greeting: "Hello\nthere!",
  },
  {
    id: "es",
    image: HERO_IMAGES[1],
    greeting: "¡Hola\nallí!",
  },
  {
    id: "fr",
    image: HERO_IMAGES[2],
    greeting: "Bonjour\nlà!",
  },
  {
    id: "ja",
    image: HERO_IMAGES[3],
    greeting: "こんにちは!",
  },
];

function resolveImageUri(source: ImageSourcePropType): string | null {
  if (typeof source === "object" && source !== null && "uri" in source) {
    const uri = (source as { uri?: unknown }).uri;
    return typeof uri === "string" ? uri : null;
  }

  if (typeof Image.resolveAssetSource !== "function") {
    return null;
  }

  const resolved = Image.resolveAssetSource(source);
  return resolved?.uri ?? null;
}

function preloadImage(source: ImageSourcePropType): Promise<void> {
  return new Promise((resolve) => {
    const uri = resolveImageUri(source);

    if (!uri) {
      resolve();
      return;
    }

    if (Platform.OS === "web") {
      const img = new window.Image();
      img.onload = () => resolve();
      img.onerror = () => resolve();
      img.src = uri;
      return;
    }

    void Image.prefetch(uri)
      .then(() => resolve())
      .catch(() => resolve());
  });
}

/** Prefetch welcome hero images so the carousel is ready when splash ends. */
export async function preloadWelcomeAssets(): Promise<void> {
  await Promise.all(HERO_IMAGES.map((image) => preloadImage(image)));
}
