import { Children, type ReactNode } from "react";
import { Pressable, type PressableProps, View, type ViewProps } from "react-native";

/** React Native Web treats whitespace text nodes as illegal View/Pressable children. */
function withoutTextNodes(children: ReactNode): ReactNode[] {
  return Children.toArray(children).filter((child) => {
    if (typeof child === "string") {
      return child.trim().length > 0;
    }
    return true;
  });
}

/** Drop-in View that ignores whitespace-only text nodes (RN Web safe). */
export function SafeView({ children, ...props }: ViewProps) {
  return <View {...props}>{withoutTextNodes(children)}</View>;
}

/** Drop-in Pressable that ignores whitespace-only text nodes (RN Web safe). */
export function SafePressable({ children, ...props }: PressableProps) {
  return (
    <Pressable {...props}>
      {typeof children === "function"
        ? (state) => withoutTextNodes(children(state))
        : withoutTextNodes(children)}
    </Pressable>
  );
}
