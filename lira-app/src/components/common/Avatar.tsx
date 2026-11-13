import React from 'react';

interface AvatarProps {
  initials?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
  title?: string;
}

const SIZE_CLASSES = {
  xs: 'w-5 h-5 text-4xs',
  sm: 'w-6 h-6 text-3xs',
  md: 'w-8 h-8 text-xs',
  lg: 'w-10 h-10 text-sm',
};

/** A person's initials in a circle, in the button colour of the theme. */
export const Avatar: React.FC<AvatarProps> = ({
  initials = 'VY',
  size = 'md',
  className = '',
  title,
}) => {
  const text = (initials || 'U').trim() || 'U';

  return (
    <div
      className={`rounded-full flex items-center justify-center font-bold bg-lira-blue text-lira-on-blue flex-shrink-0 select-none ${SIZE_CLASSES[size]} ${className}`}
      title={title || text}
    >
      {text.slice(0, 2).toUpperCase()}
    </div>
  );
};
