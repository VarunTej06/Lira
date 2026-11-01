import React from 'react';

interface AvatarProps {
  initials?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  color?: string;
  className?: string;
  title?: string;
}

const SIZE_CLASSES = {
  xs: 'w-5 h-5 text-[9px]',
  sm: 'w-6 h-6 text-[10px]',
  md: 'w-8 h-8 text-xs',
  lg: 'w-10 h-10 text-sm',
};

const AVATAR_COLORS = [
  '#0052CC', '#00B8D9', '#6554C0', '#36B37E', '#FF5630', '#FF991F',
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
