/**
 * Item-Level Expense Analytics Engine
 * Pure functions over expenses + expense_grocery_items + members.
 * No DB calls — all aggregation happens client-side for instant insight.
 */

export type RawExpense = {
  id: string;
  date: string;
  amount: number;
  category: string;
  description?: string | null;
  paid_by?: string | null;
  created_by_name?: string | null;
};

export type RawItem = {
  id: string;
  expense_id: string;
  item_name: string;
  quantity: number;
  unit_price: number;
};

export type EnrichedItem = RawItem & {
  date: string;
  total: number;
  term: 1 | 2 | 3;
  monthKey: string; // YYYY-MM
  paid_by: string;
  expense_category: string;
};

export const TERM_LABELS: Record<number, string> = {
  1: 'Term 1 (1–10)',
  2: 'Term 2 (11–20)',
  3: 'Term 3 (21–end)',
};

export const getTermForDay = (day: number): 1 | 2 | 3 =>
  day <= 10 ? 1 : day <= 20 ? 2 : 3;

export const getTermForDate = (date: string | Date): 1 | 2 | 3 => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return getTermForDay(d.getDate());
};

export const monthKey = (date: string | Date): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const round = (n: number, dp = 0) => {
  const f = Math.pow(10, dp);
  return Math.round(n * f) / f;
};

export const enrichItems = (
  items: RawItem[],
  expenses: RawExpense[],
): EnrichedItem[] => {
  const expMap: Record<string, RawExpense> = {};
  expenses.forEach(e => { expMap[e.id] = e; });
  return items
    .map(it => {
      const exp = expMap[it.expense_id];
      if (!exp) return null;
      const qty = Number(it.quantity) || 0;
      const price = Number(it.unit_price) || 0;
      return {
        ...it,
        quantity: qty,
        unit_price: price,
        date: exp.date,
        total: qty * price,
        term: getTermForDate(exp.date),
        monthKey: monthKey(exp.date),
        paid_by: exp.paid_by || exp.created_by_name || 'Unknown',
        expense_category: exp.category,
      };
    })
    .filter((x): x is EnrichedItem => !!x);
};

// ---------- Last-paid-price lookup ----------
export const buildLastPaidPriceMap = (
  items: EnrichedItem[],
): Record<string, { unitPrice: number; date: string }> => {
  const map: Record<string, { unitPrice: number; date: string }> = {};
  // Iterate sorted DESC so first hit per name wins
  const sorted = [...items].sort((a, b) => b.date.localeCompare(a.date));
  for (const it of sorted) {
    const key = it.item_name.trim().toLowerCase();
    if (!key) continue;
    if (!map[key] && it.unit_price > 0) {
      map[key] = { unitPrice: it.unit_price, date: it.date };
    }
  }
  return map;
};

// ---------- Top-N most frequent items ----------
export const getTopFrequentItems = (
  items: EnrichedItem[],
  limit = 5,
): { name: string; count: number; qty: number; lastDate: string }[] => {
  const map: Record<string, { name: string; count: number; qty: number; lastDate: string }> = {};
  for (const it of items) {
    const key = it.item_name.trim().toLowerCase();
    if (!key) continue;
    if (!map[key]) {
      map[key] = { name: it.item_name, count: 0, qty: 0, lastDate: it.date };
    }
    map[key].count += 1;
    map[key].qty += it.quantity;
    if (it.date > map[key].lastDate) map[key].lastDate = it.date;
  }
  return Object.values(map).sort((a, b) => b.count - a.count).slice(0, limit);
};

// ---------- Per-month aggregates ----------
const monthBounds = (year: number, month0: number) => {
  const start = new Date(year, month0, 1);
  const end = new Date(year, month0 + 1, 0);
  return { start, end, daysInMonth: end.getDate() };
};

export const filterMonth = <T extends { date: string }>(
  rows: T[],
  year: number,
  month0: number,
): T[] => {
  const target = `${year}-${String(month0 + 1).padStart(2, '0')}`;
  return rows.filter(r => r.date.startsWith(target));
};

