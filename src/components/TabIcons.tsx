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

/** Feed bin with cone hopper and two legs for LFO */
export function LfoTabIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      {/* Flat lid + straight bin body + cone bottom + two legs */}
      <path d="M7 2h10v2H7V2zm-1.5 2.75h13v7.5h-13v-7.5zM5.5 13.25 12 19.5l6.5-6.25H5.5zM8 19.25h1.75V22H8v-2.75zm6.25 0H16V22h-1.75v-2.75z" />
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
