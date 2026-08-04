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

/** Medical cross in circle for mortality */
export function MortalityTabIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path
        fillRule="evenodd"
        d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1.25 5.5h-2.5v3.25H7.5v2.5h3.25V16.5h2.5v-3.25H16.5v-2.5h-3.25V7.5z"
        clipRule="evenodd"
      />
    </svg>
  );
}

/** Feed bin with cone hopper for LFO */
export function LfoTabIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      {/* Flat lid + straight bin body + cone bottom */}
      <path d="M7 2h10v2.25H7V2zm-1.5 3h13v8.5h-13V5zM5.5 14.5 12 22l6.5-7.5H5.5z" />
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
