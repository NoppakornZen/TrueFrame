import React from 'react';

interface ProgressProps {
  value: number;
  max?: number;
  className?: string;
  showLabel?: boolean;
}

export const Progress: React.FC<ProgressProps> = ({
  value,
  max = 100,
  className = '',
  showLabel = false,
}) => {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

  return (
    <div className={`w-full ${className}`}>
      <div className="h-1 w-full bg-[var(--surface-3)]">
        <div className="h-full bg-[var(--accent)]" style={{ width: `${percentage}%` }} />
      </div>
      {showLabel && (
        <div className="mt-1 text-right font-mono text-xs text-[var(--text-tertiary)]">
          {percentage.toFixed(1)}%
        </div>
      )}
    </div>
  );
};
