'use client';

import { useState, useMemo, useEffect } from 'react';
import { Button, Select, Badge } from '@/components/ui';
import type { MatchupInput } from '@/lib/validation/score-validation';
import type { Player } from '@/types';

interface ScoreFormProps {
  homeTeamName: string;
  awayTeamName: string;
  homeRoster: Player[];
  awayRoster: Player[];
  matchesPerNight: number;
  bestOf: number;
  onSubmit: (matchups: MatchupInput[]) => Promise<void>;
  onCancel: () => void;
  initialMatchups?: MatchupInput[];
}

function emptyMatchups(count: number): MatchupInput[] {
  return Array.from({ length: count }, () => ({
    home_player: '',
    away_player: '',
    home_wins: 0,
    away_wins: 0,
  }));
}

export function ScoreForm({
  homeTeamName,
  awayTeamName,
  homeRoster,
  awayRoster,
  matchesPerNight,
  bestOf,
  onSubmit,
  onCancel,
  initialMatchups,
}: ScoreFormProps) {
  const [matchups, setMatchups] = useState<MatchupInput[]>(emptyMatchups(matchesPerNight));
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  // Pre-fill from OCR scan results
  useEffect(() => {
    if (initialMatchups && initialMatchups.length > 0) {
      setMatchups(initialMatchups);
      setErrors([]);
    }
  }, [initialMatchups]);

  const winsNeeded = Math.ceil(bestOf / 2);

  // Track which players are already selected
  const selectedHomePlayers = useMemo(
    () => new Set(matchups.map(m => m.home_player).filter(Boolean)),
    [matchups]
  );
  const selectedAwayPlayers = useMemo(
    () => new Set(matchups.map(m => m.away_player).filter(Boolean)),
    [matchups]
  );

  // Compute live match score
  const homeScore = matchups.filter(m => m.home_wins > m.away_wins && m.home_player && m.away_player).length;
  const awayScore = matchups.filter(m => m.away_wins > m.home_wins && m.home_player && m.away_player).length;

  function updateMatchup(index: number, field: keyof MatchupInput, value: string | number) {
    setMatchups(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
    setErrors([]);
  }

  // Build score options for each game
  function scoreOptions() {
    const opts = [];
    for (let i = 0; i <= winsNeeded; i++) {
      opts.push({ value: String(i), label: String(i) });
    }
    return opts;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Quick client-side validation
    const errs: string[] = [];
    const usedHome = new Set<string>();
    const usedAway = new Set<string>();

    for (let i = 0; i < matchups.length; i++) {
      const m = matchups[i];
      if (!m.home_player || !m.away_player) {
        errs.push(`Game ${i + 1}: Select both players`);
        continue;
      }
      if (usedHome.has(m.home_player)) errs.push(`Game ${i + 1}: Home player already used`);
      if (usedAway.has(m.away_player)) errs.push(`Game ${i + 1}: Away player already used`);
      usedHome.add(m.home_player);
      usedAway.add(m.away_player);

      const validHome = m.home_wins === winsNeeded && m.away_wins < winsNeeded;
      const validAway = m.away_wins === winsNeeded && m.home_wins < winsNeeded;
      if (!validHome && !validAway) {
        errs.push(`Game ${i + 1}: One player must win ${winsNeeded}`);
      }
    }

    if (errs.length > 0) {
      setErrors(errs);
      return;
    }

    setSaving(true);
    try {
      await onSubmit(matchups);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between bg-slate-100 rounded-lg px-4 py-3">
        <div className="text-center flex-1">
          <p className="font-bold text-slate-800">{homeTeamName}</p>
          <p className="text-xs text-slate-500">Home</p>
        </div>
        <div className="text-center px-4">
          <p className="text-2xl font-black text-slate-700">{homeScore} - {awayScore}</p>
          <p className="text-xs text-slate-500">Match Score</p>
        </div>
        <div className="text-center flex-1">
          <p className="font-bold text-slate-800">{awayTeamName}</p>
          <p className="text-xs text-slate-500">Away</p>
        </div>
      </div>

      <p className="text-xs text-slate-500 text-center">
        Best of {bestOf} (first to {winsNeeded} wins)
      </p>

      {/* Matchup rows */}
      <div className="space-y-3">
        {matchups.map((m, i) => {
          const homeOptions = homeRoster
            .filter(p => !selectedHomePlayers.has(p.name) || p.name === m.home_player)
            .map(p => ({ value: p.name, label: p.name + (p.is_sub ? ' (sub)' : '') }));
          const awayOptions = awayRoster
            .filter(p => !selectedAwayPlayers.has(p.name) || p.name === m.away_player)
            .map(p => ({ value: p.name, label: p.name + (p.is_sub ? ' (sub)' : '') }));

          return (
            <div key={i} className="bg-white border border-slate-200 rounded-lg p-3">
              <p className="text-xs font-medium text-slate-500 mb-2">Game {i + 1}</p>
              <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-end">
                {/* Home player */}
                <Select
                  options={homeOptions}
                  placeholder="Select player..."
                  value={m.home_player}
                  onChange={e => updateMatchup(i, 'home_player', e.target.value)}
                />

                {/* Scores */}
                <div className="flex items-center gap-1">
                  <select
                    className="w-12 px-1 py-2 border border-slate-300 rounded-lg text-sm text-center bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    value={m.home_wins}
                    onChange={e => updateMatchup(i, 'home_wins', parseInt(e.target.value))}
                  >
                    {scoreOptions().map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  <span className="text-slate-400 text-sm">-</span>
                  <select
                    className="w-12 px-1 py-2 border border-slate-300 rounded-lg text-sm text-center bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    value={m.away_wins}
                    onChange={e => updateMatchup(i, 'away_wins', parseInt(e.target.value))}
                  >
                    {scoreOptions().map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>

                {/* Away player */}
                <Select
                  options={awayOptions}
                  placeholder="Select player..."
                  value={m.away_player}
                  onChange={e => updateMatchup(i, 'away_player', e.target.value)}
                />
              </div>

              {/* Game result badge */}
              {m.home_player && m.away_player && (m.home_wins === winsNeeded || m.away_wins === winsNeeded) && (
                <div className="mt-2 text-center">
                  <Badge variant={m.home_wins > m.away_wins ? 'success' : 'info'}>
                    {m.home_wins > m.away_wins ? homeTeamName : awayTeamName} wins {Math.max(m.home_wins, m.away_wins)}-{Math.min(m.home_wins, m.away_wins)}
                  </Badge>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Errors */}
      {errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          {errors.map((err, i) => (
            <p key={i} className="text-sm text-red-600">{err}</p>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 justify-end">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={saving}>
          Submit Scores
        </Button>
      </div>
    </form>
  );
}
