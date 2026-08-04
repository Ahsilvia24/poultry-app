/** Small silhouette icons for bottom tab navigation. */

type IconProps = { className?: string };

export function DashboardTabIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M3 3h8v8H3V3zm10 0h8v5h-8V3zM3 13h8v8H3v-8zm10 2h8v6h-8v-6z" />
    </svg>
  );
}

/** Simple barn / farm silhouette */
export function FarmsTabIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M12 3 2 10h2v11h6v-6h4v6h6V10h2L12 3zm-1 8H8v3h3v-3zm5 0h-3v3h3v-3z" />
    </svg>
  );
}

/** Pulse / mortality silhouette */
export function MortalityTabIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M3 13h3.2l1.6-4.5 2.4 9 2.2-6.2L14.2 13H21v-2h-5.8l-1.5-2.3-2.1 5.9-2.2-8.1L6.8 11H3v2z" />
    </svg>
  );
}

/** Feed bin / hopper silhouette for LFO */
export function LfoTabIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      {/* Lid + cylindrical bin + hopper cone + boots */}
      <path d="M6.5 3h11v2.5h-11V3zm.5 3.5h10l2.5 3.5H5L7 6.5zm-2 4.5h15v7.5H5V11zm3 8.5h2.5V22H8v-2.5zm5.5 0H16V22h-2.5v-2.5z" />
    </svg>
  );
}

/** Tools / wrench silhouette */
export function ToolsTabIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M21.1 6.1a5 5 0 0 1-6.7 6.7l-7.5 7.5-2.8-2.8 7.5-7.5a5 5 0 0 1 6.7-6.7l-2.4 2.4 2.8 2.8 2.4-2.4z" />
    </svg>
  );
}
