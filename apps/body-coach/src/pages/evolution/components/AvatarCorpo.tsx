import React from 'react';

interface AvatarCorpoProps {
  volume: Record<string, number>;
}

export const AvatarCorpo: React.FC<AvatarCorpoProps> = ({ volume }) => {
  const getOpacity = (key: string) => {
    const vol = volume[key] ?? 0;
    return Math.min(1, vol / 20); // Assuming 20 series as max for full opacity
  };

  return (
    <div className="flex items-center justify-center space-x-8">
      {/* Front view */}
      <svg width="200" height="400" viewBox="0 0 200 400" xmlns="http://www.w3.org/2000/svg">
        {/* Muscle groups for front */}
        <ellipse cx="100" cy="50" rx="30" ry="20" fill="blue" fillOpacity={getOpacity('peito')} />
        {/* Shoulders - front */}
        <circle cx="70" cy="60" r="15" fill="blue" fillOpacity={getOpacity('ombros')} />
        <circle cx="130" cy="60" r="15" fill="blue" fillOpacity={getOpacity('ombros')} />
        {/* Biceps - front upper arm */}
        <rect x="50" y="80" width="20" height="60" fill="blue" fillOpacity={getOpacity('bíceps')} />
        <rect x="130" y="80" width="20" height="60" fill="blue" fillOpacity={getOpacity('bíceps')} />
        {/* Abs */}
        <rect x="80" y="150" width="40" height="50" fill="blue" fillOpacity={getOpacity('abdômen')} />
        {/* Quads - front thigh */}
        <rect x="70" y="210" width="30" height="80" fill="blue" fillOpacity={getOpacity('quadríceps')} />
        <rect x="100" y="210" width="30" height="80" fill="blue" fillOpacity={getOpacity('quadríceps')} />
        {/* Calves - front */}
        <rect x="75" y="300" width="20" height="50" fill="blue" fillOpacity={getOpacity('panturrilha')} />
        <rect x="105" y="300" width="20" height="50" fill="blue" fillOpacity={getOpacity('panturrilha')} />
        {/* Outline of front silhouette */}
        <path d="M50,100 Q100,0 150,100 L150,350 Q100,400 50,350 Z" fill="none" stroke="gray" strokeWidth="2" />
      </svg>

      {/* Back view */}
      <svg width="200" height="400" viewBox="0 0 200 400" xmlns="http://www.w3.org/2000/svg">
        {/* Back */}
        <ellipse cx="100" cy="50" rx="30" ry="20" fill="blue" fillOpacity={getOpacity('costas')} />
        {/* Shoulders - back */}
        <circle cx="70" cy="60" r="15" fill="blue" fillOpacity={getOpacity('ombros')} />
        <circle cx="130" cy="60" r="15" fill="blue" fillOpacity={getOpacity('ombros')} />
        {/* Triceps - back upper arm */}
        <rect x="50" y="80" width="20" height="60" fill="blue" fillOpacity={getOpacity('tríceps')} />
        <rect x="130" y="80" width="20" height="60" fill="blue" fillOpacity={getOpacity('tríceps')} />
        {/* Glutes */}
        <ellipse cx="85" cy="250" rx="25" ry="15" fill="blue" fillOpacity={getOpacity('glúteos')} />
        <ellipse cx="115" cy="250" rx="25" ry="15" fill="blue" fillOpacity={getOpacity('glúteos')} />
        {/* Hamstrings - back thigh */}
        <rect x="70" y="210" width="30" height="80" fill="blue" fillOpacity={getOpacity('posterior')} />
        <rect x="100" y="210" width="30" height="80" fill="blue" fillOpacity={getOpacity('posterior')} />
        {/* Calves - back */}
        <rect x="75" y="300" width="20" height="50" fill="blue" fillOpacity={getOpacity('panturrilha')} />
        <rect x="105" y="300" width="20" height="50" fill="blue" fillOpacity={getOpacity('panturrilha')} />
        {/* Outline of back silhouette */}
        <path d="M50,100 Q100,400 150,100 L150,350 Q100,0 50,350 Z" fill="none" stroke="gray" strokeWidth="2" />
      </svg>
    </div>
  );
};
