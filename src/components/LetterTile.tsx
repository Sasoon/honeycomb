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
      className={`letter-tile ${isSelected ? 'ring-2 ring-blue-500 scale-110' : ''} ${className}`}
      onClick={onClick}
      style={{
        fontSize: '1.5rem',
        lineHeight: '2rem',
        fontWeight: 700
      }}
    >
      {letter}
    </div>
  );
};

export default LetterTile; 