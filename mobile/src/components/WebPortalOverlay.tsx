import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { Platform } from "react-native";

/** Full-viewport overlay that escapes parent Modals (RN web `fixed` is trapped by transforms). */
export function WebPortalOverlay({
  children,
  onDismiss,
}: {
  children: ReactNode;
  onDismiss: () => void;
}) {
  if (Platform.OS !== "web" || typeof document === "undefined") return null;
  return createPortal(
    <div
      role="presentation"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2147483000,
        background: "rgba(0,0,0,0.5)",
        padding: 10,
        display: "flex",
        boxSizing: "border-box",
      }}
      onClick={onDismiss}
    >
      <div
        role="dialog"
        aria-modal="true"
        style={{
          flex: 1,
          background: "#fff",
          borderRadius: 16,
          display: "flex",
          flexDirection: "column",
          overflow: "auto",
          position: "relative",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
