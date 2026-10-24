export const Platform = {
  OS: "web" as string,
  select: (spec: Record<string, unknown>) => spec.web ?? spec.default,
};

export const NativeModules = {};

export default { Platform, NativeModules };
