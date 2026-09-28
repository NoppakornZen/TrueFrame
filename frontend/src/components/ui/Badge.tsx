import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  className = '',
}) => {
  const variants = {
    default: 'text-[var(--text-secondary)]',
    success: 'text-[var(--success)]',
    warning: 'text-[var(--warning)]',
    danger: 'text-[var(--danger)]',
    info: 'text-[var(--accent)]',
  };

  return (
    <span
      className={`inline-flex items-center font-mono text-[11px] uppercase tracking-[0.12em] ${variants[variant]} ${className}`}
    >
      {children}
    </span>
  );
};
