import { getDb } from "../db";
import { newId, todayKey, addDaysKey } from "../lib/ids";
import {
  birdAgeFromPlacement,
  calcPercentage,
  calcTotalDailyLoss,
  flockWeekFromAge,
  resolveMortalityStatus,
  DEFAULT_THRESHOLDS,
  formatMinVentCycle,
} from "../lib/mortality";
import { recommendedMinVent } from "../lib/tools";
import {
  buildFlockVisitSchedule,
  completionKey,
  splitScheduleForDashboard,
  type CompletionInfo,
  type ScheduledVisit,
} from "../lib/schedule";

type MortRow = {
  mortality_date: string;
  bird_age_in_days: number;
  daily_mortality_count: number;
  cull_count: number;
  total_daily_loss: number;
};

function summarizeHouse(
  placed: number,
  records: MortRow[],
  asOf: string,
): {
  today: number;
  sevenDay: number;
  cumulative: number;
  cumulativePct: number;
  remaining: number;
  status: string;
  weekly: Array<{ week: number; total: number }>;
} {
  let cumulative = 0;
  let today = 0;
  let sevenDay = 0;
  const last3: number[] = [];
  const weekTotals = new Map<number, number>();

  for (const r of records) {
    if (r.mortality_date > asOf) continue;
    cumulative += r.total_daily_loss;
    const week = flockWeekFromAge(r.bird_age_in_days);
    weekTotals.set(week, (weekTotals.get(week) ?? 0) + r.total_daily_loss);
    if (r.mortality_date === asOf) today += r.total_daily_loss;
  }

  for (let i = 0; i < 7; i++) {
    const key = addDaysKey(asOf, -i);
    for (const r of records) {
      if (r.mortality_date === key) sevenDay += r.total_daily_loss;
    }
  }

  for (let i = 0; i < 3; i++) {
    const key = addDaysKey(asOf, -i);
    let dayLoss = 0;
    for (const r of records) {
      if (r.mortality_date === key) dayLoss += r.total_daily_loss;
    }
    last3.push(dayLoss);
  }
  const rising =
    last3.length === 3 && last3[0]! > last3[1]! && last3[1]! > last3[2]!;

  const dailyPct = calcPercentage(today, placed);
  const sevenDayPct = calcPercentage(sevenDay, placed);
  const status = resolveMortalityStatus(dailyPct, sevenDayPct, rising, DEFAULT_THRESHOLDS);

  const weekly = Array.from(weekTotals.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([week, total]) => ({ week, total }));

  return {
    today,
    sevenDay,
    cumulative,
    cumulativePct: calcPercentage(cumulative, placed),
    remaining: Math.max(0, placed - cumulative),
    status,
    weekly,
  };
}

export function listFarms(status: "active" | "inactive" | "all" = "active") {
  const db = getDb();
  const today = todayKey();
  const farms = db.getAllSync<{
    id: string;
    farm_name: string;
    grower_name: string;
    phone_number: string | null;
    number_of_houses: number;
    is_active: number;
  }>(
    status === "all"
      ? "SELECT * FROM farms ORDER BY farm_name ASC"
      : status === "inactive"
        ? "SELECT * FROM farms WHERE is_active = 0 ORDER BY farm_name ASC"
        : "SELECT * FROM farms WHERE is_active = 1 ORDER BY farm_name ASC",
  );

  return {
    farms: farms.map((f) => {
      const flock = db.getFirstSync<{
        flock_number: string;
        placement_date: string;
        projected_catch_date: string | null;
      }>(
        "SELECT flock_number, placement_date, projected_catch_date FROM flocks WHERE farm_id = ? AND flock_status = 'ACTIVE' LIMIT 1",
        [f.id],
      );
      const houseCountRow = db.getFirstSync<{ c: number }>(
        "SELECT COUNT(*) as c FROM houses WHERE farm_id = ? AND deleted_at IS NULL",
        [f.id],
      );
      const houseCount = houseCountRow?.c ?? f.number_of_houses;
      let birdsPlaced = 0;
      let remaining = 0;
      if (flock) {
        const hfs = db.getAllSync<{ id: string; placed_bird_count: number }>(
          "SELECT id, placed_bird_count FROM house_flocks WHERE flock_id = (SELECT id FROM flocks WHERE farm_id = ? AND flock_status = 'ACTIVE' LIMIT 1)",
          [f.id],
        );
        for (const hf of hfs) {
          birdsPlaced += hf.placed_bird_count;
          const records = db.getAllSync<MortRow>(
            `SELECT mortality_date, bird_age_in_days, daily_mortality_count, cull_count, total_daily_loss
             FROM daily_mortality WHERE house_flock_id = ? AND is_draft = 0`,
            [hf.id],
          );
          remaining += summarizeHouse(hf.placed_bird_count, records, today).remaining;
        }
      }
      return {
        id: f.id,
        farmName: f.farm_name,
        growerName: f.grower_name,
        phoneNumber: f.phone_number,
        numberOfHouses: houseCount,
        houseCount,
        isActive: f.is_active === 1,
        birdsPlaced,
        currentHeadCount: remaining,
        placementDate: flock?.placement_date ?? null,
        projectedCatchDate:
        flock?.projected_catch_date ??
        (flock ? addDaysKey(flock.placement_date, 52) : null),
        flockAgeDays: flock ? birdAgeFromPlacement(flock.placement_date, today) : null,
        activeFlock: flock ? { flockNumber: flock.flock_number } : null,
      };
    }),
  };
}

