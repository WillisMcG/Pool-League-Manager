'use client';

import { useAuth } from '@/contexts/AuthContext';
import { getTierLimits, hasFeature, canAddTeam } from './features';

export function useFeatures() {
  const { organization } = useAuth();
  const tier = organization?.subscription_tier;
  const limits = getTierLimits(tier);

  return {
    tier: tier || 'free',
    limits,
    canAddTeam: (currentCount: number) => canAddTeam(tier, currentCount),
    hasPlayerStats: hasFeature(tier, 'hasPlayerStats'),
    hasPhotoUpload: hasFeature(tier, 'hasPhotoUpload'),
    hasHallOfFame: hasFeature(tier, 'hasHallOfFame'),
    hasHeadToHead: hasFeature(tier, 'hasHeadToHead'),
    hasSmsSubmission: hasFeature(tier, 'hasSmsSubmission'),
    hasOcrScanning: hasFeature(tier, 'hasOcrScanning'),
  };
}
