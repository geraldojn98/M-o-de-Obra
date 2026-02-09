import React from 'react';
import { Medal, Trophy } from 'lucide-react';

export type WorkerLevel = 'bronze' | 'silver' | 'gold' | 'diamond';

type BadgeSize = 'sm' | 'md' | 'lg';

interface LevelBadgeProps {
  level: WorkerLevel | string;
  size?: BadgeSize;
  className?: string;
}

const SIZE_CONFIG: Record<BadgeSize, { icon: number; container: string }> = {
  sm: { icon: 12, container: 'w-5 h-5' },
  md: { icon: 16, container: 'w-7 h-7' },
  lg: { icon: 20, container: 'w-9 h-9' },
};

const LEVEL_CONFIG: Record<WorkerLevel, { icon: typeof Medal | typeof Trophy; colors: string; glow?: string }> = {
  bronze: {
    icon: Medal,
    colors: 'text-orange-700 bg-orange-100 border-orange-200',
  },
  silver: {
    icon: Medal,
    colors: 'text-slate-500 bg-slate-100 border-slate-200',
  },
  gold: {
    icon: Medal,
    colors: 'text-yellow-600 bg-yellow-100 border-yellow-200',
    glow: 'shadow-yellow-300/50 shadow-lg',
  },
  diamond: {
    icon: Trophy,
    colors: 'text-cyan-500 bg-cyan-50 border-cyan-200',
    glow: 'shadow-cyan-300/50 shadow-lg',
  },
};

export const LevelBadge: React.FC<LevelBadgeProps> = ({
  level,
  size = 'md',
  className = '',
}) => {
  const normalizedLevel = (level?.toLowerCase() || 'bronze') as WorkerLevel;
  const config = LEVEL_CONFIG[normalizedLevel] || LEVEL_CONFIG.bronze;
  const sizeConfig = SIZE_CONFIG[size];
  const Icon = config.icon;

  return (
    <div
      className={`
        ${sizeConfig.container}
        ${config.colors}
        ${config.glow || ''}
        rounded-full
        border-2
        border-white
        flex
        items-center
        justify-center
        shrink-0
        ${className}
      `}
      title={`Nível: ${normalizedLevel === 'diamond' ? 'Diamante' : normalizedLevel === 'gold' ? 'Ouro' : normalizedLevel === 'silver' ? 'Prata' : 'Bronze'}`}
    >
      <Icon size={sizeConfig.icon} className="shrink-0" />
    </div>
  );
};
