export function clampDateKeyToPlacement(from: string, placement: string | null | undefined) {
  if (!placement) return from;
  return from < placement ? placement : from;
}

export function fillCumulativeByAge(
  ageCounts: Map<number, number> | Array<{ age: number; count: number }>,
  startAge: number,
): Array<{ birdAgeInDays: number; cumulative: number }> {
  const counts = ageCounts instanceof Map ? ageCounts : new Map(ageCounts.map((row) => [row.age, row.count]));
  const ages = [...counts.keys()];
  const last = ages.length ? Math.max(startAge, ...ages) : startAge;
  let running = 0;
  const points: Array<{ birdAgeInDays: number; cumulative: number }> = [];
  for (let age = Math.max(0, startAge); age <= last; age++) {
    running += counts.get(age) ?? 0;
    points.push({ birdAgeInDays: age, cumulative: running });
  }
  return points;
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

export function drawHouseBarChart(rows: Array<{ houseLabel: string; mortality: number }>) {
  const width = 900;
  const height = 420;
  const left = 56;
  const right = 24;
  const top = 28;
  const bottom = 56;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  const max = Math.max(1, ...rows.map((row) => row.mortality));
  const plotW = width - left - right;
  const plotH = height - top - bottom;
  ctx.strokeStyle = "#e7e5e4";
  ctx.lineWidth = 1;
  ctx.font = "14px sans-serif";
  ctx.fillStyle = "#78716c";
  const ticks = 4;
  for (let i = 0; i <= ticks; i++) {
    const y = top + (plotH * i) / ticks;
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(left + plotW, y);
    ctx.stroke();
    const value = Math.round(max - (max * i) / ticks);
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText(String(value), left - 8, y);
  }
  const slot = plotW / Math.max(1, rows.length);
  const barW = Math.min(72, slot * 0.55);
  rows.forEach((row, index) => {
    const x = left + slot * index + (slot - barW) / 2;
    const h = (row.mortality / max) * plotH;
    const y = top + plotH - h;
    ctx.fillStyle = "#047857";
    roundedRect(ctx, x, y, barW, Math.max(h, 0), 4);
    ctx.fill();
    ctx.fillStyle = "#1c1917";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(row.houseLabel, x + barW / 2, top + plotH + 10);
  });
  return canvas.toDataURL("image/png");
}

export function drawAgeLineChart(points: Array<{ birdAgeInDays: number; cumulative: number }>) {
  const width = 900;
  const height = 420;
  const left = 56;
  const right = 24;
  const top = 28;
  const bottom = 56;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  if (points.length === 0) return canvas.toDataURL("image/png");
  const minAge = points[0]!.birdAgeInDays;
  const maxAge = points[points.length - 1]!.birdAgeInDays;
  const maxY = Math.max(1, ...points.map((point) => point.cumulative));
  const plotW = width - left - right;
  const plotH = height - top - bottom;
  const xAt = (age: number) => left + ((age - minAge) / Math.max(1, maxAge - minAge)) * plotW;
  const yAt = (value: number) => top + plotH - (value / maxY) * plotH;
  ctx.strokeStyle = "#e7e5e4";
  ctx.lineWidth = 1;
  ctx.font = "14px sans-serif";
  ctx.fillStyle = "#78716c";
  const ticks = 4;
  for (let i = 0; i <= ticks; i++) {
    const y = top + (plotH * i) / ticks;
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(left + plotW, y);
    ctx.stroke();
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText(String(Math.round(maxY - (maxY * i) / ticks)), left - 8, y);
  }
  ctx.beginPath();
  points.forEach((point, index) => {
    const x = xAt(point.birdAgeInDays);
    const y = yAt(point.cumulative);
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = "#047857";
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = "#78716c";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText("Bird age (days)", left + plotW / 2, top + plotH + 18);
  ctx.fillText(String(minAge), left, top + plotH + 4);
  ctx.fillText(String(maxAge), left + plotW, top + plotH + 4);
  return canvas.toDataURL("image/png");
}