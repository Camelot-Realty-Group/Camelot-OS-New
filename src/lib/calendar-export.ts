/**
 * calendar-export — zero-dependency calendar integration for time-sensitive
 * compliance dates (ECB/OATH hearings, HPD/DOB cure deadlines).
 *
 * Three ways out, all client-side, no OAuth required:
 *  1. Download a standards-compliant .ics file (works in Google Calendar,
 *     Outlook, Apple Calendar, anything).
 *  2. One-click "Add to Google Calendar" deep link — can pre-fill guest
 *     invites via the `add` param, so sharing with a team member is a
 *     single click away (no API key, no backend).
 *  3. One-click "Add to Outlook.com" deep link.
 *
 * All times are converted from America/New_York wall-clock time to UTC
 * using the Intl-based offset trick below, so DST transitions (EST/EDT)
 * are always handled correctly — these are court hearing dates, so getting
 * the timezone math right actually matters.
 */

export interface CalEvent {
  /** Stable id used for the .ics UID and DOM keys */
  id: string;
  title: string;
  description: string;
  location: string;
  /** Wall-clock date in NYC, e.g. "2026-10-14" */
  dateISO: string;
  /** Wall-clock time in NYC 24h "HH:mm", omit for an all-day event (deadline w/ no hearing time) */
  time?: string;
  /** Event length in minutes (ignored for all-day events). Default 60. */
  durationMinutes?: number;
  /** true = "critical" (overdue / immediately hazardous) → shorter reminder lead time is added */
  urgent?: boolean;
}

/** Converts NYC wall-clock time to a correct UTC Date, handling EST/EDT automatically. */
function nyWallTimeToUTC(y: number, m: number, d: number, hh: number, mm: number): Date {
  const utcGuess = new Date(Date.UTC(y, m - 1, d, hh, mm));
  const nyString = utcGuess.toLocaleString('en-US', { timeZone: 'America/New_York', hour12: false });
  const nyReinterpreted = new Date(nyString);
  const driftMs = utcGuess.getTime() - nyReinterpreted.getTime();
  return new Date(utcGuess.getTime() + driftMs);
}

function parseDateParts(dateISO: string): { y: number; m: number; d: number } {
  const [y, m, d] = dateISO.split('-').map(Number);
  return { y, m, d };
}

function eventToUTCRange(ev: CalEvent): { start: Date; end: Date; allDay: boolean } {
  const { y, m, d } = parseDateParts(ev.dateISO);
  if (!ev.time) {
    // All-day deadline: represent as a UTC-midnight date range (exclusive end = next day)
    const start = new Date(Date.UTC(y, m - 1, d));
    const end = new Date(Date.UTC(y, m - 1, d + 1));
    return { start, end, allDay: true };
  }
  const [hh, mm] = ev.time.split(':').map(Number);
  const start = nyWallTimeToUTC(y, m, d, hh, mm);
  const end = new Date(start.getTime() + (ev.durationMinutes ?? 60) * 60000);
  return { start, end, allDay: false };
}

function fmtICSDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

function fmtICSDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

function escapeICS(text: string): string {
  return (text || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

function foldLine(line: string): string {
  // RFC5545 recommends folding lines >75 octets; keep it simple/safe for typical content lengths.
  if (line.length <= 74) return line;
  const parts: string[] = [];
  let rest = line;
  parts.push(rest.slice(0, 74));
  rest = rest.slice(74);
  while (rest.length > 0) {
    parts.push(' ' + rest.slice(0, 73));
    rest = rest.slice(73);
  }
  return parts.join('\r\n');
}

/** Builds a full multi-event .ics calendar file (RFC5545). */
export function buildICS(events: CalEvent[], calendarName = 'Camelot OS Compliance Calendar'): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Camelot Property Management Services Corp//Camelot OS Compliance Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeICS(calendarName)}`,
    'X-WR-TIMEZONE:America/New_York',
  ];

  const now = fmtICSDate(new Date());

  for (const ev of events) {
    const { start, end, allDay } = eventToUTCRange(ev);
    lines.push('BEGIN:VEVENT');
    lines.push(foldLine(`UID:${ev.id}@camelot-os.onrender.com`));
    lines.push(`DTSTAMP:${now}`);
    if (allDay) {
      lines.push(`DTSTART;VALUE=DATE:${fmtICSDateOnly(start)}`);
      lines.push(`DTEND;VALUE=DATE:${fmtICSDateOnly(end)}`);
    } else {
      lines.push(`DTSTART:${fmtICSDate(start)}`);
      lines.push(`DTEND:${fmtICSDate(end)}`);
    }
    lines.push(foldLine(`SUMMARY:${escapeICS(ev.title)}`));
    lines.push(foldLine(`DESCRIPTION:${escapeICS(ev.description)}`));
    lines.push(foldLine(`LOCATION:${escapeICS(ev.location)}`));
    lines.push('STATUS:CONFIRMED');
    // Time-sensitive reminders — hearings/deadlines don't get missed silently.
    lines.push('BEGIN:VALARM');
    lines.push('ACTION:DISPLAY');
    lines.push(foldLine(`DESCRIPTION:Reminder: ${escapeICS(ev.title)}`));
    lines.push(ev.urgent ? 'TRIGGER:-P1D' : 'TRIGGER:-P2D');
    lines.push('END:VALARM');
    if (!allDay) {
      lines.push('BEGIN:VALARM');
      lines.push('ACTION:DISPLAY');
      lines.push(foldLine(`DESCRIPTION:Starting soon: ${escapeICS(ev.title)}`));
      lines.push('TRIGGER:-PT2H');
      lines.push('END:VALARM');
    }
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

export function downloadICS(filename: string, events: CalEvent[], calendarName?: string): void {
  const ics = buildICS(events, calendarName);
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.ics') ? filename : `${filename}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Google Calendar "quick add" deep link. Passing `guestEmails` pre-fills
 * invitees on the compose screen — the user just hits Save & Send to share
 * the hearing with a colleague, attorney, or expediter. No OAuth needed.
 */
export function googleCalendarLink(ev: CalEvent, guestEmails?: string[]): string {
  const { start, end, allDay } = eventToUTCRange(ev);
  const dates = allDay
    ? `${fmtICSDateOnly(start)}/${fmtICSDateOnly(end)}`
    : `${fmtICSDate(start)}/${fmtICSDate(end)}`;
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: ev.title,
    dates,
    details: ev.description,
    location: ev.location,
  });
  if (guestEmails && guestEmails.length > 0) {
    params.set('add', guestEmails.map(e => e.trim()).filter(Boolean).join(','));
  }
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** Outlook.com "deep link" quick-add (secondary option; Outlook desktop users can just import the .ics). */
export function outlookCalendarLink(ev: CalEvent): string {
  const { start, end, allDay } = eventToUTCRange(ev);
  const params = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: ev.title,
    body: ev.description,
    location: ev.location,
    startdt: start.toISOString(),
    enddt: end.toISOString(),
    allday: allDay ? 'true' : 'false',
  });
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}
