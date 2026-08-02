// Availability engine — hard (signed) and soft (quote) holds against stockQty.
// See ARCHITECTURE.md: a project's date range is [eventDate, endDate || eventDate].
import { db } from './db.js';
import { rangesOverlap } from './schema.js';

/**
 * Sum booked line qty for an item across projects overlapping [dateFrom, dateTo].
 * Returns { hard, soft } — hard = qty on 'signed' projects, soft = qty on
 * 'quote' projects (only statuses in the `statuses` filter are counted).
 */
export async function bookedQty(itemId, dateFrom, dateTo, { excludeProjectId, statuses = ['quote', 'signed'] } = {}) {
  const projects = await db.all('projects');
  let hard = 0;
  let soft = 0;
  for (const p of projects) {
    if (excludeProjectId && p.id === excludeProjectId) continue;
    if (!statuses.includes(p.status)) continue;
    if (!p.eventDate) continue;
    if (!rangesOverlap(dateFrom, dateTo, p.eventDate, p.endDate || p.eventDate)) continue;
    for (const line of p.lines || []) {
      if (line.itemId !== itemId) continue;
      const qty = line.qty || 0;
      if (p.status === 'signed') hard += qty;
      else if (p.status === 'quote') soft += qty;
    }
  }
  return { hard, soft };
}

/**
 * Check a project's lines against inventory stock for the project's date range.
 * Skips lines without a matching inventory item and items of type 'service'.
 * Returns conflicts: { itemId, name, requested, stock, hardBooked, softBooked,
 * severity } where severity is 'hard' (requested + hard holds exceed stock) or
 * 'soft' (only exceeds stock once soft quote holds are included).
 */
export async function checkProject(project) {
  const conflicts = [];
  if (!project?.eventDate) return conflicts;
  const dateFrom = project.eventDate;
  const dateTo = project.endDate || project.eventDate;

  const inventory = await db.all('inventory');
  const byId = new Map(inventory.map(it => [it.id, it]));

  // Aggregate requested qty per item (a project may repeat an item across lines).
  const requestedById = new Map();
  for (const line of project.lines || []) {
    if (!line.itemId) continue;
    const item = byId.get(line.itemId);
    if (!item || item.type === 'service') continue;
    requestedById.set(line.itemId, (requestedById.get(line.itemId) || 0) + (line.qty || 0));
  }

  for (const [itemId, requested] of requestedById) {
    const item = byId.get(itemId);
    const stock = item.stockQty || 0;
    const { hard, soft } = await bookedQty(itemId, dateFrom, dateTo, { excludeProjectId: project.id });
    let severity = null;
    if (requested + hard > stock) severity = 'hard';
    else if (requested + hard + soft > stock) severity = 'soft';
    if (severity) {
      conflicts.push({
        itemId,
        name: item.name,
        requested,
        stock,
        hardBooked: hard,
        softBooked: soft,
        severity,
      });
    }
  }
  return conflicts;
}

/**
 * Availability snapshot for one item over [dateFrom, dateTo].
 * Returns { stock, hard, soft, available } where available = stock - hard.
 */
export async function itemAvailabilityOn(itemId, dateFrom, dateTo) {
  const item = await db.get('inventory', itemId);
  const stock = item?.stockQty || 0;
  const { hard, soft } = await bookedQty(itemId, dateFrom, dateTo);
  return { stock, hard, soft, available: stock - hard };
}
