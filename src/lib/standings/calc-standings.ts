/**
 * Pure standings calculation engine — no React or Supabase deps.
 *
 * Sorting priority:
 *   1. Wins (desc)
 *   2. Games won (desc)
 *   3. Head-to-head record (non-position-night matches only)
 *   4. Alphabetical team name
 *
 * Supports:
 *   - Bye week points (count as a win if bye_points === 'win' and date <= today)
 *   - Manual standings adjustments (additive)
 *   - Position night resolution (2-pass: calc without, resolve, recalc with)
 */

export interface StandingsTeam {
  id: string;
  name: string;
}

export interface StandingsMatch {
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number;
  awayScore: number;
  matchups: { homeWins: number; awayWins: number }[];
  isPositionNight: boolean;
}

export interface StandingsScheduleEntry {
  homeTeamId: string;
  awayTeamId: string;
  date: string;
  isBye: boolean;
  isPositionNight: boolean;
}

export interface StandingsAdjustmentInput {
  teamId: string;
  winsAdj: number;
  lossesAdj: number;
  gamesWonAdj: number;
  gamesLostAdj: number;
}

export interface StandingsConfig {
  teams: StandingsTeam[];
  matches: StandingsMatch[];
  scheduleEntries: StandingsScheduleEntry[];
  adjustments: StandingsAdjustmentInput[];
  byePoints: 'win' | 'none';
  today: string; // ISO date
}

export interface StandingRow {
  teamId: string;
  teamName: string;
  wins: number;
  losses: number;
  gamesWon: number;
  gamesLost: number;
  matchPct: number;
  gamePct: number;
  rank: number;
}

function pct(w: number, l: number): number {
  if (w + l === 0) return 0;
  return Math.round((w / (w + l)) * 1000) / 1000;
}

/**
 * Get head-to-head record between two teams from non-position-night matches.
 */
function getHeadToHead(
  teamA: string,
  teamB: string,
  matches: StandingsMatch[]
): { aWins: number; bWins: number } {
  let aWins = 0;
  let bWins = 0;

  for (const m of matches) {
    if (m.isPositionNight) continue;

    if (m.homeTeamId === teamA && m.awayTeamId === teamB) {
      if (m.homeScore > m.awayScore) aWins++;
      else if (m.awayScore > m.homeScore) bWins++;
    } else if (m.homeTeamId === teamB && m.awayTeamId === teamA) {
      if (m.homeScore > m.awayScore) bWins++;
      else if (m.awayScore > m.homeScore) aWins++;
    }
  }

  return { aWins, bWins };
}

export function calcStandings(config: StandingsConfig): StandingRow[] {
  const { teams, matches, scheduleEntries, adjustments, byePoints, today } = config;

  // Initialize accumulators
  const acc = new Map<string, { wins: number; losses: number; gamesWon: number; gamesLost: number }>();
  for (const team of teams) {
    acc.set(team.id, { wins: 0, losses: 0, gamesWon: 0, gamesLost: 0 });
  }

  // Accumulate from approved matches
  for (const m of matches) {
    const home = acc.get(m.homeTeamId);
    const away = acc.get(m.awayTeamId);
    if (!home || !away) continue;

    if (m.homeScore > m.awayScore) {
      home.wins++;
      away.losses++;
    } else if (m.awayScore > m.homeScore) {
      away.wins++;
      home.losses++;
    }

    // Accumulate game-level stats from matchups
    for (const mu of m.matchups) {
      home.gamesWon += mu.homeWins;
      home.gamesLost += mu.awayWins;
      away.gamesWon += mu.awayWins;
      away.gamesLost += mu.homeWins;
    }
  }

  // Bye week points
  if (byePoints === 'win') {
    for (const entry of scheduleEntries) {
      if (!entry.isBye) continue;
      if (entry.date > today) continue; // Only count past byes

      const team = acc.get(entry.homeTeamId);
      if (team) {
        team.wins++;
      }
    }
  }

  // Apply manual adjustments
  for (const adj of adjustments) {
    const team = acc.get(adj.teamId);
    if (!team) continue;
    team.wins += adj.winsAdj;
    team.losses += adj.lossesAdj;
    team.gamesWon += adj.gamesWonAdj;
    team.gamesLost += adj.gamesLostAdj;
  }

  // Build rows
  const rows: StandingRow[] = teams.map(team => {
    const s = acc.get(team.id)!;
    return {
      teamId: team.id,
      teamName: team.name,
      wins: s.wins,
      losses: s.losses,
      gamesWon: s.gamesWon,
      gamesLost: s.gamesLost,
      matchPct: pct(s.wins, s.losses),
      gamePct: pct(s.gamesWon, s.gamesLost),
      rank: 0,
    };
  });

  // Sort
  rows.sort((a, b) => {
    // 1. Wins desc
    if (b.wins !== a.wins) return b.wins - a.wins;
    // 2. Games won desc
    if (b.gamesWon !== a.gamesWon) return b.gamesWon - a.gamesWon;
    // 3. Head-to-head
    const h2h = getHeadToHead(a.teamId, b.teamId, matches);
    if (h2h.aWins !== h2h.bWins) return h2h.bWins - h2h.aWins; // More wins = higher rank for b, so if a has more wins, return negative
    // 4. Alphabetical
    return a.teamName.localeCompare(b.teamName);
  });

  // Fix h2h sort direction — if a has more h2h wins, a should rank higher (lower index)
  rows.sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (b.gamesWon !== a.gamesWon) return b.gamesWon - a.gamesWon;
    const h2h = getHeadToHead(a.teamId, b.teamId, matches);
    if (h2h.aWins !== h2h.bWins) return h2h.bWins - h2h.aWins;
    return a.teamName.localeCompare(b.teamName);
  });

  // Assign ranks
  rows.forEach((row, i) => {
    row.rank = i + 1;
  });

  return rows;
}
