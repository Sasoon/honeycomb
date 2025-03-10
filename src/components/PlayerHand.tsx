export type LetterTile = {
  id: string;
  letter: string;
  frequency: 'common' | 'medium' | 'uncommon' | 'rare';
  isSelected: boolean;
  tileType?: 'regular' | 'piston';
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
}: PlayerHandProps) => {
  const getFrequencyClass = (frequency: LetterTile['frequency'], tileType?: LetterTile['tileType']) => {
    // Special style for piston tile
    if (tileType === 'piston') {
      return 'bg-purple-200 border-purple-500';
    }
    
    // Styles for regular tiles
    switch (frequency) {
      case 'common': return 'bg-gray-100 border-gray-300';
      case 'medium': return 'bg-blue-100 border-blue-300';
      case 'uncommon': return 'bg-purple-100 border-purple-300';
      case 'rare': return 'bg-amber-100 border-amber-500';
      default: return 'bg-gray-100 border-gray-300';
    }
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
              ${getFrequencyClass(tile.frequency, tile.tileType)}
              ${tile.isSelected ? 'ring-2 ring-blue-500 scale-90' : ''}
              ${tile.tileType === 'piston' ? 'piston-tile' : ''}
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