// ---------- The big one: full insights ----------
export type Insights = ReturnType<typeof computeInsights>;

export function computeInsights(
  itemsAll: EnrichedItem[],
  expensesAll: RawExpense[],
  members: { name: string }[],
  year: number,
  month0: number,
) {
  const monthItems = filterMonth(itemsAll, year, month0);
  const monthExpenses = filterMonth(expensesAll, year, month0);
  const { daysInMonth } = monthBounds(year, month0);

  // ---------- BASIC ----------
  const totalSpend = monthExpenses.reduce((s, e) => s + Number(e.amount), 0);
  const itemSpend = monthItems.reduce((s, i) => s + i.total, 0);
  const totalItems = monthItems.length;
  const totalQuantity = monthItems.reduce((s, i) => s + i.quantity, 0);

  // unique item names (case-insensitive)
  const uniqueNames = new Set(monthItems.map(i => i.item_name.trim().toLowerCase()).filter(Boolean));
  const totalUniqueItems = uniqueNames.size;

  const today = new Date();
  const dayCount =
    today.getFullYear() === year && today.getMonth() === month0
      ? today.getDate()
      : daysInMonth;
  const avgDailySpend = dayCount > 0 ? round(totalSpend / dayCount) : 0;
  const avgCostPerItem = totalItems > 0 ? round(itemSpend / totalItems) : 0;

  // Per-item summary (this month)
  type ItemSummary = {
    name: string;
    count: number;
    qty: number;
    spend: number;
    avgPrice: number;
    minPrice: number;
    maxPrice: number;
    lastDate: string;
    firstDate: string;
  };
  const itemSummaryMap: Record<string, ItemSummary> = {};
  for (const it of monthItems) {
    const key = it.item_name.trim().toLowerCase();
    if (!key) continue;
    if (!itemSummaryMap[key]) {
      itemSummaryMap[key] = {
        name: it.item_name,
        count: 0, qty: 0, spend: 0,
        avgPrice: 0, minPrice: Infinity, maxPrice: 0,
        lastDate: it.date, firstDate: it.date,
      };
    }
    const s = itemSummaryMap[key];
    s.count += 1;
    s.qty += it.quantity;
    s.spend += it.total;
    if (it.unit_price > 0) {
      s.minPrice = Math.min(s.minPrice, it.unit_price);
      s.maxPrice = Math.max(s.maxPrice, it.unit_price);
    }
    if (it.date > s.lastDate) s.lastDate = it.date;
    if (it.date < s.firstDate) s.firstDate = it.date;
  }
  const itemSummaries = Object.values(itemSummaryMap).map(s => ({
    ...s,
    avgPrice: s.qty > 0 ? round(s.spend / s.qty) : 0,
    minPrice: s.minPrice === Infinity ? 0 : s.minPrice,
  }));

  const sortedBySpend = [...itemSummaries].sort((a, b) => b.spend - a.spend);
  const sortedByCount = [...itemSummaries].sort((a, b) => b.count - a.count);
  const sortedByPrice = [...itemSummaries]
    .filter(s => s.maxPrice > 0)
    .sort((a, b) => b.maxPrice - a.maxPrice);

  const mostPurchased = sortedByCount[0] || null;
  const leastPurchased = sortedByCount.length > 1 ? sortedByCount[sortedByCount.length - 1] : null;
  const mostExpensiveItem = sortedByPrice[0] || null;
  const cheapestItem = [...itemSummaries]
    .filter(s => s.minPrice > 0)
    .sort((a, b) => a.minPrice - b.minPrice)[0] || null;

  // ---------- TERM-WISE ----------
  const terms: { term: number; label: string; spend: number; itemCount: number; topItem: string | null }[] = [1, 2, 3].map(t => {
    const tItems = monthItems.filter(i => i.term === t);
    const tExp = monthExpenses.filter(e => getTermForDate(e.date) === t);
    const spend = tExp.reduce((s, e) => s + Number(e.amount), 0);
    const itemCount = tItems.length;
    const topMap: Record<string, number> = {};
    tItems.forEach(it => {
      const k = it.item_name.trim().toLowerCase();
      topMap[k] = (topMap[k] || 0) + it.total;
    });
    const topKey = Object.entries(topMap).sort((a, b) => b[1] - a[1])[0]?.[0];
    const topItem = topKey
      ? tItems.find(i => i.item_name.trim().toLowerCase() === topKey)?.item_name ?? null
      : null;
    return { term: t, label: TERM_LABELS[t], spend, itemCount, topItem };
  });
  const mostExpensiveTerm = [...terms].sort((a, b) => b.spend - a.spend)[0];
  const mostActiveTerm = [...terms].sort((a, b) => b.itemCount - a.itemCount)[0];

  // ---------- TRENDS ----------
  // Last 6 months totals
  const monthlyTotals: { key: string; label: string; total: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(year, month0 - i, 1);
    const key = monthKey(d);
    const label = d.toLocaleString('default', { month: 'short', year: '2-digit' });
    const total = expensesAll
      .filter(e => e.date.startsWith(key))
      .reduce((s, e) => s + Number(e.amount), 0);
    monthlyTotals.push({ key, label, total });
  }
  const prevMonthTotal = monthlyTotals[monthlyTotals.length - 2]?.total ?? 0;
  const monthOverMonthGrowth = prevMonthTotal > 0
    ? round(((totalSpend - prevMonthTotal) / prevMonthTotal) * 100)
    : 0;

  // Daily spend trend (this month)
  const dailyMap: Record<number, number> = {};
  monthExpenses.forEach(e => {
    const d = new Date(e.date).getDate();
    dailyMap[d] = (dailyMap[d] || 0) + Number(e.amount);
  });
  const dailyTrend: { day: number; total: number }[] = [];
  for (let d = 1; d <= daysInMonth; d++) dailyTrend.push({ day: d, total: dailyMap[d] || 0 });

  // Spending spikes (outliers) — > mean + 1.5*stddev among non-zero days
  const nonZeroVals = dailyTrend.map(d => d.total).filter(v => v > 0);
  const mean = nonZeroVals.length > 0 ? nonZeroVals.reduce((a, b) => a + b, 0) / nonZeroVals.length : 0;
  const variance = nonZeroVals.length > 0
    ? nonZeroVals.reduce((s, v) => s + (v - mean) ** 2, 0) / nonZeroVals.length
    : 0;
  const stddev = Math.sqrt(variance);
  const spikeThreshold = mean + 1.5 * stddev;
  const spendingSpikes = dailyTrend.filter(d => d.total > 0 && d.total > spikeThreshold && d.total > mean * 1.5);

  // Item price changes over time — compare avg price this month vs prior 5 months
  const priceChanges: { name: string; oldAvg: number; newAvg: number; changePct: number }[] = [];
  const itemNamesAll = new Set(itemsAll.map(i => i.item_name.trim().toLowerCase()).filter(Boolean));
  for (const key of itemNamesAll) {
    const thisMonth = monthItems.filter(i => i.item_name.trim().toLowerCase() === key && i.unit_price > 0);
    if (thisMonth.length === 0) continue;
    const before = itemsAll.filter(
      i => i.item_name.trim().toLowerCase() === key
        && i.unit_price > 0
        && i.monthKey !== monthlyTotals[monthlyTotals.length - 1].key
        && monthlyTotals.slice(0, -1).some(m => m.key === i.monthKey),
    );
    if (before.length === 0) continue;
    const newAvg = thisMonth.reduce((s, i) => s + i.unit_price, 0) / thisMonth.length;
    const oldAvg = before.reduce((s, i) => s + i.unit_price, 0) / before.length;
    if (oldAvg <= 0) continue;
    const changePct = round(((newAvg - oldAvg) / oldAvg) * 100);
    if (Math.abs(changePct) >= 5) {
      priceChanges.push({
        name: thisMonth[0].item_name,
        oldAvg: round(oldAvg),
        newAvg: round(newAvg),
        changePct,
      });
    }
  }
  priceChanges.sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct));
  const frequentlyIncreasingPriceItems = priceChanges.filter(p => p.changePct > 0).slice(0, 5);

  // ---------- BEHAVIOR ----------
  const memberSpendMap: Record<string, number> = {};
  const memberItemMap: Record<string, number> = {};
  monthExpenses.forEach(e => {
    const k = e.paid_by || e.created_by_name || 'Unknown';
    memberSpendMap[k] = (memberSpendMap[k] || 0) + Number(e.amount);
  });
  monthItems.forEach(it => {
    memberItemMap[it.paid_by] = (memberItemMap[it.paid_by] || 0) + 1;
  });

  // Make sure every known member is represented (even if zero)
  members.forEach(m => {
    if (!(m.name in memberSpendMap)) memberSpendMap[m.name] = 0;
    if (!(m.name in memberItemMap)) memberItemMap[m.name] = 0;
  });

  const memberLeaderboard = Object.entries(memberSpendMap)
    .map(([name, spend]) => ({
      name,
      spend,
      itemCount: memberItemMap[name] || 0,
    }))
    .sort((a, b) => b.spend - a.spend);

  const highestSpendingUser = memberLeaderboard[0] || null;
  const leastActiveUser = memberLeaderboard.length > 1
    ? [...memberLeaderboard].sort((a, b) => a.spend - b.spend)[0]
    : null;
  const mostActiveContributor = [...memberLeaderboard]
    .sort((a, b) => b.itemCount - a.itemCount)[0] || null;

  // Fairness score: 100 = everyone paid equal share, 0 = single payer
  let fairnessScore = 100;
  if (memberLeaderboard.length > 1 && totalSpend > 0) {
    const fair = totalSpend / memberLeaderboard.length;
    const totalDeviation = memberLeaderboard.reduce((s, m) => s + Math.abs(m.spend - fair), 0);
    const maxDeviation = totalSpend * 2 * (1 - 1 / memberLeaderboard.length);
    fairnessScore = round(100 * (1 - totalDeviation / Math.max(maxDeviation, 1)));
    fairnessScore = Math.max(0, Math.min(100, fairnessScore));
  }

  // Common item combinations: pairs of items appearing in the same expense
  const pairCount: Record<string, number> = {};
  const expenseItemMap: Record<string, string[]> = {};
  monthItems.forEach(it => {
    const k = it.item_name.trim();
    if (!k) return;
    expenseItemMap[it.expense_id] = expenseItemMap[it.expense_id] || [];
    if (!expenseItemMap[it.expense_id].includes(k)) expenseItemMap[it.expense_id].push(k);
  });
  Object.values(expenseItemMap).forEach(names => {
    if (names.length < 2) return;
    const sorted = [...names].sort();
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const key = `${sorted[i]} + ${sorted[j]}`;
        pairCount[key] = (pairCount[key] || 0) + 1;
      }
    }
  });
  const commonCombinations = Object.entries(pairCount)
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([pair, count]) => ({ pair, count }));

  // ---------- ITEM INTELLIGENCE ----------
  const mostRecurring = sortedByCount.filter(s => s.count >= 2)[0] || null;
  const oneTimeItems = itemSummaries.filter(s => s.count === 1).slice(0, 8);

  // Bulk vs frequent
  const bulkItems = itemSummaries.filter(s => s.count <= 2 && s.qty >= 5).slice(0, 5);
  const frequentItems = itemSummaries.filter(s => s.count >= 4).slice(0, 5);

  // Category-wise spending (uses expense category)
  const categoryMap: Record<string, number> = {};
  monthExpenses.forEach(e => {
    categoryMap[e.category] = (categoryMap[e.category] || 0) + Number(e.amount);
  });
  const categorySpend = Object.entries(categoryMap)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  // Essential vs non-essential ratio (essentials = Food/Rent/Electricity/Water/Internet/Bills)
  const ESSENTIALS = new Set(['food', 'rent', 'electricity', 'water', 'internet', 'bills']);
  let essentialSpend = 0, nonEssentialSpend = 0;
  monthExpenses.forEach(e => {
    if (ESSENTIALS.has(e.category.toLowerCase())) essentialSpend += Number(e.amount);
    else nonEssentialSpend += Number(e.amount);
  });
  const essentialRatio = totalSpend > 0
    ? round((essentialSpend / totalSpend) * 100)
    : 0;

  // ---------- SMART SUGGESTIONS ----------
  const suggestions: { icon: string; text: string; tone: 'info' | 'warn' | 'good' }[] = [];

  // Recurring frequency: "Milk is bought every X days"
  for (const s of sortedByCount.slice(0, 4)) {
    if (s.count >= 3) {
      const first = new Date(s.firstDate);
      const last = new Date(s.lastDate);
      const span = Math.max(1, (last.getTime() - first.getTime()) / 86400000);
      const everyDays = Math.max(1, Math.round(span / Math.max(1, s.count - 1)));
      suggestions.push({
        icon: '🔁',
        text: `${s.name} is bought roughly every ${everyDays} day${everyDays === 1 ? '' : 's'} (${s.count}× this month)`,
        tone: 'info',
      });
    }
  }

  if (monthOverMonthGrowth > 10) {
    suggestions.push({
      icon: '📈',
      text: `Spending increased ${monthOverMonthGrowth}% vs last month — review your top categories`,
      tone: 'warn',
    });
  } else if (monthOverMonthGrowth < -10) {
    suggestions.push({
      icon: '📉',
      text: `Great — spending dropped ${Math.abs(monthOverMonthGrowth)}% vs last month`,
      tone: 'good',
    });
  }

  if (spendingSpikes.length > 0) {
    suggestions.push({
      icon: '⚠️',
      text: `${spendingSpikes.length} unusually high spending day${spendingSpikes.length > 1 ? 's' : ''} detected`,
      tone: 'warn',
    });
  }

  if (frequentlyIncreasingPriceItems.length > 0) {
    const top = frequentlyIncreasingPriceItems[0];
    suggestions.push({
      icon: '💸',
      text: `${top.name} costs ${top.changePct}% more this month (₹${top.oldAvg} → ₹${top.newAvg}/unit)`,
      tone: 'warn',
    });
  }

  if (essentialRatio > 0 && essentialRatio < 60 && totalSpend > 0) {
    suggestions.push({
      icon: '🛍️',
      text: `Only ${essentialRatio}% of spend is on essentials — non-essential share is ${100 - essentialRatio}%`,
      tone: 'info',
    });
  }

  if (members.length > 1 && fairnessScore < 60 && totalSpend > 0) {
    suggestions.push({
      icon: '⚖️',
      text: `Contribution fairness is ${fairnessScore}/100 — one member is paying disproportionately`,
      tone: 'warn',
    });
  }

  return {
    period: { year, month0, daysInMonth, dayCount },
    basic: {
      totalSpend, itemSpend, totalItems, totalUniqueItems, totalQuantity,
      avgDailySpend, avgCostPerItem,
      mostPurchased, leastPurchased, mostExpensiveItem, cheapestItem,
    },
    items: { sortedBySpend, sortedByCount, all: itemSummaries },
    terms,
    mostExpensiveTerm, mostActiveTerm,
    trends: {
      monthlyTotals, monthOverMonthGrowth, dailyTrend, spendingSpikes,
      priceChanges, frequentlyIncreasingPriceItems,
    },
    behavior: {
      memberLeaderboard, highestSpendingUser, leastActiveUser,
      mostActiveContributor, fairnessScore, commonCombinations,
    },
    intelligence: {
      mostRecurring, oneTimeItems, bulkItems, frequentItems,
      categorySpend, essentialSpend, nonEssentialSpend, essentialRatio,
    },
    suggestions,
  };
}