export function getDashboard() {
  const db = getDb();
  const today = todayKey();
  const farms = listFarms().farms;
  let activeHouses = 0;
  let totalBirdsPlaced = 0;
  let mortalityEnteredToday = 0;
  let farmsMissingToday = 0;
  const farmCards = [];
  type ScheduleRow = {
    farmId: string;
    flockId: string;
    farmName: string;
    flockAgeDays: number | null;
    date: string;
    label: string;
    completed: boolean;
  };
  const todaysSchedule: ScheduleRow[] = [];
  const upcomingSchedule: ScheduleRow[] = [];

  const completionRows = db.getAllSync<{
    farm_id: string;
    scheduled_date: string;
    label: string;
    completed_at: string;
  }>("SELECT farm_id, scheduled_date, label, completed_at FROM follow_up_completions");
  const completedByFarm = new Map<string, Map<string, CompletionInfo>>();
  for (const c of completionRows) {
    const key = completionKey(c.scheduled_date, c.label);
    let map = completedByFarm.get(c.farm_id);
    if (!map) {
      map = new Map();
      completedByFarm.set(c.farm_id, map);
    }
    const completedAt = new Date(c.completed_at);
    if (!Number.isNaN(completedAt.getTime())) {
      map.set(key, { completedAt });
    }
  }

  for (const farm of farms) {
    const flock = db.getFirstSync<{
      id: string;
      placement_date: string;
      projected_catch_date: string | null;
    }>(
      "SELECT id, placement_date, projected_catch_date FROM flocks WHERE farm_id = ? AND flock_status = 'ACTIVE' LIMIT 1",
      [farm.id],
    );
    if (!flock) {
      farmCards.push({
        id: farm.id,
        farmName: farm.farmName,
        growerName: farm.growerName,
        phoneNumber: farm.phoneNumber,
        houseCount: farm.numberOfHouses,
        flockAgeDays: null,
        placementDate: null as string | null,
        birdsPlaced: 0,
        projectedHeadCount: null,
        projectedMortality: null,
        todayMortality: 0,
        sevenDayMortality: 0,
        cumulativeMortality: 0,
        cumulativeMortalityPct: 0,
        openIssues: 0,
        status: "Normal",
        missingTodayMortality: false,
        weeklyMortality: [] as Array<{ week: number; total: number }>,
        projectedCatchDate: null,
        lastVisitDate: null as string | null,
      });
      continue;
    }

    const hfs = db.getAllSync<{
      id: string;
      placed_bird_count: number;
    }>("SELECT id, placed_bird_count FROM house_flocks WHERE flock_id = ?", [flock.id]);

    activeHouses += hfs.length;
    let farmToday = 0;
    let farmSeven = 0;
    let farmCum = 0;
    let farmPlaced = 0;
    let farmRemaining = 0;
    let missing = false;
    let worst = "Normal";
    const weekTotals = new Map<number, number>();

    for (const hf of hfs) {
      farmPlaced += hf.placed_bird_count;
      totalBirdsPlaced += hf.placed_bird_count;
      const records = db.getAllSync<MortRow>(
        `SELECT mortality_date, bird_age_in_days, daily_mortality_count, cull_count, total_daily_loss
         FROM daily_mortality WHERE house_flock_id = ? AND is_draft = 0 ORDER BY mortality_date ASC`,
        [hf.id],
      );
      const s = summarizeHouse(hf.placed_bird_count, records, today);
      farmToday += s.today;
      farmSeven += s.sevenDay;
      farmCum += s.cumulative;
      farmRemaining += s.remaining;
      for (const w of s.weekly) {
        weekTotals.set(w.week, (weekTotals.get(w.week) ?? 0) + w.total);
      }
      if (s.today > 0) mortalityEnteredToday += 1;
      if (s.today === 0) missing = true;
      if (s.status === "Critical") worst = "Critical";
      else if (s.status === "High" && worst !== "Critical") worst = "High";
      else if (s.status === "Watch" && worst === "Normal") worst = "Watch";
    }

    if (missing) farmsMissingToday += 1;

    const flockAgeDays = birdAgeFromPlacement(flock.placement_date, today);
    let daysUntilCatch: number | null = null;
    if (flock.projected_catch_date) {
      const [ty, tm, td] = today.split("-").map(Number);
      const [cy, cm, cd] = flock.projected_catch_date.split("-").map(Number);
      daysUntilCatch = Math.max(
        0,
        Math.round(
          (Date.UTC(cy!, (cm ?? 1) - 1, cd ?? 1) -
            Date.UTC(ty!, (tm ?? 1) - 1, td ?? 1)) /
            86400000,
        ),
      );
    }
    const avgDaily = farmSeven / 7;
    const projectedHeadCount =
      daysUntilCatch != null
        ? Math.max(0, Math.round(farmRemaining - avgDaily * daysUntilCatch - 150 * hfs.length))
        : null;
    const projectedMortality =
      daysUntilCatch != null
        ? Math.max(0, Math.round(farmCum + avgDaily * daysUntilCatch))
        : null;

    const catchDate =
      flock.projected_catch_date ?? addDaysKey(flock.placement_date, 52);
    // 14-day outlook so the Upcoming tile stays populated like the web app
    const schedule = buildFlockVisitSchedule(flock.placement_date, catchDate);
    const farmCompletions = completedByFarm.get(farm.id) ?? new Map();
    const { today: dueToday, upcoming } = splitScheduleForDashboard(
      schedule,
      today,
      14,
      farmCompletions,
    );
    const toRow = (v: ScheduledVisit & { completed: boolean }): ScheduleRow => ({
      farmId: farm.id,
      flockId: flock.id,
      farmName: farm.farmName,
      flockAgeDays,
      date: v.dateKey,
      label: v.label,
      completed: v.completed,
    });
    for (const v of dueToday) todaysSchedule.push(toRow(v));
    for (const v of upcoming) upcomingSchedule.push(toRow(v));

    const lastVisit = db.getFirstSync<{ visit_date: string }>(
      "SELECT visit_date FROM farm_visits WHERE farm_id = ? ORDER BY visit_date DESC LIMIT 1",
      [farm.id],
    );

    farmCards.push({
      id: farm.id,
      farmName: farm.farmName,
      growerName: farm.growerName,
      phoneNumber: farm.phoneNumber,
      houseCount: hfs.length || farm.numberOfHouses,
      flockAgeDays,
      placementDate: flock.placement_date,
      birdsPlaced: farmPlaced,
      projectedHeadCount,
      projectedMortality,
      todayMortality: farmToday,
      sevenDayMortality: farmSeven,
      cumulativeMortality: farmCum,
      cumulativeMortalityPct: calcPercentage(farmCum, farmPlaced),
      openIssues: 0,
      status: worst,
      missingTodayMortality: missing,
      weeklyMortality: Array.from(weekTotals.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([week, total]) => ({ week, total })),
      projectedCatchDate: flock.projected_catch_date,
      lastVisitDate: lastVisit?.visit_date ?? null,
    });
  }

  todaysSchedule.sort(
    (a, b) => a.farmName.localeCompare(b.farmName) || a.label.localeCompare(b.label),
  );
  upcomingSchedule.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      a.farmName.localeCompare(b.farmName) ||
      a.label.localeCompare(b.label),
  );

  const upcomingCatches = farmCards
    .filter((f) => f.projectedCatchDate && f.placementDate)
    .map((f) => ({
      farmId: f.id,
      farmName: f.farmName,
      date: f.projectedCatchDate!,
      flockAgeDays: f.flockAgeDays,
      /** Bird age (days) on the catch date. */
      catchAgeDays: birdAgeFromPlacement(f.placementDate!, f.projectedCatchDate!),
    }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 8);

  return {
    stats: {
      activeFarms: farms.length,
      activeHouses,
      totalBirdsPlaced,
      mortalityEnteredToday,
      farmsMissingToday,
      openIssues: 0,
      highPriorityIssues: 0,
    },
    farmCards,
    upcomingCatches,
    todaysSchedule,
    upcomingSchedule,
  };
}

