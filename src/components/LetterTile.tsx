import React from 'react';

type LetterTileProps = {
  letter: string;
  isSelected?: boolean;
  onClick?: () => void;
  className?: string;
};

const LetterTile: React.FC<LetterTileProps> = ({ 
  letter, 
  isSelected = false,
  onClick,
  className = ''
}) => {
  return (
    <div 
      className={`letter-tile ${isSelected ? 'ring-2 ring-blue-500 scale-110 selected-tile-glow' : 'hover:scale-105'} ${className}`}
      onClick={onClick}
      style={{
        fontSize: '1.5rem',
        lineHeight: '2rem',
        fontWeight: 700,
        transition: 'transform 0.2s ease, box-shadow 0.2s ease'
      }}
    >
      {letter}
    </div>
  );
};

export default LetterTile; 