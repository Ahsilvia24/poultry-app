import { Platform, StyleSheet } from "react-native";

export const colors = {
  bg: "#f3efe6",
  bgTop: "#efe8da",
  card: "#ffffff",
  text: "#1c1917",
  muted: "#78716c",
  accent: "#047857",
  accentDark: "#065f46",
  border: "#e7e5e4",
  danger: "#b91c1c",
  warn: "#b45309",
  headerBg: "#f7f4ef",
};

const serif = Platform.select({ ios: "Georgia", android: "serif", default: "serif" });
const sans = Platform.select({ ios: "System", android: "sans-serif", default: "System" });

export const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  brand: {
    fontFamily: serif,
    fontSize: 20,
    fontWeight: "800",
    color: "#064e3b",
    letterSpacing: -0.3,
  },
  title: {
    fontFamily: serif,
    fontSize: 28,
    fontWeight: "800",
    color: colors.text,
  },
  sectionTitle: {
    fontFamily: serif,
    fontSize: 20,
    fontWeight: "700",
    color: colors.text,
    marginTop: 20,
    marginBottom: 10,
  },
  subtitle: {
    fontFamily: sans,
    fontSize: 15,
    color: colors.muted,
    marginTop: 4,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 6,
  },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: "#d6d3d1",
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 17,
    backgroundColor: "#fff",
    color: colors.text,
    marginBottom: 12,
  },
  button: {
    minHeight: 52,
    backgroundColor: colors.accentDark,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  buttonText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
  },
  buttonSecondary: {
    backgroundColor: "#e7e5e4",
  },
  buttonSecondaryText: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "700",
  },
  row: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
  },
  muted: {
    color: colors.muted,
    fontSize: 13,
  },
  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: "hidden",
    fontWeight: "800",
    fontSize: 13,
  },
});

export function statusColor(status: string) {
  switch (status) {
    case "Critical":
      return { bg: "#fee2e2", fg: "#991b1b" };
    case "High":
      return { bg: "#ffedd5", fg: "#9a3412" };
    case "Watch":
      return { bg: "#fef3c7", fg: "#92400e" };
    default:
      return { bg: "#d1fae5", fg: "#065f46" };
  }
}
