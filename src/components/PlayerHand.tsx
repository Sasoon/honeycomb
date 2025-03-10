import { useState } from 'react';

export type LetterTile = {
  id: string;
  letter: string;
  frequency: 'common' | 'medium' | 'uncommon' | 'rare';
  isSelected: boolean;
};

type PlayerHandProps = {
  tiles: LetterTile[];
  onTileSelect: (tile: LetterTile) => void;
  onReshuffle?: () => void;
  reshuffleCost?: number;
  tilesRemaining?: number;
};

const PlayerHand = ({ 
  tiles, 
  onTileSelect, 
  onReshuffle, 
  reshuffleCost,
  tilesRemaining 
}: PlayerHandProps) => {
  const getFrequencyClass = (frequency: LetterTile['frequency']) => {
    switch (frequency) {
      case 'common': return 'bg-gray-100 border-gray-300';
      case 'medium': return 'bg-blue-100 border-blue-300';
      case 'uncommon': return 'bg-purple-100 border-purple-300';
      case 'rare': return 'bg-amber-100 border-amber-500';
      default: return 'bg-gray-100 border-gray-300';
    }
  };

  // Define styles directly
  const titleStyle = {
    fontSize: '1.125rem',
    lineHeight: '1.75rem',
    fontWeight: 600,
    marginBottom: '0.5rem'
  };

  const tilesRemainingStyle = {
    fontSize: '0.875rem',
    lineHeight: '1.25rem',
    color: '#4b5563'
  };

  return (
    <div className="">
     
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        gap: '0.5rem'
      }}>
        {tiles.map((tile) => (
          <div
            key={tile.id}
            className={`
              ${getFrequencyClass(tile.frequency)}
              ${tile.isSelected ? 'ring-2 ring-blue-500 scale-90' : ''}
            `}
            onClick={() => onTileSelect(tile)}
            style={{
              padding: '.25rem',
              width: '3rem',
              height: '3rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '0.5rem',
              border: '1px solid black',
              fontSize: '1.25rem',
              fontWeight: 'bold',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            {tile.letter}
          </div>
        ))}
      </div>
      
    </div>
  );
};

export default PlayerHand; 