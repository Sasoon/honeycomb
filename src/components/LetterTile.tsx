import React from 'react';
import { cn } from '../lib/utils';

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
      className={cn(
        "letter-tile",
        "flex items-center justify-center",
        "text-2xl font-bold text-text-primary",
        "bg-bg-primary border border-secondary/20",
        "rounded-2xl shadow-sm",
        "transition-[background-color,border-color,box-shadow,transform] duration-200 ease-out",
        "hover:shadow-lg hover:shadow-secondary/10",
        "hover:border-secondary/30",
        "cursor-pointer select-none",
        "focus:outline-none focus:ring-2 focus:ring-amber/50",
        isSelected && [
          "scale-110 bg-amber text-white",
          "border-amber shadow-lg shadow-amber/20",
          "ring-2 ring-amber/50"
        ],
        !isSelected && "hover:scale-105 active:scale-95",
        onClick && "hover:bg-secondary/5",
        className
      )}
      onClick={onClick}
      tabIndex={onClick ? 0 : -1}
      role={onClick ? "button" : undefined}
      aria-pressed={isSelected}
    >
      {letter}
    </div>
  );
};

export default LetterTile; 