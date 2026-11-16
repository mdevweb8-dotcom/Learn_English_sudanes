import React from 'react';

interface AvatarViewProps {
  avatarId: string;
  size?: number;
  className?: string;
}

const AVATAR_CONFIG: Record<string, { bg: string; fg: string; ring: string; label: string }> = {
  'avatar-sara': { bg: '#FCE7F3', fg: '#9D174D', ring: '#F472B6', label: 'س' },
  'avatar-ahmed': { bg: '#DBEAFE', fg: '#1E40AF', ring: '#60A5FA', label: 'أ' },
  'avatar-layla': { bg: '#EDE9FE', fg: '#5B21B6', ring: '#A78BFA', label: 'ل' },
  'avatar-omar': { bg: '#FEF3C7', fg: '#92400E', ring: '#FBBF24', label: 'ع' },
  'avatar-noor': { bg: '#D1FAE5', fg: '#065F46', ring: '#34D399', label: 'ن' },
  'avatar-scholar': { bg: '#E6F1F8', fg: '#155A82', ring: '#1A6FA0', label: '🎓' },
  'avatar-falcon': { bg: '#E0F2FE', fg: '#0369A1', ring: '#0EA5E9', label: '🦅' },
  'avatar-nile': { bg: '#FEF9C3', fg: '#854D0E', ring: '#EAB308', label: '⭐' },
  'avatar-astronaut': { bg: '#EDE9FE', fg: '#4338CA', ring: '#6366F1', label: '🚀' },
};

export const AvatarView: React.FC<AvatarViewProps> = ({ avatarId, size = 44, className = '' }) => {
  const cfg = AVATAR_CONFIG[avatarId] || AVATAR_CONFIG['avatar-scholar'];
  const isEmoji = !/^[\u0600-\u06FF]$/.test(cfg.label);

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      className={`shrink-0 rounded-full ${className}`}
      aria-hidden="true"
    >
      <circle cx="24" cy="24" r="22" fill={cfg.bg} stroke={cfg.ring} strokeWidth="2.5" />
      {isEmoji ? (
        <text x="24" y="30" textAnchor="middle" fontSize="20">
          {cfg.label}
        </text>
      ) : (
        <>
          <circle cx="24" cy="18" r="7" fill={cfg.fg} fillOpacity="0.16" />
          <path d="M12 39c2.5-6 7-9 12-9s9.5 3 12 9" fill={cfg.fg} fillOpacity="0.16" />
          <text x="24" y="29" textAnchor="middle" fontSize="18" fontWeight="800" fill={cfg.fg}>
            {cfg.label}
          </text>
        </>
      )}
    </svg>
  );
};
