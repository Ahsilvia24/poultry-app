/** Convert feed pounds to tons (1 ton = 2,000 lb). */
export function poundsToTons(pounds: number): number {
  return pounds / 2000;
}

export function sumFeedPounds(
  deliveries: { poundsDelivered: number }[],
): { pounds: number; tons: number } {
  const pounds = deliveries.reduce((sum, d) => sum + d.poundsDelivered, 0);
  return { pounds, tons: poundsToTons(pounds) };
}
