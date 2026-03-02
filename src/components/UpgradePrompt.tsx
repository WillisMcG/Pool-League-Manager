'use client';

import { Lock } from 'lucide-react';
import Link from 'next/link';

interface UpgradePromptProps {
  feature: string;
  requiredTier: string;
}

export function UpgradePrompt({ feature, requiredTier }: UpgradePromptProps) {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-center">
      <Lock className="w-8 h-8 text-amber-500 mx-auto mb-2" />
      <p className="text-sm font-medium text-amber-800">
        {feature} requires the <strong>{requiredTier}</strong> plan
      </p>
      <Link
        href="/settings"
        className="inline-block mt-2 text-sm text-emerald-600 hover:underline font-medium"
      >
        Upgrade now
      </Link>
    </div>
  );
}