export function getFarmDetail(farmId: string) {
  const db = getDb();
  const today = todayKey();
  const farm = db.getFirstSync<{
    id: string;
    farm_name: string;
    grower_name: string;
    phone_number: string | null;
    notes: string | null;
  }>("SELECT * FROM farms WHERE id = ?", [farmId]);
  if (!farm) throw new Error("Farm not found");

  const flock = db.getFirstSync<{
    id: string;
    flock_number: string;
    placement_date: string;
    projected_catch_date: string | null;
  }>(
    "SELECT * FROM flocks WHERE farm_id = ? AND flock_status = 'ACTIVE' LIMIT 1",
    [farmId],
  );

  const housesRaw = db.getAllSync<{
    id: string;
    house_number: number;
    square_footage: number;
    total_fan_cfm: number | null;
    number_of_fans: number | null;
  }>(
    "SELECT * FROM houses WHERE farm_id = ? AND deleted_at IS NULL ORDER BY house_number ASC",
    [farmId],
  );

  const flockAgeDays = flock
    ? birdAgeFromPlacement(flock.placement_date, today)
    : null;
  const flockWeek = flockAgeDays != null ? flockWeekFromAge(flockAgeDays) : null;

  // Match web resolveCatchDate: projected catch, else placement + 52 days
  const resolvedCatchDate = flock
    ? (flock.projected_catch_date ?? addDaysKey(flock.placement_date, 52))
    : null;

  const daysUntilCatch =
    resolvedCatchDate != null
      ? (() => {
          const [ty, tm, td] = today.split("-").map(Number);
          const [cy, cm, cd] = resolvedCatchDate.split("-").map(Number);
          return Math.max(
            0,
            Math.round(
              (Date.UTC(cy!, (cm ?? 1) - 1, cd ?? 1) -
                Date.UTC(ty!, (tm ?? 1) - 1, td ?? 1)) /
                86400000,
            ),
          );
        })()
      : null;

  const houses = housesRaw.map((h) => {
    const hf = flock
      ? db.getFirstSync<{ id: string; placed_bird_count: number }>(
          "SELECT id, placed_bird_count FROM house_flocks WHERE flock_id = ? AND house_id = ?",
          [flock.id, h.id],
        )
      : null;

    let summary = {
      today: 0,
      sevenDay: 0,
      cumulative: 0,
      cumulativePct: 0,
      remaining: hf?.placed_bird_count ?? 0,
      status: "Normal",
      weekly: [] as Array<{ week: number; total: number }>,
    };

    if (hf) {
      const records = db.getAllSync<MortRow>(
        `SELECT mortality_date, bird_age_in_days, daily_mortality_count, cull_count, total_daily_loss
         FROM daily_mortality WHERE house_flock_id = ? AND is_draft = 0 ORDER BY mortality_date ASC`,
        [hf.id],
      );
      summary = summarizeHouse(hf.placed_bird_count, records, today);
    }

    const avgDaily = summary.sevenDay / 7;
    const projectedHeadCount =
      daysUntilCatch != null
        ? Math.max(0, Math.round(summary.remaining - avgDaily * daysUntilCatch - 150))
        : null;
    const projectedMortality =
      daysUntilCatch != null
        ? Math.max(0, Math.round(summary.cumulative + avgDaily * daysUntilCatch))
        : null;

    const minVent =
      hf && flockWeek != null && h.total_fan_cfm != null && h.total_fan_cfm > 0
        ? recommendedMinVent({
            birdsPlaced: hf.placed_bird_count,
            flockWeek,
            totalFanCFM: h.total_fan_cfm,
          })
        : null;

    return {
      id: h.id,
      houseNumber: h.house_number,
      squareFootage: h.square_footage,
      totalFanCFM: h.total_fan_cfm,
      numberOfFans: h.number_of_fans,
      cfmPerSqFt:
        h.total_fan_cfm != null && h.square_footage > 0
          ? h.total_fan_cfm / h.square_footage
          : null,
      placedBirdCount: hf?.placed_bird_count ?? null,
      todayMortality: summary.today,
      sevenDayMortality: summary.sevenDay,
      cumulativeMortality: summary.cumulative,
      cumulativeMortalityPct: summary.cumulativePct,
      remainingBirdCount: summary.remaining,
      projectedHeadCount,
      projectedMortality,
      weeklyMortality: summary.weekly,
      recommendedMinVent: minVent
        ? formatMinVentCycle(minVent.onSeconds, minVent.offSeconds)
        : null,
      status: summary.status,
    };
  });

  const latestCompleted =
    flock == null
      ? db.getFirstSync<{
          id: string;
          flock_number: string;
          placement_date: string;
          projected_catch_date: string | null;
          actual_catch_date: string | null;
        }>(
          `SELECT id, flock_number, placement_date, projected_catch_date, actual_catch_date
           FROM flocks
           WHERE farm_id = ? AND flock_status = 'COMPLETED'
           ORDER BY placement_date DESC LIMIT 1`,
          [farmId],
        )
      : null;

  return {
    farm: {
      id: farm.id,
      farmName: farm.farm_name,
      growerName: farm.grower_name,
      phoneNumber: farm.phone_number,
      notes: farm.notes,
    },
    activeFlock: flock
      ? {
          id: flock.id,
          flockNumber: flock.flock_number,
          placementDate: flock.placement_date,
          projectedCatchDate: flock.projected_catch_date,
          resolvedCatchDate,
          flockAgeDays,
          flockWeek,
        }
      : null,
    latestCompletedFlock: latestCompleted
      ? {
          id: latestCompleted.id,
          flockNumber: latestCompleted.flock_number,
          placementDate: latestCompleted.placement_date,
          projectedCatchDate: latestCompleted.projected_catch_date,
          actualCatchDate: latestCompleted.actual_catch_date,
        }
      : null,
    houses,
    visits: db.getAllSync<{
      id: string;
      visit_date: string;
      visit_type: string;
      bird_age_in_days: number | null;
      general_bird_condition: string | null;
      notes: string | null;
      follow_up_required: number;
      follow_up_date: string | null;
    }>(
      "SELECT * FROM farm_visits WHERE farm_id = ? ORDER BY visit_date DESC, id DESC LIMIT 12",
      [farmId],
    ).map((v) => ({
      id: v.id,
      visitDate: v.visit_date,
      visitType: v.visit_type,
      birdAgeInDays: v.bird_age_in_days,
      generalBirdCondition: v.general_bird_condition,
      notes: v.notes,
      followUpRequired: v.follow_up_required === 1,
      followUpDate: v.follow_up_date,
    })),
    issues: db.getAllSync<{
      id: string;
      date_reported: string;
      house_id: string | null;
      priority: string;
      status: string;
      category: string;
      assigned_to: string | null;
      description: string;
      corrective_action: string | null;
    }>(
      "SELECT * FROM farm_issues WHERE farm_id = ? ORDER BY date_reported DESC, id DESC LIMIT 12",
      [farmId],
    ).map((issue) => ({
      id: issue.id,
      dateReported: issue.date_reported,
      houseId: issue.house_id,
      priority: issue.priority,
      status: issue.status,
      category: issue.category,
      assignedTo: issue.assigned_to,
      description: issue.description,
      correctiveAction: issue.corrective_action,
    })),
    litterEvents: db.getAllSync<{
      id: string;
      event_date: string;
      event_type: string;
      house_id: string | null;
      house_number: number | null;
      contractor: string | null;
      litter_depth: number | null;
      cost: number | null;
      notes: string | null;
    }>(
      `SELECT e.*, h.house_number
       FROM litter_events e
       LEFT JOIN houses h ON h.id = e.house_id
       WHERE e.farm_id = ?
       ORDER BY e.event_date DESC, e.id DESC LIMIT 12`,
      [farmId],
    ).map((e) => ({
      id: e.id,
      eventDate: e.event_date,
      eventType: e.event_type,
      houseId: e.house_id,
      houseNumber: e.house_number,
      contractor: e.contractor,
      litterDepth: e.litter_depth,
      cost: e.cost,
      notes: e.notes,
    })),
    feedDeliveries: db.getAllSync<{
      id: string;
      delivery_date: string;
      pounds_delivered: number;
      flock_id: string | null;
      house_flock_id: string | null;
      house_number: number | null;
      feed_type: string | null;
      feed_mill: string | null;
      ticket_number: string | null;
      notes: string | null;
    }>(
      `SELECT d.*, h.house_number
       FROM feed_deliveries d
       LEFT JOIN house_flocks hf ON hf.id = d.house_flock_id
       LEFT JOIN houses h ON h.id = hf.house_id
       LEFT JOIN flocks f ON f.id = d.flock_id
       WHERE f.farm_id = ? OR EXISTS (
         SELECT 1 FROM house_flocks hf2
         JOIN flocks f2 ON f2.id = hf2.flock_id
         WHERE hf2.id = d.house_flock_id AND f2.farm_id = ?
       )
       ORDER BY d.delivery_date DESC, d.id DESC LIMIT 12`,
      [farmId, farmId],
    ).map((d) => ({
      id: d.id,
      deliveryDate: d.delivery_date,
      poundsDelivered: d.pounds_delivered,
      flockId: d.flock_id,
      houseFlockId: d.house_flock_id,
      houseNumber: d.house_number,
      feedType: d.feed_type,
      feedMill: d.feed_mill,
      ticketNumber: d.ticket_number,
      notes: d.notes,
    })),
    flocks: db.getAllSync<{
      id: string;
      flock_number: string;
      flock_status: string;
    }>(
      `SELECT id, flock_number, flock_status FROM flocks
       WHERE farm_id = ? ORDER BY placement_date DESC`,
      [farmId],
    ).map((fl) => {
      const flHouses = db.getAllSync<{
        house_flock_id: string;
        house_number: number;
      }>(
        `SELECT hf.id as house_flock_id, h.house_number
         FROM house_flocks hf
         JOIN houses h ON h.id = hf.house_id
         WHERE hf.flock_id = ? AND h.deleted_at IS NULL
         ORDER BY h.house_number ASC`,
        [fl.id],
      );
      return {
        id: fl.id,
        flockNumber: fl.flock_number,
        status: fl.flock_status,
        houses: flHouses.map((h) => ({
          houseFlockId: h.house_flock_id,
          houseNumber: h.house_number,
        })),
      };
    }),
  };
}

export function getMortalityForm(date: string, farmId?: string) {
  const db = getDb();
  const farms = listFarms().farms;
  return {
    date,
    disclaimer: "Saved on this phone (offline).",
    farms: farms
      .filter((f) => !farmId || f.id === farmId)
      .map((f) => {
        const flock = db.getFirstSync<{ id: string; flock_number: string; placement_date: string }>(
          "SELECT id, flock_number, placement_date FROM flocks WHERE farm_id = ? AND flock_status = 'ACTIVE' LIMIT 1",
          [f.id],
        );
        if (!flock) {
          return { id: f.id, farmName: f.farmName, activeFlock: null };
        }
        const hfs = db.getAllSync<{
          id: string;
          house_id: string;
          placed_bird_count: number;
          house_number: number;
        }>(
          `SELECT hf.id, hf.house_id, hf.placed_bird_count, h.house_number
           FROM house_flocks hf
           JOIN houses h ON h.id = hf.house_id
           WHERE hf.flock_id = ? AND h.deleted_at IS NULL
           ORDER BY h.house_number ASC`,
          [flock.id],
        );

        return {
          id: f.id,
          farmName: f.farmName,
          activeFlock: {
            id: flock.id,
            flockNumber: flock.flock_number,
            placementDate: flock.placement_date,
            houses: hfs.map((hf) => {
              const records = db.getAllSync<MortRow>(
                `SELECT mortality_date, bird_age_in_days, daily_mortality_count, cull_count, total_daily_loss
                 FROM daily_mortality WHERE house_flock_id = ? AND is_draft = 0 ORDER BY mortality_date ASC`,
                [hf.id],
              );
              const summary = summarizeHouse(hf.placed_bird_count, records, date);
              const existing = db.getFirstSync<{
                daily_mortality_count: number;
                cull_count: number;
                mortality_cause: string;
                comments: string | null;
              }>(
                `SELECT daily_mortality_count, cull_count, mortality_cause, comments
                 FROM daily_mortality WHERE house_flock_id = ? AND mortality_date = ?`,
                [hf.id, date],
              );
              return {
                houseFlockId: hf.id,
                houseNumber: hf.house_number,
                placedBirdCount: hf.placed_bird_count,
                existing: existing
                  ? {
                      dailyMortalityCount: existing.daily_mortality_count,
                      cullCount: existing.cull_count,
                      mortalityCause: existing.mortality_cause,
                      comments: existing.comments,
                    }
                  : null,
                rolling7Day: summary.sevenDay,
                cumulative: summary.cumulative,
                cumulativePct: summary.cumulativePct,
                remaining: summary.remaining,
              };
            }),
          },
        };
      }),
  };
}

