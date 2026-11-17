import React from 'react';
import { LiraLogo } from '../common/LiraLogo';

interface LiraAIAvatarProps {
  size?: number;
  className?: string;
}

/** Viva's picture: the product mark on a flat tile in the navigation colour of the theme. */
export const LiraAIAvatar: React.FC<LiraAIAvatarProps> = ({ size = 48, className = '' }) => (
  <span
    className={`inline-flex items-center justify-center flex-shrink-0 rounded-md bg-lira-nav text-white ${className}`}
    style={{ width: size, height: size }}
    data-testid="viva-avatar"
  >
    <LiraLogo className="w-3/5 h-3/5" motion="none" />
  </span>
);
