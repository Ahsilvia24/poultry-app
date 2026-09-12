export type TabIconName = "reports" | "lfo" | "dashboard" | "farms" | "tools";

export type TabIconEl =
  | {
      tag: "path";
      d: string;
      fillRule?: "evenodd";
      transform?: string;
    }
  | {
      tag: "rect";
      x: number;
      y: number;
      width: number;
      height: number;
      rx?: number;
    };

/** Filled silhouettes matching the phone tab-bar reference. */
export const TAB_ICON_ELEMENTS: Record<TabIconName, TabIconEl[]> = {
  reports: [
    { tag: "rect", x: 2, y: 19.2, width: 20, height: 1.65, rx: 0.35 },
    { tag: "rect", x: 4.15, y: 12.15, width: 3.7, height: 7.05, rx: 0.55 },
    { tag: "rect", x: 10.15, y: 8.1, width: 3.7, height: 11.1, rx: 0.55 },
    { tag: "rect", x: 16.15, y: 4.25, width: 3.7, height: 14.95, rx: 0.55 },
  ],
  lfo: [
    {
      tag: "path",
      d: "M3.35 5.2h17.3c.58 0 .9.66.55 1.12L12.72 19.55c-.36.5-1.08.5-1.44 0L2.8 6.32c-.35-.46-.03-1.12.55-1.12z",
    },
  ],
  dashboard: [
    { tag: "rect", x: 3.35, y: 3.35, width: 7.15, height: 7.15, rx: 1.2 },
    { tag: "rect", x: 13.5, y: 3.35, width: 7.15, height: 7.15, rx: 1.2 },
    { tag: "rect", x: 3.35, y: 13.5, width: 7.15, height: 7.15, rx: 1.2 },
    { tag: "rect", x: 13.5, y: 13.5, width: 7.15, height: 7.15, rx: 1.2 },
  ],
  farms: [
    {
      tag: "path",
      fillRule: "evenodd",
      d: "M12 4.05 3.85 9.15H5.05v11c0 .66.54 1.2 1.2 1.2h11.5c.66 0 1.2-.54 1.2-1.2v-11h1.2L12 4.05Zm-1.45 10.85h2.9v9.5h-2.9v-9.5Z",
    },
  ],
  tools: [
    {
      tag: "path",
      transform: "rotate(22 12 12)",
      d: "M10.55 2.55H7.2c-.45 0-.8.36-.8.8v3.05c0 .24.1.47.27.64L10.2 10.3v8.15c0 1.05.85 1.9 1.9 1.9s1.9-.85 1.9-1.9V10.3l3.53-3.26c.17-.17.27-.4.27-.64V3.35c0-.44-.36-.8-.8-.8H13.45V5.7h-2.9V2.55z",
    },
  ],
};
