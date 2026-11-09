import React, { useId } from 'react';
import { PALETTE } from '../../theme/palette';

interface LiraAIAvatarProps {
  size?: number;
  className?: string;
  hasSparkles?: boolean;
}

export const LiraAIAvatar: React.FC<LiraAIAvatarProps> = ({
  size = 48,
  className = '',
  hasSparkles = true,
}) => {
  const rawId = useId();
  const id = rawId.replace(/[^a-zA-Z0-9_-]/g, '');

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        {/* Rich Multidimensional Gradient */}
        <linearGradient id={`${id}-bg`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#4F46E5" />
          <stop offset="45%" stopColor="#7C3AED" />
          <stop offset="85%" stopColor={PALETTE.brand} />
          <stop offset="100%" stopColor="#0284C7" />
        </linearGradient>

        {/* Glow / Rim Gradient */}
        <linearGradient id={`${id}-rim`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#C084FC" stopOpacity="0.85" />
          <stop offset="50%" stopColor="#60A5FA" stopOpacity="0.65" />
          <stop offset="100%" stopColor="#38BDF8" stopOpacity="0.95" />
        </linearGradient>

        {/* Golden Sparkle Gradient */}
        <linearGradient id={`${id}-sparkle`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FDE047" />
          <stop offset="50%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#38BDF8" />
        </linearGradient>

        {/* Soft Drop Shadow for the "L" */}
        <filter id={`${id}-shadow`} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="1.5" stdDeviation="1.5" floodColor="#0F172A" floodOpacity="0.45" />
        </filter>

        {/* Ambient Outer Glow */}
        <filter id={`${id}-glow`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="1" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Outer rounded squircle background */}
      <rect
        x="2"
        y="2"
        width="44"
        height="44"
        rx="13"
        fill={`url(#${id}-bg)`}
        stroke={`url(#${id}-rim)`}
        strokeWidth="1.5"
      />

      {/* Cyber AI Arc Circuit (subtle energetic arc) */}
      <path
        d="M 10 38 A 19 19 0 0 1 38 10"
        stroke="white"
        strokeWidth="1"
        strokeDasharray="2 3"
        strokeOpacity="0.35"
      />

      {/* Iconic Lira Bold "L" */}
      <g filter={`url(#${id}-shadow)`}>
        <path
          d="M 16 13 L 22.5 13 L 22.5 29.5 L 32.5 29.5 L 32.5 35 L 16 35 Z"
          fill="white"
          fillRule="evenodd"
        />
      </g>

      {/* Inner Highlight Reflection */}
      <path
        d="M 16.5 13.5 L 22 13.5 L 22 29 L 32 29"
        stroke="white"
        strokeWidth="0.75"
        strokeOpacity="0.4"
      />

      {/* AI Constellation Sparkles */}
      {hasSparkles && (
        <g filter={`url(#${id}-glow)`}>
          {/* Main 4-point AI Star in Top-Right */}
          <path
            d="M 35 14 C 35 11.5 36.5 10 39 10 C 36.5 10 35 8.5 35 6 C 35 8.5 33.5 10 31 10 C 33.5 10 35 11.5 35 14 Z"
            fill={`url(#${id}-sparkle)`}
          />
          {/* Micro Sparkle Star */}
          <path
            d="M 28 8 C 28 6.8 28.7 6 30 6 C 28.7 6 28 5.2 28 4 C 28 5.2 27.3 6 26 6 C 27.3 6 28 6.8 28 8 Z"
            fill="#FEF08A"
          />
          {/* Mini pulse dot */}
          <circle cx="39" cy="18" r="1" fill="#38BDF8" />
        </g>
      )}
    </svg>
  );
};
