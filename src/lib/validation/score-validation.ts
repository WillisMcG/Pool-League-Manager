export interface MatchupInput {
  home_player: string;
  away_player: string;
  home_wins: number;
  away_wins: number;
}

export interface ScoreValidationResult {
  valid: boolean;
  errors: string[];
  homeScore: number;
  awayScore: number;
}

export function validateMatchups(
  matchups: MatchupInput[],
  matchesPerNight: number,
  bestOf: number
): ScoreValidationResult {
  const errors: string[] = [];
  const winsNeeded = Math.ceil(bestOf / 2);
  const usedPlayers = new Set<string>();

  if (matchups.length !== matchesPerNight) {
    errors.push(`Expected ${matchesPerNight} matchups, got ${matchups.length}`);
    return { valid: false, errors, homeScore: 0, awayScore: 0 };
  }

  for (let i = 0; i < matchups.length; i++) {
    const m = matchups[i];
    const gameNum = i + 1;

    if (!m.home_player || !m.away_player) {
      errors.push(`Game ${gameNum}: Select both players`);
      continue;
    }

    if (m.home_player === m.away_player) {
      errors.push(`Game ${gameNum}: Same player on both sides`);
      continue;
    }

    // Check duplicate players
    if (usedPlayers.has(m.home_player)) {
      errors.push(`Game ${gameNum}: Home player already used in another game`);
    }
    if (usedPlayers.has(m.away_player)) {
      errors.push(`Game ${gameNum}: Away player already used in another game`);
    }
    usedPlayers.add(m.home_player);
    usedPlayers.add(m.away_player);

    // Validate scores: one player must have winsNeeded, the other must have less
    const validHome = m.home_wins === winsNeeded && m.away_wins >= 0 && m.away_wins < winsNeeded;
    const validAway = m.away_wins === winsNeeded && m.home_wins >= 0 && m.home_wins < winsNeeded;

    if (!validHome && !validAway) {
      errors.push(`Game ${gameNum}: One player must win ${winsNeeded}, other must have 0-${winsNeeded - 1}`);
    }
  }

  const homeScore = matchups.filter(m => m.home_wins > m.away_wins).length;
  const awayScore = matchups.filter(m => m.away_wins > m.home_wins).length;

  return { valid: errors.length === 0, errors, homeScore, awayScore };
}
