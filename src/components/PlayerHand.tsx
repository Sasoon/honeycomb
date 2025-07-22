import { motion, AnimatePresence } from 'framer-motion';

export type LetterTile = {
  id: string;
  letter: string;
  frequency: 'common' | 'medium' | 'uncommon' | 'rare';
  isSelected: boolean;
  tileType?: 'regular' | 'piston' | 'wild';
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
    
    // Special style for wild tile
    if (tileType === 'wild') {
      return 'bg-purple-200 border-purple-500'; // Same background as piston tile
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

  // Render the tile content based on its type
  const renderTileContent = (tile: LetterTile) => {
    if (tile.tileType === 'piston') {
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
          <path d="M 12 1 L 7 6 L 11 6 L 11 11 L 6 11 L 6 7 L 1 12 L 6 17 L 6 13 L 11 13 L 11 18 L 7 18 L 12 23 L 17 18 L 13 18 L 13 13 L 18 13 L 18 17 L 23 12 L 18 7 L 18 11 L 13 11 L 13 6 L 17 6 Z" />
        </svg>
      );
    } else if (tile.tileType === 'wild') {
      return (
        <div className="sparkle-container relative w-full h-full flex items-center justify-center">
          <span className="spark absolute inset-0 rounded-md overflow-hidden"></span>
          <span className="backdrop absolute inset-0 rounded-md"></span>
          <svg className="sparkle w-6 h-6 relative z-10" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M14.187 8.096L15 5.25L15.813 8.096C16.0231 8.83114 16.4171 9.50062 16.9577 10.0413C17.4984 10.5819 18.1679 10.9759 18.903 11.186L21.75 12L18.904 12.813C18.1689 13.0231 17.4994 13.4171 16.9587 13.9577C16.4181 14.4984 16.0241 15.1679 15.814 15.903L15 18.75L14.187 15.904C13.9769 15.1689 13.5829 14.4994 13.0423 13.9587C12.5016 13.4181 11.8321 13.0241 11.097 12.814L8.25 12L11.096 11.187C11.8311 10.9769 12.5006 10.5829 13.0413 10.0423C13.5819 9.50162 13.9759 8.83214 14.186 8.097L14.187 8.096Z" fill="currentColor" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M6 14.25L5.741 15.285C5.59267 15.8785 5.28579 16.4206 4.85319 16.8532C4.42059 17.2858 3.87853 17.5927 3.285 17.741L2.25 18L3.285 18.259C3.87853 18.4073 4.42059 18.7142 4.85319 19.1468C5.28579 19.5794 5.59267 20.1215 5.741 20.715L6 21.75L6.259 20.715C6.40725 20.1216 6.71398 19.5796 7.14639 19.147C7.5788 18.7144 8.12065 18.4075 8.714 18.259L9.75 18L8.714 17.741C8.12065 17.5925 7.5788 17.2856 7.14639 16.853C6.71398 16.4204 6.40725 15.8784 6.259 15.285L6 14.25Z" fill="currentColor" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M6.5 4L6.303 4.5915C6.24777 4.75718 6.15472 4.90774 6.03123 5.03123C5.90774 5.15472 5.75718 5.24777 5.5915 5.303L5 5.5L5.5915 5.697C5.75718 5.75223 5.90774 5.84528 6.03123 5.96877C6.15472 6.09226 6.24777 6.24282 6.303 6.4085L6.5 7L6.697 6.4085C6.75223 6.24282 6.84528 6.09226 6.96877 5.96877C7.09226 5.84528 7.24282 5.75223 7.4085 5.697L8 5.5L7.4085 5.303C7.24282 5.24777 7.09226 5.15472 6.96877 5.03123C6.84528 4.90774 6.75223 4.75718 6.697 4.5915L6.5 4Z" fill="currentColor" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      );
    }
    return tile.letter;
  };

  return (
    <div className="">
     
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        gap: '0.5rem'
      }}>
        <AnimatePresence initial={false}>
          {tiles.map((tile) => (
            <motion.div
              key={tile.id}
              data-tile-id={tile.id}
              className={`
                letter-tile-container
                ${getFrequencyClass(tile.frequency, tile.tileType)}
                ${tile.isSelected ? 'ring-2 ring-blue-500 scale-90' : ''}
                ${tile.tileType === 'piston' ? 'piston-tile' : ''}
                ${tile.tileType === 'wild' ? 'wild-tile' : ''}
              `}
              onClick={() => onTileSelect(tile)}
              style={{
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
                position: 'relative',
                overflow: 'hidden',
              }}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ 
                opacity: 1, 
                scale: tile.isSelected ? 0.9 : 1,
                transition: { 
                  type: "spring", 
                  stiffness: 500, 
                  damping: 30 
                }
              }}
              exit={{ 
                opacity: 0, 
                scale: 0.8, 
                x: -20,
                transition: { duration: 0.2 } 
              }}
              transition={{ 
                type: "spring",
                stiffness: 500,
                damping: 30
              }}
            >
              {renderTileContent(tile)}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      
      <style>{`
        .wild-tile {
          position: relative; 
          overflow: hidden;
        }

        .backdrop {
          background: linear-gradient(
            110deg,
            rgba(255, 255, 255, 0) 40%,
            rgba(255, 255, 255, 0.5) 50%,
            rgba(255, 255, 255, 0) 60%
          );
          background-size: 200% 100%;
          opacity: 0;
          transition: opacity 0.5s ease;
          pointer-events: none;
        }

        .wild-tile:hover .backdrop {
          opacity: 1;
          animation: shimmer 1.5s infinite linear;
        }
        
        .sparkle {
           transition: color 0.3s ease; 
        }

        .wild-tile:hover .sparkle {
            animation: sparkle-color 1s infinite alternate ease-in-out;
        }

        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }

        @keyframes sparkle-color {
           0% { color: #fffb00; }
           50% { color: #ffffff; }
           100% { color: #ffcc00; }
        }
      `}</style>
    </div>
  );
};

export default PlayerHand; 