// Minimal vector illustrations for beauty services
// Very low tone, minimalistic SVG vectors

import * as React from 'react';

interface VectorProps {
  className?: string;
  size?: number;
}

export const MakeupBrushVector: React.FC<VectorProps> = ({ className = '', size = 24 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path
      d="M8 2L6 4L10 8L12 6L8 2Z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity="0.6"
    />
    <path
      d="M12 6L16 10L20 6L16 2L12 6Z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity="0.8"
    />
    <path
      d="M4 12L8 16L12 12"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity="0.4"
    />
  </svg>
);

export const MirrorVector: React.FC<VectorProps> = ({ className = '', size = 24 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <ellipse
      cx="12"
      cy="12"
      rx="8"
      ry="10"
      stroke="currentColor"
      strokeWidth="1.5"
      opacity="0.3"
    />
    <path
      d="M12 2V6M12 18V22"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      opacity="0.5"
    />
    <circle
      cx="12"
      cy="12"
      r="5"
      stroke="currentColor"
      strokeWidth="1"
      opacity="0.2"
    />
  </svg>
);

export const HairVector: React.FC<VectorProps> = ({ className = '', size = 24 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path
      d="M8 4C8 4 10 6 12 4C14 6 16 4 16 4"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      opacity="0.5"
    />
    <path
      d="M6 8C6 8 8 10 12 8C16 10 18 8 18 8"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      opacity="0.6"
    />
    <path
      d="M4 12C4 12 7 14 12 12C17 14 20 12 20 12"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      opacity="0.7"
    />
    <path
      d="M2 16C2 16 6 18 12 16C18 18 22 16 22 16"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      opacity="0.8"
    />
  </svg>
);

export const SparkleVector: React.FC<VectorProps> = ({ className = '', size = 16 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path
      d="M8 0V4M8 12V16M0 8H4M12 8H16"
      stroke="currentColor"
      strokeWidth="1"
      strokeLinecap="round"
      opacity="0.4"
    />
    <path
      d="M2 2L4 4M12 12L14 14M2 14L4 12M12 4L14 2"
      stroke="currentColor"
      strokeWidth="1"
      strokeLinecap="round"
      opacity="0.3"
    />
    <circle cx="8" cy="8" r="1.5" fill="currentColor" opacity="0.2" />
  </svg>
);

export const CalendarVector: React.FC<VectorProps> = ({ className = '', size = 24 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <rect
      x="4"
      y="6"
      width="16"
      height="14"
      rx="2"
      stroke="currentColor"
      strokeWidth="1.5"
      opacity="0.4"
    />
    <path
      d="M4 10H20"
      stroke="currentColor"
      strokeWidth="1.5"
      opacity="0.3"
    />
    <circle cx="9" cy="14" r="1" fill="currentColor" opacity="0.3" />
    <circle cx="15" cy="14" r="1" fill="currentColor" opacity="0.3" />
    <path
      d="M8 2V6M16 2V6"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      opacity="0.5"
    />
  </svg>
);

export const CheckmarkVector: React.FC<VectorProps> = ({ className = '', size = 24 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <circle
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="1.5"
      opacity="0.2"
    />
    <path
      d="M8 12L11 15L16 9"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity="0.8"
    />
  </svg>
);

