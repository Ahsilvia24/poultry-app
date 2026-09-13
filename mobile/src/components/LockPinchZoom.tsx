import { useEffect } from "react";
import { Platform } from "react-native";

/** Block pinch-zoom on Expo web so it feels like an app, not a webpage. */
export function LockPinchZoom() {
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const blockGesture = (event: Event) => {
      event.preventDefault();
    };
    const blockMultiTouch = (event: TouchEvent) => {
      if (event.touches.length > 1) event.preventDefault();
    };
    document.addEventListener("gesturestart", blockGesture, { passive: false });
    document.addEventListener("gesturechange", blockGesture, { passive: false });
    document.addEventListener("gestureend", blockGesture, { passive: false });
    document.addEventListener("touchmove", blockMultiTouch, { passive: false });
    return () => {
      document.removeEventListener("gesturestart", blockGesture);
      document.removeEventListener("gesturechange", blockGesture);
      document.removeEventListener("gestureend", blockGesture);
      document.removeEventListener("touchmove", blockMultiTouch);
    };
  }, []);
  return null;
}
