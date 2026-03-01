'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Profile, Membership, Organization } from '@/types';
import type { User } from '@supabase/supabase-js';

interface AuthState {
  user: User | null;
  profile: Profile | null;
  membership: Membership | null;
  organization: Organization | null;
  loading: boolean;
}

interface AuthContextValue extends AuthState {
  signOut: () => Promise<void>;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    profile: null,
    membership: null,
    organization: null,
    loading: true,
  });

  const supabase = createClient();

  async function loadUserData(user: User) {
    // Load profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('auth_user_id', user.id)
      .single();

    if (!profile) {
      setState(s => ({ ...s, loading: false }));
      return;
    }

    // Load membership with org
    const { data: membership } = await supabase
      .from('memberships')
      .select('*, organization:organizations(*)')
      .eq('profile_id', profile.id)
      .limit(1)
      .single();

    const org = membership
      ? (membership as Membership & { organization: Organization }).organization
      : null;

    setState({
      user,
      profile,
      membership: membership || null,
      organization: org || null,
      loading: false,
    });
  }

  async function refreshAuth() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await loadUserData(user);
    } else {
      setState({ user: null, profile: null, membership: null, organization: null, loading: false });
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    setState({ user: null, profile: null, membership: null, organization: null, loading: false });
  }

  useEffect(() => {
    refreshAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        await loadUserData(session.user);
      } else if (event === 'SIGNED_OUT') {
        setState({ user: null, profile: null, membership: null, organization: null, loading: false });
      }
    });

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, signOut, refreshAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
