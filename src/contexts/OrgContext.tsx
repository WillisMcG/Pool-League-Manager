'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from './AuthContext';
import type { Season, LeagueSettings } from '@/types';

interface OrgContextValue {
  currentSeason: Season | null;
  allSeasons: Season[];
  settings: LeagueSettings | null;
  loading: boolean;
  switchSeason: (seasonId: string) => void;
  refreshOrg: () => Promise<void>;
}

const OrgContext = createContext<OrgContextValue | null>(null);

export function OrgProvider({ children }: { children: ReactNode }) {
  const { organization } = useAuth();
  const [currentSeason, setCurrentSeason] = useState<Season | null>(null);
  const [allSeasons, setAllSeasons] = useState<Season[]>([]);
  const [settings, setSettings] = useState<LeagueSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  async function loadOrgData() {
    if (!organization) {
      setLoading(false);
      return;
    }

    const [seasonsRes, settingsRes] = await Promise.all([
      supabase
        .from('seasons')
        .select('*')
        .eq('org_id', organization.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('league_settings')
        .select('*')
        .eq('org_id', organization.id)
        .single(),
    ]);

    const seasons = (seasonsRes.data || []) as Season[];
    setAllSeasons(seasons);

    const active = seasons.find(s => s.status === 'active') || seasons[0] || null;
    setCurrentSeason(active);

    setSettings((settingsRes.data as LeagueSettings) || null);
    setLoading(false);
  }

  function switchSeason(seasonId: string) {
    const season = allSeasons.find(s => s.id === seasonId);
    if (season) setCurrentSeason(season);
  }

  async function refreshOrg() {
    setLoading(true);
    await loadOrgData();
  }

  useEffect(() => {
    loadOrgData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organization?.id]);

  return (
    <OrgContext.Provider value={{ currentSeason, allSeasons, settings, loading, switchSeason, refreshOrg }}>
      {children}
    </OrgContext.Provider>
  );
}

export function useOrg() {
  const ctx = useContext(OrgContext);
  if (!ctx) throw new Error('useOrg must be used within OrgProvider');
  return ctx;
}
