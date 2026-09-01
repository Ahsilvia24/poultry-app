import { useRef, useState, type ReactNode } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import { colors } from "../theme";
import {
  shouldCommitSwipeDelete,
  SWIPE_DELETE_COMMIT_PX,
  SWIPE_DELETE_MAX_PX,
} from "../lib/swipe-commit";

export function SwipeCommitDeleteRow({
  onDelete,
  onPress,
  children,
  commitPx = SWIPE_DELETE_COMMIT_PX,
  stretchUntilRelease = false,
  deleteContent,
}: {
  onDelete: () => void;
  onPress?: () => void;
  children: ReactNode;
  /** How far left the row must travel before release deletes it. */
  commitPx?: number;
  /** Grow the red delete strip with the finger instead of a fixed width. */
  stretchUntilRelease?: boolean;
  deleteContent?: ReactNode;
}) {
  const [x, setX] = useState(0);
  const [rowWidth, setRowWidth] = useState(0);
  const xRef = useRef(0);
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const didSwipe = useRef(false);
  const committed = useRef(false);

  const maxPx = stretchUntilRelease
    ? Math.max(rowWidth || 1000, commitPx)
    : SWIPE_DELETE_MAX_PX;
  const redWidth = stretchUntilRelease ? Math.max(0, -x) : SWIPE_DELETE_MAX_PX;

  function setOffset(next: number) {
    xRef.current = next;
    setX(next);
  }

  function begin(pageX: number, pageY: number) {
    committed.current = false;
    didSwipe.current = false;
    startX.current = pageX;
    startY.current = pageY;
  }

  function move(pageX: number, pageY?: number) {
    if (startX.current == null) return;
    const dx = pageX - startX.current;
    const dy = pageY != null && startY.current != null ? pageY - startY.current : 0;
    if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
    if (Math.abs(dy) > Math.abs(dx)) return;
    didSwipe.current = true;
    setOffset(Math.max(-maxPx, Math.min(0, dx)));
  }

  function end() {
    if (startX.current == null) {
      setOffset(0);
      return;
    }
    if (!committed.current && shouldCommitSwipeDelete(xRef.current, commitPx)) {
      committed.current = true;
      onDelete();
    } else {
      setOffset(0);
    }
    startX.current = null;
    startY.current = null;
  }

  const gesture = {
    onStartShouldSetResponder: () => false,
    onMoveShouldSetResponder: (e: { nativeEvent: { pageX: number; pageY: number } }) => {
      if (startX.current == null || startY.current == null) return false;
      const dx = e.nativeEvent.pageX - startX.current;
      const dy = e.nativeEvent.pageY - startY.current;
      return Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy);
    },
    onResponderGrant: (e: { nativeEvent: { pageX: number; pageY: number } }) =>
      begin(e.nativeEvent.pageX, e.nativeEvent.pageY),
    onResponderMove: (e: { nativeEvent: { pageX: number; pageY: number } }) =>
      move(e.nativeEvent.pageX, e.nativeEvent.pageY),
    onResponderRelease: end,
    onResponderTerminate: end,
    onTouchStart: (e: { nativeEvent: { pageX: number; pageY: number } }) =>
      begin(e.nativeEvent.pageX, e.nativeEvent.pageY),
    ...(Platform.OS === "web"
      ? {
          onMouseDown: (e: { pageX: number; pageY: number }) => begin(e.pageX, e.pageY),
          onMouseMove: (e: { pageX: number; buttons?: number; pageY: number }) => {
            if (e.buttons === 1) move(e.pageX, e.pageY);
          },
          onMouseUp: end,
          onMouseLeave: () => {
            if (startX.current != null) end();
          },
        }
      : {}),
  };

  return (
    <View
      style={{ overflow: "hidden" }}
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        if (w > 0 && w !== rowWidth) setRowWidth(w);
      }}
    >
      {x < -8 ? (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            right: 0,
            top: 0,
            bottom: 0,
            width: redWidth,
            backgroundColor: colors.danger,
            justifyContent: "center",
            alignItems: stretchUntilRelease ? "center" : "flex-end",
            paddingRight: stretchUntilRelease ? 0 : 16,
          }}
        >
          {deleteContent ?? (
            <Text style={{ color: "#fff", fontWeight: "800", fontSize: 13 }}>Delete</Text>
          )}
        </View>
      ) : null}
      <View
        {...gesture}
        style={{
          transform: [{ translateX: x }],
          backgroundColor: colors.card,
        }}
      >
        {onPress ? (
          <Pressable
            onPress={() => {
              if (didSwipe.current) return;
              onPress();
            }}
          >
            {children}
          </Pressable>
        ) : (
          children
        )}
      </View>
    </View>
  );
}
