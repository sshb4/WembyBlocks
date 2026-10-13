export const ATHLETE_ID = '5104157';
export const TEAM_ID = '24';

// ESPN files these as regular-season games, but they do not count in season stats.
const NON_COUNTING = /all-star|cup championship/i;

export function blockEvents(summary, startAt, now = Date.now()) {
  const competition = summary.header?.competitions?.[0];
  if (summary.header?.season?.type !== 2) return [];
  if ((competition?.notes || []).some(note => NON_COUNTING.test(note?.headline || ''))) return [];
  const gameId = String(summary.header?.id || '');
  if (!/^\d+$/.test(gameId)) return [];
  const opponent = (competition?.competitors || []).find(c => String(c.team?.id) !== TEAM_ID)?.team;
  const name = String(opponent?.name || 'the opposition')
    .replace(/[^a-zA-Z0-9 .-]/g, '').slice(0, 24);
  return (summary.plays || []).flatMap(play => {
    const when = Date.parse(play.wallclock);
    if (!/^Victor Wembanyama blocks\b/.test(play.text || '') ||
        !(play.participants || []).some(p => String(p.athlete?.id) === ATHLETE_ID) ||
        !/^\d+$/.test(String(play.id || '')) || !Number.isFinite(when) ||
        when <= startAt || when < now - 6 * 60 * 60 * 1000 || when > now) return [];
    const period = Number(play.period?.number);
    const overtime = period - 4;
    const quarter = overtime > 0 ? `OT${overtime > 1 ? overtime : ''}` : `Q${period}`;
    const clock = String(play.clock?.displayValue || '').replace(/[^0-9:.]/g, '').slice(0, 5);
    const body = `Wemby Blocks: REJECTED. vs ${name}, ${quarter}${clock ? ` ${clock}` : ''}. wembyblocks.com Reply STOP to unsubscribe.`;
    return [{ id: `${gameId}:${play.id}`, occurredAt: when, body }];
  });
}