export function saveMortality(input: {
  flockId: string;
  mortalityDate: string;
  entries: Array<{
    houseFlockId: string;
    dailyMortalityCount: number;
    cullCount: number;
    mortalityCause: string;
    comments?: string | null;
    isDraft?: boolean;
  }>;
}) {
  const db = getDb();
  const flock = db.getFirstSync<{ placement_date: string }>(
    "SELECT placement_date FROM flocks WHERE id = ?",
    [input.flockId],
  );
  if (!flock) throw new Error("Flock not found");
  const age = birdAgeFromPlacement(flock.placement_date, input.mortalityDate);

  const houseSummaries = [];
  let farmTotal = 0;

  for (const e of input.entries) {
    const loss = calcTotalDailyLoss(e.dailyMortalityCount, e.cullCount);
    farmTotal += loss;
    const existing = db.getFirstSync<{ id: string }>(
      "SELECT id FROM daily_mortality WHERE house_flock_id = ? AND mortality_date = ?",
      [e.houseFlockId, input.mortalityDate],
    );
    if (existing) {
      db.runSync(
        `UPDATE daily_mortality SET daily_mortality_count = ?, cull_count = ?, total_daily_loss = ?,
          mortality_cause = ?, comments = ?, is_draft = ?, bird_age_in_days = ?
         WHERE id = ?`,
        [
          e.dailyMortalityCount,
          e.cullCount,
          loss,
          e.mortalityCause,
          e.comments ?? null,
          e.isDraft ? 1 : 0,
          age,
          existing.id,
        ],
      );
    } else {
      db.runSync(
        `INSERT INTO daily_mortality
          (id, house_flock_id, mortality_date, bird_age_in_days, daily_mortality_count, cull_count, total_daily_loss, mortality_cause, comments, is_draft)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          newId("mort"),
          e.houseFlockId,
          input.mortalityDate,
          age,
          e.dailyMortalityCount,
          e.cullCount,
          loss,
          e.mortalityCause,
          e.comments ?? null,
          e.isDraft ? 1 : 0,
        ],
      );
    }

    const hf = db.getFirstSync<{ placed_bird_count: number; house_number: number }>(
      `SELECT hf.placed_bird_count, h.house_number
       FROM house_flocks hf JOIN houses h ON h.id = hf.house_id
       WHERE hf.id = ?`,
      [e.houseFlockId],
    );
    const records = db.getAllSync<MortRow>(
      `SELECT mortality_date, bird_age_in_days, daily_mortality_count, cull_count, total_daily_loss
       FROM daily_mortality WHERE house_flock_id = ? AND is_draft = 0 ORDER BY mortality_date ASC`,
      [e.houseFlockId],
    );
    const s = summarizeHouse(hf!.placed_bird_count, records, input.mortalityDate);
    houseSummaries.push({
      houseNumber: hf!.house_number,
      today: s.today,
      sevenDay: s.sevenDay,
      cumulative: s.cumulative,
      cumulativePct: s.cumulativePct,
      status: s.status,
    });
  }

  return {
    success: true,
    farmTotal,
    houseSummaries,
    birdAgeInDays: age,
    disclaimer: "Saved on this phone (offline).",
  };
}

export function getHouseMortalitySeries(houseFlockId: string) {
  const db = getDb();
  const hf = db.getFirstSync<{
    id: string;
    placed_bird_count: number;
    flock_id: string;
    house_number: number;
  }>(
    `SELECT hf.id, hf.placed_bird_count, hf.flock_id, h.house_number
     FROM house_flocks hf JOIN houses h ON h.id = hf.house_id WHERE hf.id = ?`,
    [houseFlockId],
  );
  if (!hf) throw new Error("House flock not found");
  const flock = db.getFirstSync<{ placement_date: string; projected_catch_date: string | null }>(
    "SELECT placement_date, projected_catch_date FROM flocks WHERE id = ?",
    [hf.flock_id],
  )!;
  const records = db.getAllSync<{
    mortality_date: string;
    bird_age_in_days: number;
    daily_mortality_count: number;
    cull_count: number;
  }>(
    `SELECT mortality_date, bird_age_in_days, daily_mortality_count, cull_count
     FROM daily_mortality WHERE house_flock_id = ? ORDER BY bird_age_in_days ASC`,
    [houseFlockId],
  );
  return {
    houseNumber: hf.house_number,
    placedBirdCount: hf.placed_bird_count,
    placementDate: flock.placement_date,
    projectedCatchDate: flock.projected_catch_date,
    records,
  };
}

export function saveHouseMortalitySeries(input: {
  houseFlockId: string;
  entries: Array<{
    mortalityDate: string;
    dailyMortalityCount: number;
    cullCount: number;
  }>;
  clearDates?: string[];
}) {
  const db = getDb();
  const hf = db.getFirstSync<{ flock_id: string }>(
    "SELECT flock_id FROM house_flocks WHERE id = ?",
    [input.houseFlockId],
  );
  if (!hf) throw new Error("House flock not found");
  const flock = db.getFirstSync<{ placement_date: string }>(
    "SELECT placement_date FROM flocks WHERE id = ?",
    [hf.flock_id],
  )!;

  for (const date of input.clearDates ?? []) {
    db.runSync(
      "DELETE FROM daily_mortality WHERE house_flock_id = ? AND mortality_date = ?",
      [input.houseFlockId, date],
    );
  }

  for (const e of input.entries) {
    const loss = calcTotalDailyLoss(e.dailyMortalityCount, e.cullCount);
    const age = birdAgeFromPlacement(flock.placement_date, e.mortalityDate);
    const existing = db.getFirstSync<{ id: string }>(
      "SELECT id FROM daily_mortality WHERE house_flock_id = ? AND mortality_date = ?",
      [input.houseFlockId, e.mortalityDate],
    );
    // Allow 0/0 — entering zero counts as a confirmed day entry
    if (existing) {
      db.runSync(
        `UPDATE daily_mortality SET daily_mortality_count = ?, cull_count = ?, total_daily_loss = ?,
          bird_age_in_days = ?, is_draft = 0 WHERE id = ?`,
        [e.dailyMortalityCount, e.cullCount, loss, age, existing.id],
      );
    } else {
      db.runSync(
        `INSERT INTO daily_mortality
          (id, house_flock_id, mortality_date, bird_age_in_days, daily_mortality_count, cull_count, total_daily_loss, mortality_cause, is_draft)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'UNKNOWN', 0)`,
        [
          newId("mort"),
          input.houseFlockId,
          e.mortalityDate,
          age,
          e.dailyMortalityCount,
          e.cullCount,
          loss,
        ],
      );
    }
  }
  return { success: true, disclaimer: "Saved on this phone (offline)." };
}

export function getReports(from: string, to: string, farmId?: string) {
  const db = getDb();
  const farms = listFarms().farms.filter((f) => !farmId || f.id === farmId);
  const dates: string[] = [];
  let cursor = from;
  while (cursor <= to) {
    dates.push(cursor);
    cursor = addDaysKey(cursor, 1);
    if (dates.length > 120) break;
  }

  const rows: Array<{ houseLabel: string; byDate: Record<string, number> }> = [];

  for (const farm of farms) {
    const flock = db.getFirstSync<{ id: string }>(
      "SELECT id FROM flocks WHERE farm_id = ? AND flock_status = 'ACTIVE' LIMIT 1",
      [farm.id],
    );
    if (!flock) continue;
    const hfs = db.getAllSync<{ id: string; house_number: number }>(
      `SELECT hf.id, h.house_number FROM house_flocks hf
       JOIN houses h ON h.id = hf.house_id WHERE hf.flock_id = ?
       ORDER BY h.house_number ASC`,
      [flock.id],
    );
    for (const hf of hfs) {
      const byDate: Record<string, number> = Object.fromEntries(dates.map((d) => [d, 0]));
      const records = db.getAllSync<{ mortality_date: string; total_daily_loss: number }>(
        `SELECT mortality_date, total_daily_loss FROM daily_mortality
         WHERE house_flock_id = ? AND is_draft = 0 AND mortality_date >= ? AND mortality_date <= ?`,
        [hf.id, from, to],
      );
      for (const r of records) {
        byDate[r.mortality_date] = (byDate[r.mortality_date] ?? 0) + r.total_daily_loss;
      }
      rows.push({
        houseLabel: farmId ? `House ${hf.house_number}` : `${farm.farmName} H${hf.house_number}`,
        byDate,
      });
    }
  }

  return { dates, rows };
}

export function listLfos() {
  const db = getDb();
  return db
    .getAllSync<{
      id: string;
      farm_id: string;
      order_date: string;
      notes: string | null;
      farm_name: string;
    }>(
      `SELECT l.*, f.farm_name FROM last_feed_orders l
       JOIN farms f ON f.id = l.farm_id
       ORDER BY l.order_date DESC`,
    )
    .map((r) => ({
      id: r.id,
      farmId: r.farm_id,
      farmName: r.farm_name,
      orderDate: r.order_date,
      notes: r.notes,
    }));
}

export function createLfo(farmId: string, orderDate: string, notes?: string) {
  const db = getDb();
  const flock = db.getFirstSync<{ id: string }>(
    "SELECT id FROM flocks WHERE farm_id = ? AND flock_status = 'ACTIVE' LIMIT 1",
    [farmId],
  );
  const id = newId("lfo");
  db.runSync(
    `INSERT INTO last_feed_orders (id, farm_id, flock_id, order_date, notes) VALUES (?, ?, ?, ?, ?)`,
    [id, farmId, flock?.id ?? null, orderDate, notes ?? null],
  );
  const houses = db.getAllSync<{ id: string }>(
    "SELECT id FROM houses WHERE farm_id = ? AND deleted_at IS NULL ORDER BY house_number ASC",
    [farmId],
  );
  for (const h of houses) {
    db.runSync(
      `INSERT INTO lfo_house_inventory (id, lfo_id, house_id, bin_a_pounds, bin_b_pounds, consumption_rate)
       VALUES (?, ?, ?, 0, 0, 0.45)`,
      [newId("lfoi"), id, h.id],
    );
  }
  return { id };
}

export function getLfo(id: string) {
  const db = getDb();
  const today = todayKey();
  const lfo = db.getFirstSync<{
    id: string;
    farm_id: string;
    flock_id: string | null;
    order_date: string;
    notes: string | null;
  }>("SELECT * FROM last_feed_orders WHERE id = ?", [id]);
  if (!lfo) throw new Error("LFO not found");
  const farm = db.getFirstSync<{ farm_name: string }>(
    "SELECT farm_name FROM farms WHERE id = ?",
    [lfo.farm_id],
  );
  if (!farm) throw new Error("Farm not found for LFO");

  const inventory = db.getAllSync<{
    id: string;
    house_id: string;
    house_number: number;
    bin_a_pounds: number;
    bin_b_pounds: number;
    feed_up_at: string | null;
    consumption_rate: number;
  }>(
    `SELECT i.*, h.house_number FROM lfo_house_inventory i
     JOIN houses h ON h.id = i.house_id WHERE i.lfo_id = ?
     ORDER BY h.house_number ASC`,
    [id],
  );

  const consumptionRate = inventory[0]?.consumption_rate ?? 0.45;

  return {
    id: lfo.id,
    farmId: lfo.farm_id,
    farmName: farm.farm_name,
    orderDate: lfo.order_date,
    notes: lfo.notes,
    consumptionRate,
    houses: inventory.map((i) => {
      let headCount = 0;
      const hf = db.getFirstSync<{ id: string; placed_bird_count: number }>(
        lfo.flock_id
          ? `SELECT id, placed_bird_count FROM house_flocks
             WHERE flock_id = ? AND house_id = ? LIMIT 1`
          : `SELECT hf.id, hf.placed_bird_count FROM house_flocks hf
             JOIN flocks f ON f.id = hf.flock_id
             WHERE f.farm_id = ? AND f.flock_status = 'ACTIVE' AND hf.house_id = ?
             LIMIT 1`,
        lfo.flock_id ? [lfo.flock_id, i.house_id] : [lfo.farm_id, i.house_id],
      );
      if (hf) {
        const records = db.getAllSync<MortRow>(
          `SELECT mortality_date, bird_age_in_days, daily_mortality_count, cull_count, total_daily_loss
           FROM daily_mortality WHERE house_flock_id = ? ORDER BY mortality_date ASC`,
          [hf.id],
        );
        headCount = summarizeHouse(hf.placed_bird_count, records, today).remaining;
      }
      return {
        id: i.id,
        houseId: i.house_id,
        houseNumber: i.house_number,
        binAPounds: i.bin_a_pounds,
        binBPounds: i.bin_b_pounds,
        feedUpAt: i.feed_up_at,
        consumptionRate: i.consumption_rate,
        headCount,
      };
    }),
  };
}

export function updateLfoInventory(
  rows: Array<{
    id: string;
    binAPounds: number;
    binBPounds: number;
    feedUpAt: string | null;
    consumptionRate: number;
  }>,
) {
  const db = getDb();
  for (const r of rows) {
    db.runSync(
      `UPDATE lfo_house_inventory SET bin_a_pounds = ?, bin_b_pounds = ?, feed_up_at = ?, consumption_rate = ?
       WHERE id = ?`,
      [r.binAPounds, r.binBPounds, r.feedUpAt, r.consumptionRate, r.id],
    );
  }
  return { success: true };
}

/** Persist LFO header + all house inventory rows. */
export function updateLfo(input: {
  id: string;
  orderDate: string;
  notes: string | null;
  consumptionRate: number;
  houses: Array<{
    id: string;
    binAPounds: number;
    binBPounds: number;
    feedUpAt: string | null;
  }>;
}) {
  const db = getDb();
  const existing = db.getFirstSync<{ id: string }>(
    "SELECT id FROM last_feed_orders WHERE id = ?",
    [input.id],
  );
  if (!existing) throw new Error("LFO not found");

  db.runSync(`UPDATE last_feed_orders SET order_date = ?, notes = ? WHERE id = ?`, [
    input.orderDate,
    input.notes,
    input.id,
  ]);

  const rate =
    Number.isFinite(input.consumptionRate) && input.consumptionRate > 0
      ? input.consumptionRate
      : 0.45;

  for (const h of input.houses) {
    db.runSync(
      `UPDATE lfo_house_inventory
       SET bin_a_pounds = ?, bin_b_pounds = ?, feed_up_at = ?, consumption_rate = ?
       WHERE id = ? AND lfo_id = ?`,
      [h.binAPounds, h.binBPounds, h.feedUpAt, rate, h.id, input.id],
    );
  }
  return { success: true };
}

export function deleteLfo(id: string) {
  const db = getDb();
  db.runSync("DELETE FROM lfo_house_inventory WHERE lfo_id = ?", [id]);
  db.runSync("DELETE FROM last_feed_orders WHERE id = ?", [id]);
  return { success: true };
}

export function createFarm(input: {
  farmName: string;
  growerName?: string;
  phoneNumber?: string | null;
  notes?: string | null;
  numberOfHouses?: number;
}) {
  const db = getDb();
  const farmName = input.farmName.trim();
  if (!farmName) throw new Error("Farm name is required");

  const houseCount = Math.max(
    0,
    Math.min(40, Math.floor(Number(input.numberOfHouses ?? 0) || 0)),
  );
  const id = newId("farm");
  const growerName = (input.growerName ?? "").trim();
  const phoneNumber = input.phoneNumber?.trim() || null;
  const notes = input.notes?.trim() || null;

  db.runSync(
    `INSERT INTO farms (id, farm_name, grower_name, phone_number, notes, number_of_houses, is_active)
     VALUES (?, ?, ?, ?, ?, ?, 1)`,
    [id, farmName, growerName, phoneNumber, notes, houseCount],
  );

  for (let n = 1; n <= houseCount; n++) {
    db.runSync(
      `INSERT INTO houses (id, farm_id, house_number, square_footage, total_fan_cfm, number_of_fans)
       VALUES (?, ?, ?, 29700, NULL, NULL)`,
      [newId("house"), id, n],
    );
  }

  return { id };
}

export function updateFarm(
  farmId: string,
  input: {
    farmName: string;
    growerName?: string;
    phoneNumber?: string | null;
    notes?: string | null;
  },
) {
  const db = getDb();
  const farm = db.getFirstSync<{ id: string }>("SELECT id FROM farms WHERE id = ?", [farmId]);
  if (!farm) throw new Error("Farm not found");

  const farmName = input.farmName.trim();
  if (!farmName) throw new Error("Farm name is required");

  db.runSync(
    `UPDATE farms
     SET farm_name = ?, grower_name = ?, phone_number = ?, notes = ?
     WHERE id = ?`,
    [
      farmName,
      (input.growerName ?? "").trim(),
      input.phoneNumber?.trim() || null,
      input.notes?.trim() || null,
      farmId,
    ],
  );
  return { success: true as const };
}

/** Soft-delete: hide from active lists (matches web deleteFarmAction). */
export function deleteFarm(farmId: string) {
  const db = getDb();
  db.runSync("UPDATE farms SET is_active = 0 WHERE id = ?", [farmId]);
  return { success: true };
}

type VisitInput = {
  farmId: string;
  flockId?: string | null;
  visitDate: string;
  visitType?: string;
  generalBirdCondition?: string | null;
  notes?: string | null;
  followUpRequired?: boolean;
  followUpDate?: string | null;
};

function resolveVisitFlockAge(farmId: string, flockId: string | null | undefined, visitDate: string) {
  const db = getDb();
  const resolvedFlockId =
    flockId ??
    db.getFirstSync<{ id: string }>(
      "SELECT id FROM flocks WHERE farm_id = ? AND flock_status = 'ACTIVE' LIMIT 1",
      [farmId],
    )?.id ??
    null;
  let age: number | null = null;
  if (resolvedFlockId) {
    const flock = db.getFirstSync<{ placement_date: string }>(
      "SELECT placement_date FROM flocks WHERE id = ?",
      [resolvedFlockId],
    );
    if (flock) age = birdAgeFromPlacement(flock.placement_date, visitDate);
  }
  return { flockId: resolvedFlockId, age };
}

export function createVisit(input: VisitInput) {
  const db = getDb();
  if (!input.visitDate?.trim()) throw new Error("Visit date is required");
  const { flockId, age } = resolveVisitFlockAge(input.farmId, input.flockId, input.visitDate);
  const id = newId("visit");
  const followUp = Boolean(input.followUpRequired);
  db.runSync(
    `INSERT INTO farm_visits
      (id, farm_id, flock_id, visit_date, visit_type, bird_age_in_days, general_bird_condition, notes, follow_up_required, follow_up_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.farmId,
      flockId,
      input.visitDate,
      input.visitType ?? "ROUTINE_SERVICE",
      age,
      input.generalBirdCondition?.trim() || "Healthy",
      input.notes?.trim() ? input.notes.trim() : null,
      followUp ? 1 : 0,
      followUp && input.followUpDate ? input.followUpDate : null,
    ],
  );
  return { id, birdAgeInDays: age };
}

export function getVisit(farmId: string, visitId: string) {
  const db = getDb();
  const v = db.getFirstSync<{
    id: string;
    farm_id: string;
    flock_id: string | null;
    visit_date: string;
    visit_type: string;
    bird_age_in_days: number | null;
    general_bird_condition: string | null;
    notes: string | null;
    follow_up_required: number;
    follow_up_date: string | null;
  }>("SELECT * FROM farm_visits WHERE id = ? AND farm_id = ?", [visitId, farmId]);
  if (!v) throw new Error("Visit not found");
  return {
    id: v.id,
    farmId: v.farm_id,
    flockId: v.flock_id,
    visitDate: v.visit_date,
    visitType: v.visit_type,
    birdAgeInDays: v.bird_age_in_days,
    generalBirdCondition: v.general_bird_condition,
    notes: v.notes,
    followUpRequired: v.follow_up_required === 1,
    followUpDate: v.follow_up_date,
  };
}

export function updateVisit(visitId: string, input: VisitInput) {
  const db = getDb();
  const existing = db.getFirstSync<{ id: string; farm_id: string }>(
    "SELECT id, farm_id FROM farm_visits WHERE id = ? AND farm_id = ?",
    [visitId, input.farmId],
  );
  if (!existing) throw new Error("Visit not found");
  if (!input.visitDate?.trim()) throw new Error("Visit date is required");

  const { flockId, age } = resolveVisitFlockAge(input.farmId, input.flockId, input.visitDate);
  const followUp = Boolean(input.followUpRequired);
  db.runSync(
    `UPDATE farm_visits SET
       flock_id = ?, visit_date = ?, visit_type = ?, bird_age_in_days = ?,
       general_bird_condition = ?, notes = ?, follow_up_required = ?, follow_up_date = ?
     WHERE id = ? AND farm_id = ?`,
    [
      flockId,
      input.visitDate,
      input.visitType ?? "ROUTINE_SERVICE",
      age,
      input.generalBirdCondition?.trim() || "Healthy",
      input.notes?.trim() ? input.notes.trim() : null,
      followUp ? 1 : 0,
      followUp && input.followUpDate ? input.followUpDate : null,
      visitId,
      input.farmId,
    ],
  );
  return { success: true as const, birdAgeInDays: age };
}

export function deleteVisit(farmId: string, visitId: string) {
  const db = getDb();
  const existing = db.getFirstSync<{ id: string }>(
    "SELECT id FROM farm_visits WHERE id = ? AND farm_id = ?",
    [visitId, farmId],
  );
  if (!existing) throw new Error("Visit not found");
  db.runSync("DELETE FROM farm_visits WHERE id = ? AND farm_id = ?", [visitId, farmId]);
  return { success: true as const };
}

/** Create an active flock + house placements for a farm. */
export function createFlock(input: {
  farmId: string;
  flockNumber: string;
  placementDate: string;
  targetMarketAge?: number;
  projectedCatchDate?: string | null;
  housePlacements: Array<{ houseId: string; placedBirdCount: number }>;
}) {
  const db = getDb();
  const flockNumber = input.flockNumber.trim();
  if (!flockNumber) throw new Error("Flock number is required");
  if (!input.placementDate?.trim()) throw new Error("Placement date is required");
  if (!input.housePlacements.length) throw new Error("Add houses before creating a flock");

  const active = db.getFirstSync<{ id: string }>(
    "SELECT id FROM flocks WHERE farm_id = ? AND flock_status = 'ACTIVE' LIMIT 1",
    [input.farmId],
  );
  if (active) {
    throw new Error("Only one active flock is allowed per farm. Complete the current flock first.");
  }

  const marketAge =
    input.targetMarketAge != null && Number.isFinite(input.targetMarketAge) && input.targetMarketAge > 0
      ? Math.floor(input.targetMarketAge)
      : 52;
  const projectedCatchDate =
    input.projectedCatchDate?.trim() || addDaysKey(input.placementDate, marketAge);

  for (const hp of input.housePlacements) {
    const house = db.getFirstSync<{ id: string }>(
      "SELECT id FROM houses WHERE id = ? AND farm_id = ? AND deleted_at IS NULL",
      [hp.houseId, input.farmId],
    );
    if (!house) throw new Error("House not found on this farm");
    if (!Number.isFinite(hp.placedBirdCount) || hp.placedBirdCount < 1) {
      throw new Error("Placed bird count must be at least 1 for each house");
    }
  }

  const id = newId("flock");
  db.runSync(
    `INSERT INTO flocks (id, farm_id, flock_number, placement_date, projected_catch_date, flock_status)
     VALUES (?, ?, ?, ?, ?, 'ACTIVE')`,
    [id, input.farmId, flockNumber, input.placementDate, projectedCatchDate],
  );
  for (const hp of input.housePlacements) {
    db.runSync(
      `INSERT INTO house_flocks (id, flock_id, house_id, placed_bird_count)
       VALUES (?, ?, ?, ?)`,
      [newId("hf"), id, hp.houseId, Math.floor(hp.placedBirdCount)],
    );
  }
  return { id, projectedCatchDate };
}

export function completeFlock(flockId: string) {
  const db = getDb();
  const flock = db.getFirstSync<{
    id: string;
    farm_id: string;
    flock_status: string;
    actual_catch_date: string | null;
  }>("SELECT id, farm_id, flock_status, actual_catch_date FROM flocks WHERE id = ?", [flockId]);
  if (!flock) throw new Error("Flock not found");
  if (flock.flock_status !== "ACTIVE") throw new Error("Only an active flock can be completed");

  db.runSync(
    `UPDATE flocks
     SET flock_status = 'COMPLETED',
         actual_catch_date = COALESCE(actual_catch_date, ?)
     WHERE id = ?`,
    [todayKey(), flockId],
  );
  return { success: true as const, farmId: flock.farm_id };
}

export function reactivateFlock(flockId: string) {
  const db = getDb();
  const flock = db.getFirstSync<{
    id: string;
    farm_id: string;
    flock_status: string;
    flock_number: string;
  }>("SELECT id, farm_id, flock_status, flock_number FROM flocks WHERE id = ?", [flockId]);
  if (!flock) throw new Error("Flock not found");
  if (flock.flock_status === "ACTIVE") throw new Error("Flock is already active");

  const otherActive = db.getFirstSync<{ id: string; flock_number: string }>(
    `SELECT id, flock_number FROM flocks
     WHERE farm_id = ? AND flock_status = 'ACTIVE' AND id != ? LIMIT 1`,
    [flock.farm_id, flockId],
  );
  if (otherActive) {
    throw new Error(
      `Farm already has an active flock (${otherActive.flock_number}). Complete that one first.`,
    );
  }

  db.runSync(
    `UPDATE flocks SET flock_status = 'ACTIVE', actual_catch_date = NULL WHERE id = ?`,
    [flockId],
  );
  return { success: true as const, farmId: flock.farm_id };
}

/** Past/current flock summary for the farm History screen. */
export function getFarmHistory(farmId: string) {
  const db = getDb();
  const farm = db.getFirstSync<{ id: string; farm_name: string }>(
    "SELECT id, farm_name FROM farms WHERE id = ?",
    [farmId],
  );
  if (!farm) throw new Error("Farm not found");

  const flocks = db.getAllSync<{
    id: string;
    flock_number: string;
    placement_date: string;
    projected_catch_date: string | null;
    actual_catch_date: string | null;
    flock_status: string;
  }>(
    `SELECT id, flock_number, placement_date, projected_catch_date, actual_catch_date, flock_status
     FROM flocks WHERE farm_id = ?
     ORDER BY placement_date DESC`,
    [farmId],
  );

  const rows = flocks.map((flock) => {
    const hfs = db.getAllSync<{
      id: string;
      placed_bird_count: number;
      house_number: number;
    }>(
      `SELECT hf.id, hf.placed_bird_count, h.house_number
       FROM house_flocks hf
       JOIN houses h ON h.id = hf.house_id
       WHERE hf.flock_id = ? AND h.deleted_at IS NULL
       ORDER BY h.house_number ASC`,
      [flock.id],
    );

    let placed = 0;
    let totalLoss = 0;
    const houseMortPcts: Array<{ houseNumber: number; mortPct: number }> = [];
    for (const hf of hfs) {
      placed += hf.placed_bird_count;
      const records = db.getAllSync<MortRow>(
        `SELECT mortality_date, bird_age_in_days, daily_mortality_count, cull_count, total_daily_loss
         FROM daily_mortality WHERE house_flock_id = ? AND is_draft = 0 ORDER BY mortality_date ASC`,
        [hf.id],
      );
      const summary = summarizeHouse(hf.placed_bird_count, records, todayKey());
      totalLoss += summary.cumulative;
      houseMortPcts.push({
        houseNumber: hf.house_number,
        mortPct: summary.cumulativePct,
      });
    }

    const catchDate =
      flock.actual_catch_date ?? flock.projected_catch_date ?? null;
    const marketAge =
      catchDate != null
        ? birdAgeFromPlacement(flock.placement_date, catchDate)
        : null;
    const mortPct = calcPercentage(totalLoss, placed);
    const livability = placed > 0 ? 100 - mortPct : null;

    return {
      id: flock.id,
      flockNumber: flock.flock_number,
      flockStatus: flock.flock_status,
      placementDate: flock.placement_date,
      catchDate,
      marketAge,
      birdsPlaced: placed,
      cumulativeMortality: totalLoss,
      mortPct,
      livability,
      houseMortPcts,
    };
  });

  const current = rows.find((r) => r.flockStatus === "ACTIVE") ?? rows[0] ?? null;
  const previous = rows
    .filter((r) => r.id !== current?.id && r.flockStatus !== "ACTIVE")
    .slice(0, 3);

  return {
    farm: { id: farm.id, farmName: farm.farm_name },
    current,
    previous,
    all: rows,
  };
}

export function updateHouse(
  farmId: string,
  houseId: string,
  input: {
    houseNumber: number;
    squareFootage: number;
    totalFanCFM: number | null;
    numberOfFans: number | null;
  },
) {
  const db = getDb();
  const house = db.getFirstSync<{ id: string }>(
    "SELECT id FROM houses WHERE id = ? AND farm_id = ? AND deleted_at IS NULL",
    [houseId, farmId],
  );
  if (!house) throw new Error("House not found");

  const houseNumber = Math.floor(Number(input.houseNumber));
  const squareFootage = Number(input.squareFootage);
  if (!Number.isFinite(houseNumber) || houseNumber < 1) {
    throw new Error("House number must be at least 1");
  }
  if (!Number.isFinite(squareFootage) || squareFootage <= 0) {
    throw new Error("Square footage is required");
  }

  const conflict = db.getFirstSync<{ id: string }>(
    `SELECT id FROM houses
     WHERE farm_id = ? AND house_number = ? AND deleted_at IS NULL AND id != ?`,
    [farmId, houseNumber, houseId],
  );
  if (conflict) throw new Error(`House ${houseNumber} already exists on this farm`);

  db.runSync(
    `UPDATE houses
     SET house_number = ?, square_footage = ?, total_fan_cfm = ?, number_of_fans = ?
     WHERE id = ? AND farm_id = ?`,
    [
      houseNumber,
      squareFootage,
      input.totalFanCFM,
      input.numberOfFans,
      houseId,
      farmId,
    ],
  );
  return { success: true as const };
}

export function deleteHouse(farmId: string, houseId: string) {
  const db = getDb();
  const house = db.getFirstSync<{ id: string }>(
    "SELECT id FROM houses WHERE id = ? AND farm_id = ? AND deleted_at IS NULL",
    [houseId, farmId],
  );
  if (!house) throw new Error("House not found");

  db.runSync(
    "UPDATE houses SET deleted_at = ? WHERE id = ? AND farm_id = ?",
    [new Date().toISOString(), houseId, farmId],
  );
  const count = db.getFirstSync<{ c: number }>(
    "SELECT COUNT(*) as c FROM houses WHERE farm_id = ? AND deleted_at IS NULL",
    [farmId],
  );
  db.runSync("UPDATE farms SET number_of_houses = ? WHERE id = ?", [
    count?.c ?? 0,
    farmId,
  ]);
  return { success: true as const };
}

/** Mark / unmark a schedule follow-up. Completions are keyed by farm + date + label. */
export function toggleFollowUpCompletion(input: {
  farmId: string;
  flockId?: string | null;
  scheduledDate: string;
  label: string;
  completed: boolean;
}) {
  const db = getDb();
  if (!input.completed) {
    db.runSync(
      `DELETE FROM follow_up_completions
       WHERE farm_id = ? AND scheduled_date = ? AND label = ?`,
      [input.farmId, input.scheduledDate, input.label],
    );
    return { success: true as const };
  }

  const id = newId("fuc");
  const completedAt = new Date().toISOString();
  db.runSync(
    `INSERT INTO follow_up_completions
      (id, farm_id, flock_id, scheduled_date, label, completed_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(farm_id, scheduled_date, label) DO UPDATE SET
       completed_at = excluded.completed_at,
       flock_id = excluded.flock_id`,
    [
      id,
      input.farmId,
      input.flockId ?? null,
      input.scheduledDate,
      input.label,
      completedAt,
    ],
  );
  return { success: true as const };
}

/* ─── Issues ───────────────────────────────────────────────────────────── */

type IssueInput = {
  farmId: string;
  flockId?: string | null;
  houseId?: string | null;
  dateReported: string;
  category?: string;
  priority?: string;
  status?: string;
  assignedTo?: string | null;
  description: string;
  correctiveAction?: string | null;
};

export function createIssue(input: IssueInput) {
  const db = getDb();
  if (!input.dateReported?.trim()) throw new Error("Date reported is required");
  const description = input.description.trim();
  if (!description) throw new Error("Description is required");
  const id = newId("issue");
  db.runSync(
    `INSERT INTO farm_issues
      (id, farm_id, house_id, flock_id, date_reported, category, priority, description, corrective_action, assigned_to, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.farmId,
      input.houseId || null,
      input.flockId || null,
      input.dateReported,
      input.category ?? "OTHER",
      input.priority ?? "MEDIUM",
      description,
      input.correctiveAction?.trim() || null,
      input.assignedTo?.trim() || null,
      input.status ?? "OPEN",
    ],
  );
  return { id };
}

export function getIssue(farmId: string, issueId: string) {
  const db = getDb();
  const issue = db.getFirstSync<{
    id: string;
    farm_id: string;
    house_id: string | null;
    flock_id: string | null;
    date_reported: string;
    category: string;
    priority: string;
    description: string;
    corrective_action: string | null;
    assigned_to: string | null;
    status: string;
  }>("SELECT * FROM farm_issues WHERE id = ? AND farm_id = ?", [issueId, farmId]);
  if (!issue) throw new Error("Issue not found");
  return {
    id: issue.id,
    farmId: issue.farm_id,
    houseId: issue.house_id,
    flockId: issue.flock_id,
    dateReported: issue.date_reported,
    category: issue.category,
    priority: issue.priority,
    description: issue.description,
    correctiveAction: issue.corrective_action,
    assignedTo: issue.assigned_to,
    status: issue.status,
  };
}

export function updateIssue(issueId: string, input: IssueInput) {
  const db = getDb();
  const existing = db.getFirstSync<{ id: string }>(
    "SELECT id FROM farm_issues WHERE id = ? AND farm_id = ?",
    [issueId, input.farmId],
  );
  if (!existing) throw new Error("Issue not found");
  if (!input.dateReported?.trim()) throw new Error("Date reported is required");
  const description = input.description.trim();
  if (!description) throw new Error("Description is required");
  db.runSync(
    `UPDATE farm_issues SET
       house_id = ?, flock_id = ?, date_reported = ?, category = ?, priority = ?,
       description = ?, corrective_action = ?, assigned_to = ?, status = ?
     WHERE id = ? AND farm_id = ?`,
    [
      input.houseId || null,
      input.flockId || null,
      input.dateReported,
      input.category ?? "OTHER",
      input.priority ?? "MEDIUM",
      description,
      input.correctiveAction?.trim() || null,
      input.assignedTo?.trim() || null,
      input.status ?? "OPEN",
      issueId,
      input.farmId,
    ],
  );
  return { success: true as const };
}

export function deleteIssue(farmId: string, issueId: string) {
  const db = getDb();
  const existing = db.getFirstSync<{ id: string }>(
    "SELECT id FROM farm_issues WHERE id = ? AND farm_id = ?",
    [issueId, farmId],
  );
  if (!existing) throw new Error("Issue not found");
  db.runSync("DELETE FROM farm_issues WHERE id = ? AND farm_id = ?", [issueId, farmId]);
  return { success: true as const };
}

/* ─── Litter events ────────────────────────────────────────────────────── */

type LitterInput = {
  farmId: string;
  houseId?: string | null;
  eventDate: string;
  eventType?: string;
  contractor?: string | null;
  litterDepth?: number | null;
  cost?: number | null;
  notes?: string | null;
};

export function createLitterEvent(input: LitterInput) {
  const db = getDb();
  if (!input.eventDate?.trim()) throw new Error("Event date is required");
  const id = newId("litter");
  db.runSync(
    `INSERT INTO litter_events
      (id, farm_id, house_id, event_date, event_type, litter_depth, contractor, cost, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.farmId,
      input.houseId || null,
      input.eventDate,
      input.eventType ?? "FULL_LITTER_CLEANOUT",
      input.litterDepth ?? null,
      input.contractor?.trim() || null,
      input.cost ?? null,
      input.notes?.trim() || null,
    ],
  );
  return { id };
}

export function getLitterEvent(farmId: string, eventId: string) {
  const db = getDb();
  const e = db.getFirstSync<{
    id: string;
    farm_id: string;
    house_id: string | null;
    event_date: string;
    event_type: string;
    litter_depth: number | null;
    contractor: string | null;
    cost: number | null;
    notes: string | null;
  }>("SELECT * FROM litter_events WHERE id = ? AND farm_id = ?", [eventId, farmId]);
  if (!e) throw new Error("Litter event not found");
  return {
    id: e.id,
    farmId: e.farm_id,
    houseId: e.house_id,
    eventDate: e.event_date,
    eventType: e.event_type,
    litterDepth: e.litter_depth,
    contractor: e.contractor,
    cost: e.cost,
    notes: e.notes,
  };
}

export function updateLitterEvent(eventId: string, input: LitterInput) {
  const db = getDb();
  const existing = db.getFirstSync<{ id: string }>(
    "SELECT id FROM litter_events WHERE id = ? AND farm_id = ?",
    [eventId, input.farmId],
  );
  if (!existing) throw new Error("Litter event not found");
  if (!input.eventDate?.trim()) throw new Error("Event date is required");
  db.runSync(
    `UPDATE litter_events SET
       house_id = ?, event_date = ?, event_type = ?, litter_depth = ?,
       contractor = ?, cost = ?, notes = ?
     WHERE id = ? AND farm_id = ?`,
    [
      input.houseId || null,
      input.eventDate,
      input.eventType ?? "FULL_LITTER_CLEANOUT",
      input.litterDepth ?? null,
      input.contractor?.trim() || null,
      input.cost ?? null,
      input.notes?.trim() || null,
      eventId,
      input.farmId,
    ],
  );
  return { success: true as const };
}

export function deleteLitterEvent(farmId: string, eventId: string) {
  const db = getDb();
  const existing = db.getFirstSync<{ id: string }>(
    "SELECT id FROM litter_events WHERE id = ? AND farm_id = ?",
    [eventId, farmId],
  );
  if (!existing) throw new Error("Litter event not found");
  db.runSync("DELETE FROM litter_events WHERE id = ? AND farm_id = ?", [eventId, farmId]);
  return { success: true as const };
}

/* ─── Feed deliveries ──────────────────────────────────────────────────── */

type FeedInput = {
  flockId?: string | null;
  houseFlockId?: string | null;
  deliveryDate: string;
  poundsDelivered: number;
  feedType?: string | null;
  feedMill?: string | null;
  ticketNumber?: string | null;
  notes?: string | null;
};

export function createFeedDelivery(input: FeedInput) {
  const db = getDb();
  if (!input.deliveryDate?.trim()) throw new Error("Delivery date is required");
  if (!Number.isFinite(input.poundsDelivered) || input.poundsDelivered <= 0) {
    throw new Error("Pounds delivered must be greater than 0");
  }
  const id = newId("feed");
  db.runSync(
    `INSERT INTO feed_deliveries
      (id, flock_id, house_flock_id, delivery_date, feed_type, feed_mill, ticket_number, pounds_delivered, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.flockId || null,
      input.houseFlockId || null,
      input.deliveryDate,
      input.feedType?.trim() || null,
      input.feedMill?.trim() || null,
      input.ticketNumber?.trim() || null,
      input.poundsDelivered,
      input.notes?.trim() || null,
    ],
  );
  return { id };
}

export function getFeedDelivery(deliveryId: string) {
  const db = getDb();
  const d = db.getFirstSync<{
    id: string;
    flock_id: string | null;
    house_flock_id: string | null;
    delivery_date: string;
    feed_type: string | null;
    feed_mill: string | null;
    ticket_number: string | null;
    pounds_delivered: number;
    notes: string | null;
  }>("SELECT * FROM feed_deliveries WHERE id = ?", [deliveryId]);
  if (!d) throw new Error("Feed delivery not found");
  return {
    id: d.id,
    flockId: d.flock_id,
    houseFlockId: d.house_flock_id,
    deliveryDate: d.delivery_date,
    feedType: d.feed_type,
    feedMill: d.feed_mill,
    ticketNumber: d.ticket_number,
    poundsDelivered: d.pounds_delivered,
    notes: d.notes,
  };
}

export function updateFeedDelivery(deliveryId: string, input: FeedInput) {
  const db = getDb();
  const existing = db.getFirstSync<{ id: string }>(
    "SELECT id FROM feed_deliveries WHERE id = ?",
    [deliveryId],
  );
  if (!existing) throw new Error("Feed delivery not found");
  if (!input.deliveryDate?.trim()) throw new Error("Delivery date is required");
  if (!Number.isFinite(input.poundsDelivered) || input.poundsDelivered <= 0) {
    throw new Error("Pounds delivered must be greater than 0");
  }
  db.runSync(
    `UPDATE feed_deliveries SET
       flock_id = ?, house_flock_id = ?, delivery_date = ?, feed_type = ?,
       feed_mill = ?, ticket_number = ?, pounds_delivered = ?, notes = ?
     WHERE id = ?`,
    [
      input.flockId || null,
      input.houseFlockId || null,
      input.deliveryDate,
      input.feedType?.trim() || null,
      input.feedMill?.trim() || null,
      input.ticketNumber?.trim() || null,
      input.poundsDelivered,
      input.notes?.trim() || null,
      deliveryId,
    ],
  );
  return { success: true as const };
}

export function deleteFeedDelivery(deliveryId: string) {
  const db = getDb();
  const existing = db.getFirstSync<{ id: string }>(
    "SELECT id FROM feed_deliveries WHERE id = ?",
    [deliveryId],
  );
  if (!existing) throw new Error("Feed delivery not found");
  db.runSync("DELETE FROM feed_deliveries WHERE id = ?", [deliveryId]);
  return { success: true as const };
}
