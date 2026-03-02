type Tier = 'free' | 'trial' | 'basic' | 'pro' | 'premium';

interface TierLimits {
  maxTeams: number;
  maxSeasonsHistory: number; // 0 = current only, -1 = unlimited
  hasPlayerStats: boolean;
  hasPhotoUpload: boolean;
  hasHallOfFame: boolean;
  hasHeadToHead: boolean;
  hasSmsSubmission: boolean;
  hasOcrScanning: boolean;
}

const TIER_LIMITS: Record<Tier, TierLimits> = {
  free: {
    maxTeams: 6,
    maxSeasonsHistory: 0,
    hasPlayerStats: false,
    hasPhotoUpload: false,
    hasHallOfFame: false,
    hasHeadToHead: false,
    hasSmsSubmission: false,
    hasOcrScanning: false,
  },
  trial: {
    maxTeams: 20,
    maxSeasonsHistory: -1,
    hasPlayerStats: true,
    hasPhotoUpload: true,
    hasHallOfFame: true,
    hasHeadToHead: true,
    hasSmsSubmission: true,
    hasOcrScanning: true,
  },
  basic: {
    maxTeams: 10,
    maxSeasonsHistory: 0,
    hasPlayerStats: false,
    hasPhotoUpload: false,
    hasHallOfFame: false,
    hasHeadToHead: false,
    hasSmsSubmission: false,
    hasOcrScanning: true,
  },
  pro: {
    maxTeams: 20,
    maxSeasonsHistory: 3,
    hasPlayerStats: true,
    hasPhotoUpload: true,
    hasHallOfFame: false,
    hasHeadToHead: false,
    hasSmsSubmission: true,
    hasOcrScanning: true,
  },
  premium: {
    maxTeams: Infinity,
    maxSeasonsHistory: -1,
    hasPlayerStats: true,
    hasPhotoUpload: true,
    hasHallOfFame: true,
    hasHeadToHead: true,
    hasSmsSubmission: true,
    hasOcrScanning: true,
  },
};

export function getTierLimits(tier: string | undefined | null): TierLimits {
  return TIER_LIMITS[(tier as Tier) || 'free'] || TIER_LIMITS.free;
}

export function canAddTeam(tier: string | undefined | null, currentTeamCount: number): boolean {
  const limits = getTierLimits(tier);
  return currentTeamCount < limits.maxTeams;
}

export function hasFeature(tier: string | undefined | null, feature: keyof Omit<TierLimits, 'maxTeams' | 'maxSeasonsHistory'>): boolean {
  const limits = getTierLimits(tier);
  return limits[feature] as boolean;
}

export function getUpgradeMessage(feature: string, requiredTier: string): string {
  return `${feature} requires the ${requiredTier} plan or higher. Upgrade in Settings > Billing.`;
}
