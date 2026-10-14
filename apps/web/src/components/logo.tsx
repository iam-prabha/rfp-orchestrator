import React from 'react';
import Link from 'next/link';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'light' | 'dark' | 'auto';
  showBadge?: boolean;
  badgeText?: string;
  href?: string;
}

export function Logo({
  className = '',
  size = 'md',
  variant = 'auto',
  showBadge = true,
  badgeText = 'AI',
  href,
}: LogoProps) {
  const iconSizes = {
    sm: 'h-7 w-7 rounded-lg',
    md: 'h-8 w-8 rounded-xl',
    lg: 'h-10 w-10 rounded-2xl',
  };

  const svgDimensions = {
    sm: 28,
    md: 32,
    lg: 40,
  };

  const textSizes = {
    sm: 'text-base',
    md: 'text-lg',
    lg: 'text-2xl',
  };

  const badgeSizes = {
    sm: 'text-[9px] px-1.5 py-0.2',
    md: 'text-[10px] px-1.5 py-0.5',
    lg: 'text-xs px-2 py-0.5',
  };

  const isDark = variant === 'dark';

  const content = (
    <div className={`group inline-flex items-center gap-2.5 select-none transition-all ${className}`}>
      {/* Precision Emblem Mark */}
      <div
        className={`relative flex items-center justify-center overflow-hidden shadow-sm transition-transform duration-300 group-hover:scale-105 ${iconSizes[size]}`}
        style={{
          background: 'linear-gradient(135deg, #2563eb 0%, #4f46e5 50%, #7c3aed 100%)',
          boxShadow: '0 2px 8px -1px rgba(79, 70, 229, 0.35), inset 0 1px 1px 0 rgba(255, 255, 255, 0.4)',
        }}
      >
        {/* Glow ambient highlight */}
        <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-white/25 rounded-full blur-xs pointer-events-none" />

        <svg
          width={svgDimensions[size]}
          height={svgDimensions[size]}
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="relative z-10 p-1"
        >
          {/* Orchestration Loop (O) */}
          <circle
            cx="16"
            cy="16"
            r="8.5"
            stroke="white"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeDasharray="40 14"
            className="opacity-95"
          />
          {/* Forward Synthesis Vector (R flow) */}
          <path
            d="M11 21V11C11 11 15 10 17.5 12.5C20 15 17 18 13.5 18H11M16 17.5L21 23"
            stroke="white"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="opacity-90"
          />
          {/* Sparkling intelligence focal point */}
          <circle cx="21" cy="11" r="1.5" fill="#facc15" className="animate-pulse" />
        </svg>
      </div>

      {/* Modern Typographic Wordmark */}
      <div className="flex items-baseline gap-1.5">
        <span
          className={`font-black tracking-tight transition-colors ${
            isDark
              ? 'text-white'
              : 'text-slate-900 group-hover:text-blue-600'
          } ${textSizes[size]}`}
        >
          <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 bg-clip-text text-transparent">
            RFP
          </span>
          <span className={isDark ? 'text-white ml-1 font-semibold' : 'text-slate-800 ml-1 font-semibold'}>
            Orchestrator
          </span>
        </span>

        {showBadge && (
          <span
            className={`font-mono font-bold uppercase tracking-wider rounded-md border transition-colors ${
              isDark
                ? 'bg-indigo-950/80 text-indigo-300 border-indigo-700/60'
                : 'bg-blue-50 text-blue-700 border-blue-200/80 group-hover:border-blue-300'
            } ${badgeSizes[size]}`}
          >
            {badgeText}
          </span>
        )}
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="inline-block outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-lg">
        {content}
      </Link>
    );
  }

  return content;
}
