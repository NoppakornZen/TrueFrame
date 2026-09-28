import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  children,
  className = '',
  ...props
}) => {
  const variants = {
    primary: 'bg-[var(--accent)] text-[var(--surface-2)] hover:bg-[var(--accent-dim)]',
    secondary:
      'bg-transparent text-[var(--text-primary)] border border-[var(--surface-5)] hover:bg-[var(--surface-3)]',
    danger: 'bg-[var(--danger)] text-[var(--surface-2)] hover:opacity-90',
    ghost: 'bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
  };

  const sizes = {
    sm: 'px-2.5 py-1 text-sm',
    md: 'px-3.5 py-1.5 text-sm',
    lg: 'px-5 py-2.5 text-base',
  };

  return (
    <button
      className={`inline-flex items-center justify-center font-medium disabled:cursor-not-allowed disabled:opacity-40 ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};
