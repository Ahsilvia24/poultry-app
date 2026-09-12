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
      fill?: "none";
      strokeWidth?: number;
    };

/**
 * Shapes taken from the phone tab-bar screenshot:
 * chart-in-a-box, home-plate hopper, 2x2 tiles, X-braced barn,
 * crossed wrench and screwdriver.
 */
export const TAB_ICON_ELEMENTS: Record<TabIconName, TabIconEl[]> = {
  reports: [
    {
      tag: "path",
      d: "M9 17H7V10H9V17M13 17H11V7H13V17M17 17H15V13H17V17M19 19H5V5H19V19.1M19 3H5C3.9 3 3 3.9 3 5V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19V5C21 3.9 20.1 3 19 3Z",
    },
  ],
  lfo: [
    {
      tag: "path",
      d: "M4.35 3.9h15.3c.75 0 1.35.6 1.35 1.35v6.55L12 21.05 3 11.8V5.25c0-.75.6-1.35 1.35-1.35z",
    },
  ],
  dashboard: [
    { tag: "rect", x: 4.7, y: 4.7, width: 6.1, height: 6.1, rx: 0.95, fill: "none", strokeWidth: 1.7 },
    { tag: "rect", x: 13.2, y: 4.7, width: 6.1, height: 6.1, rx: 0.95, fill: "none", strokeWidth: 1.7 },
    { tag: "rect", x: 4.7, y: 13.2, width: 6.1, height: 6.1, rx: 0.95, fill: "none", strokeWidth: 1.7 },
    { tag: "rect", x: 13.2, y: 13.2, width: 6.1, height: 6.1, rx: 0.95, fill: "none", strokeWidth: 1.7 },
  ],
  farms: [
    {
      tag: "path",
      d: "M12 3 3 8.2V21H9l2.9-3L15 21h6V8.2L12 3M7.9 20v-6l3 3-3 3M8.9 13h6L11.9 16 8.9 13M15.9 20l-3-3 3-3v6M15 11H8.8V9H15v2Z",
    },
  ],
  tools: [
    {
      tag: "path",
      // Bootstrap Tools — open wrench crossed with a screwdriver
      transform: "translate(12 12) scale(1.35) translate(-8 -8)",
      d: "M1 0 0 1l2.2 3.081a1 1 0 0 0 .815.419h.07a1 1 0 0 1 .708.293l2.675 2.675-2.617 2.654A3.003 3.003 0 0 0 0 13a3 3 0 1 0 5.878-.851l2.654-2.617.968.968-.305.914a1 1 0 0 0 .242 1.023l3.27 3.27a.997.997 0 0 0 1.414 0l1.586-1.586a.997.997 0 0 0 0-1.414l-3.27-3.27a1 1 0 0 0-1.023-.242L10.5 9.5l-.96-.96 2.68-2.643A3.005 3.005 0 0 0 16 3q0-.405-.102-.777l-2.14 2.141L12 4l-.364-1.757L13.777.102a3 3 0 0 0-3.675 3.68L7.462 6.46 4.793 3.793a1 1 0 0 1-.293-.707v-.071a1 1 0 0 0-.419-.814zm9.646 10.646a.5.5 0 0 1 .708 0l2.914 2.915a.5.5 0 0 1-.707.707l-2.915-2.914a.5.5 0 0 1 0-.708M3 11l.471.242.529.026.287.445.445.287.026.529L5 13l-.242.471-.026.529-.445.287-.287.445-.529.026L3 15l-.471-.242L2 14.732l-.287-.445L1.268 14l-.026-.529L1 13l.242-.471.026-.529.445-.287.287-.445.529-.026z",
    },
  ],
};
