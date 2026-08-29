import { useEffect, useState } from "react";
import { Keyboard, Platform } from "react-native";

/**
 * Extra bottom inset when the software keyboard covers the viewport.
 * iOS screens that already use KeyboardAvoidingView should ignore this
 * (it is still useful on Android and Expo web, where KAV is a no-op).
 */
export function useKeyboardInset() {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const show = Keyboard.addListener(showEvent, (e) => {
      setInset(e.endCoordinates.height);
    });
    const hide = Keyboard.addListener(hideEvent, () => setInset(0));

    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    const onViewport = () => {
      if (!vv) return;
      setInset(Math.max(0, window.innerHeight - vv.height - vv.offsetTop));
    };
    vv?.addEventListener("resize", onViewport);
    vv?.addEventListener("scroll", onViewport);

    return () => {
      show.remove();
      hide.remove();
      vv?.removeEventListener("resize", onViewport);
      vv?.removeEventListener("scroll", onViewport);
    };
  }, []);

  return inset;
}

export function userFacingMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
}
