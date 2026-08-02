// iCalendar (RFC 5545) export for PoppyShuffle projects.
// IMPORTANT: imports schema.js ONLY (never app.js — avoids circular deps).
import { addDaysISO } from './schema.js';

// Escape TEXT property values per RFC 5545 §3.3.11.
function icsEscape(v) {
  return String(v ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

// Fold content lines per RFC 5545 §3.1 — lines longer than 74 chars continue
// on the next line after a CRLF + single space.
function foldLine(line) {
  if (line.length <= 74) return line;
  let out = line.slice(0, 74);
  let rest = line.slice(74);
  while (rest.length > 73) {
    out += '\r\n ' + rest.slice(0, 73);
    rest = rest.slice(73);
  }
  if (rest) out += '\r\n ' + rest;
  return out;
}

// 'YYYY-MM-DD' -> 'YYYYMMDD'
function compactDate(iso) {
  return String(iso || '').replace(/-/g, '');
}

// 'YYYY-MM-DD' + 'HH:MM' -> local (floating) 'YYYYMMDDTHHMMSS'
function compactDateTime(iso, time) {
  return `${compactDate(iso)}T${String(time).replace(':', '')}00`;
}

// -> a complete VCALENDAR string (CRLF line endings). One VEVENT per
// non-cancelled project with an eventDate. clientsById is an optional
// Map(clientId -> client) used to enrich the DESCRIPTION.
export function projectsToICS(projects, settings, clientsById = new Map()) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//PoppyShuffle//EN',
    'CALSCALE:GREGORIAN',
  ];
  if (settings?.name) lines.push('X-WR-CALNAME:' + icsEscape(settings.name));

  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');

  for (const p of projects || []) {
    if (!p || p.status === 'cancelled' || !p.eventDate) continue;
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${p.id}@poppyshuffle`);
    lines.push(`DTSTAMP:${stamp}`);
    lines.push('SUMMARY:' + icsEscape(p.name || 'Untitled event'));
    if (p.venue) lines.push('LOCATION:' + icsEscape(p.venue));

    const client = clientsById && typeof clientsById.get === 'function'
      ? clientsById.get(p.clientId) : null;
    const desc = [p.quoteNumber, p.status, client?.name].filter(Boolean).join(' · ');
    if (desc) lines.push('DESCRIPTION:' + icsEscape(desc));

    if (p.startTime) {
      // Timed event — floating local datetimes.
      const endDate = p.endDate || p.eventDate;
      lines.push('DTSTART:' + compactDateTime(p.eventDate, p.startTime));
      lines.push('DTEND:' + compactDateTime(endDate, p.endTime || p.startTime));
    } else {
      // All-day event — DTEND is exclusive (the day after the last day).
      lines.push('DTSTART;VALUE=DATE:' + compactDate(p.eventDate));
      lines.push('DTEND;VALUE=DATE:' + compactDate(addDaysISO(p.endDate || p.eventDate, 1)));
    }
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.map(foldLine).join('\r\n') + '\r\n';
}
