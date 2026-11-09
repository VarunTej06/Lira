import React from 'react';
import { PALETTE } from '../../theme/palette';

interface AvatarProps {
  initials?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  color?: string;
  className?: string;
  title?: string;
}

const SIZE_CLASSES = {
  xs: 'w-5 h-5 text-4xs',
  sm: 'w-6 h-6 text-3xs',
  md: 'w-8 h-8 text-xs',
  lg: 'w-10 h-10 text-sm',
};

const AVATAR_COLORS = [
  PALETTE.brand, PALETTE.info, PALETTE.purple, PALETTE.success, PALETTE.danger, PALETTE.orange,
];

function getColorForInitials(initials: string): string {
  if (!initials) return AVATAR_COLORS[0];
  const index = Math.abs(initials.charCodeAt(0)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
}

export const Avatar: React.FC<AvatarProps> = ({
  initials = 'VY',
  size = 'md',
  color,
  className = '',
  title,
}) => {
  const text = (initials || 'U').trim() || 'U';
  const bg = color || getColorForInitials(text);

  return (
    <div
      className={`rounded-full flex items-center justify-center font-bold text-white flex-shrink-0 select-none ${SIZE_CLASSES[size]} ${className}`}
      style={{ backgroundColor: bg }}
      title={title || text}
    >
      {text.slice(0, 2).toUpperCase()}
    </div>
  );
};
