import React from 'react';

interface HexagonBorderProps {
  isVisible: boolean;
  color?: string;
  strokeWidth?: number;
}

const HexagonBorder: React.FC<HexagonBorderProps> = ({
  isVisible,
  color = 'var(--primary)',
  strokeWidth = 2
}) => {
  // Only render if we need to show the border
  if (!isVisible) {
    return null;
  }

  return (
    <svg
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 10
      }}
      viewBox="0 0 100 115.47"
      preserveAspectRatio="none"
    >
      <path
        d="M 50 0 L 100 28.87 L 100 86.60 L 50 115.47 L 0 86.60 L 0 28.87 Z"
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        style={{
          clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)'
        }}
      />
    </svg>
  );
};

export default HexagonBorder;