import { forwardRef, useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import HexGrid, { HexCell } from './HexGrid';
import PlayerHand, { LetterTile } from './PlayerHand';
import UndoButton from './UndoButton';
import MobileGameControls from './MobileGameControls';
import { WordHistoryEntry, useActiveGameStore } from '../store/activeGameStore';
import { TARGET_SCORE } from '../lib/gameUtils';

interface GameContentProps {
  grid: HexCell[];
  gridSize: number;
  playerHand: LetterTile[];
  letterBagCount: number;
  currentWord: string;
  isPlacementPhase: boolean;
  isWordValid: boolean;
  isWordAlreadyScored: boolean;
  potentialScore: number;
  isDictionaryLoading: boolean;
  placedTilesThisTurn: HexCell[];
  score: number;
  turns: number;
  wordHistory: WordHistoryEntry[];
  isPistonActive: boolean;
  pistonSourceCell: HexCell | null;
  onCellClick: (cell: HexCell) => void;
  onTileSelect: (tile: LetterTile) => void;
  onBurnTile: () => void;
  onScoreWord: () => void;
  maxPlacementTiles: number;
  onEndPlacementPhase?: () => void;
  playerHandRef?: React.RefObject<HTMLDivElement | null>;
  isGameActive: boolean;
}

// Interface for the animated burn tile
interface AnimatedBurnTile {
  letter: string;
  sourcePosition: { x: number; y: number };
  targetPosition: { x: number; y: number };
  isAnimating: boolean;
  dimensions?: { width: number; height: number };
  frequency: string;
  tileType?: string;
}

const GameContent = forwardRef<HTMLDivElement, GameContentProps>(({
  grid,
  gridSize,
  playerHand,
  letterBagCount,
  currentWord,
  isPlacementPhase,
  isWordValid,
  isWordAlreadyScored,
  potentialScore,
  isDictionaryLoading,
  placedTilesThisTurn,
  score,
  turns,
  wordHistory,
  isPistonActive,
  pistonSourceCell,
  onCellClick,
  onTileSelect,
  onBurnTile,
  onScoreWord,
  maxPlacementTiles,
  onEndPlacementPhase,
  playerHandRef,
  isGameActive = true,
}, ref) => {
  // Get the resetGame function from the store
  const { resetGame } = useActiveGameStore();

  // Get tilePlacementAnimation from the store
  const { tilePlacementAnimation } = useActiveGameStore();

  // Phase transition animation variants
  const phaseTransitionVariants = {
    initial: { 
      opacity: 0,
      scale: 0.95
    },
    animate: { 
      opacity: 1,
      scale: 1,
      transition: { 
        duration: 0.3,
        ease: "easeInOut"
      }
    },
    exit: { 
      opacity: 0,
      scale: 0.95,
      transition: { 
        duration: 0.2 
      }
    }
  };

  // Add states for the fire particles
  const [showParticles, setShowParticles] = useState(false);
  const [isIconGlowing, setIsIconGlowing] = useState(false);
  const [animationKey, setAnimationKey] = useState(0); // Add a key to force animation restart
  // Add state for burn tile animation
  const [animatedBurnTile, setAnimatedBurnTile] = useState<AnimatedBurnTile | null>(null);
  
  const isBurnButtonActive = isPlacementPhase && playerHand.some(t => t.isSelected) && pistonSourceCell === null && isGameActive;
  
  // Reference to the burn button
  const burnButtonRef = useRef<HTMLButtonElement>(null);
  
  // Clean up animations if burn button becomes inactive
  useEffect(() => {
    if (!isBurnButtonActive) {
      setShowParticles(false);
      setIsIconGlowing(false);
    }
  }, [isBurnButtonActive]);
  
  // Store timeouts in refs so we can clear them
  const animationTimeouts = useRef<{[key: string]: NodeJS.Timeout}>({});
  
  // Clear all animation timeouts
  const clearAnimationTimeouts = () => {
    Object.values(animationTimeouts.current).forEach(timeout => {
      clearTimeout(timeout);
    });
    animationTimeouts.current = {};
  };
  
  // Clean up all animations and DOM elements when component unmounts
  useEffect(() => {
    return () => {
      // Clear all animation timeouts
      clearAnimationTimeouts();
      
      // Clean up any burn particles that might be in the DOM
      const particles = document.querySelectorAll('.burn-particle');
      particles.forEach(particle => {
        if (document.body.contains(particle)) {
          document.body.removeChild(particle);
        }
      });
      
      // Reset any lingering animations
      setShowParticles(false);
      setIsIconGlowing(false);
      setAnimatedBurnTile(null);
    };
  }, []);
  
  // Handle burn with animation
  const handleBurnWithAnimation = () => {
    // Clear any existing timeouts
    clearAnimationTimeouts();
    
    // First increment key to ensure new animation
    setAnimationKey(prev => prev + 1);
    
    // Find the selected tile element to animate
    const selectedTile = playerHand.find(tile => tile.isSelected);
    
    if (selectedTile && playerHandRef?.current && burnButtonRef.current) {
      // Delay getting positions until after render to ensure accuracy
      try {
        requestAnimationFrame(() => {
          try {
            // Find the DOM element of the selected tile in the player hand
            const tileElements = playerHandRef.current?.querySelectorAll('.letter-tile-container');
            if (!tileElements || !playerHandRef.current || !burnButtonRef.current) {
              // Fallback if refs are no longer valid
              onBurnTile();
              return;
            }
            
            const selectedTileElement = Array.from(tileElements || []).find(el => 
              el.getAttribute('data-tile-id') === selectedTile.id
            ) as HTMLElement;
            
            // If we found both the tile element and the burn button, set up the animation
            if (selectedTileElement && burnButtonRef.current) {
              const tileRect = selectedTileElement.getBoundingClientRect();
              const buttonRect = burnButtonRef.current.getBoundingClientRect();
              
              // Get dimensions from the source element
              const dimensions = {
                width: tileRect.width,
                height: tileRect.height
              };
              
              // For more accurate positioning
              const sourceX = tileRect.left + tileRect.width / 2;
              const sourceY = tileRect.top + tileRect.height / 2;
              const targetX = buttonRect.left + buttonRect.width / 2;
              const targetY = buttonRect.top + buttonRect.height / 2;
              
              // Set up the animated tile
              setAnimatedBurnTile({
                letter: selectedTile.letter,
                sourcePosition: {
                  x: sourceX,
                  y: sourceY
                },
                targetPosition: {
                  x: targetX,
                  y: targetY
                },
                isAnimating: true,
                dimensions: dimensions,
                frequency: selectedTile.frequency,
                tileType: selectedTile.tileType
              });
              
              // Make the original tile invisible during animation
              selectedTileElement.style.opacity = '0';
              
              // Start fire particles with slight delay
              setTimeout(() => {
                setShowParticles(true);
                setIsIconGlowing(true);
              }, 250); // Adjusted to match halfway through a 500ms animation
              
              // Create the impact particles
              const createImpactParticles = () => {
                try {
                  // Get the button's position (with null check)
                  if (!burnButtonRef.current) return;
                  
                  const buttonRect = burnButtonRef.current.getBoundingClientRect();
                  const centerX = buttonRect.left + buttonRect.width / 2;
                  const centerY = buttonRect.top + buttonRect.height / 2;
                  
                  // Create and append particles to the document body
                  for (let i = 0; i < 8; i++) {
                    try {
                      const particle = document.createElement('div');
                      particle.className = 'burn-particle';
                      
                      // Random position offsets
                      const xOffset = (Math.random() - 0.5) * 40;
                      const yOffset = (Math.random() - 0.5) * 40;
                      
                      // Set position
                      particle.style.left = `${centerX}px`;
                      particle.style.top = `${centerY}px`;
                      particle.style.width = `${8 + Math.random() * 8}px`;
                      particle.style.height = `${8 + Math.random() * 8}px`;
                      
                      // Set custom properties for the animation direction
                      particle.style.setProperty('--x', `${xOffset}px`);
                      particle.style.setProperty('--y', `${yOffset}px`);
                      
                      // Add to document
                      document.body.appendChild(particle);
                      
                      // Clean up after animation
                      setTimeout(() => {
                        try {
                          if (document.body.contains(particle)) {
                            document.body.removeChild(particle);
                          }
                        } catch (e) {
                          console.log('Error removing particle:', e);
                        }
                      }, 500); // Standardized to 500ms
                    } catch (e) {
                      console.log('Error creating particle:', e);
                    }
                  }
                } catch (e) {
                  console.log('Error in createImpactParticles:', e);
                }
              };
              
              // Add burn impact class to button when tile reaches the fire
              setTimeout(() => {
                if (burnButtonRef.current) {
                  burnButtonRef.current.classList.add('burn-impact');
                }
                
                // Create the impact particles
                createImpactParticles();
              }, 400); // Adjusted for better timing with a 500ms animation
              
              // Trigger the actual burn with a delay to match animation completion
              animationTimeouts.current.burn = setTimeout(() => {
                onBurnTile();
                
                // End animation after a delay
                animationTimeouts.current.end = setTimeout(() => {
                  setShowParticles(false);
                  setIsIconGlowing(false);
                  setAnimatedBurnTile(null);
                  
                  // Remove burn impact class
                  if (burnButtonRef.current) {
                    burnButtonRef.current.classList.remove('burn-impact');
                  }
                  
                  // Restore original tile visibility (though it may be gone from state by now)
                  if (selectedTileElement) {
                    selectedTileElement.style.opacity = '1';
                  }
                }, 500); // Standardized to 500ms
              }, 500); // Complete animation after 500ms
            } else {
              // Fallback if elements aren't found, just do regular burn
              setShowParticles(true);
              setIsIconGlowing(true);
              
              animationTimeouts.current.burn = setTimeout(() => {
                onBurnTile();
                
                animationTimeouts.current.end = setTimeout(() => {
                  setShowParticles(false);
                  setIsIconGlowing(false);
                }, 500); // Standardized to 500ms
              }, 500); // Standardized to 500ms
            }
          } catch (e) {
            console.log('Error in requestAnimationFrame:', e);
            onBurnTile();
          }
        });
      } catch (e) {
        console.log('Error in handleBurnWithAnimation:', e);
        onBurnTile();
      }
    } else {
      // Fallback if there's no selected tile or refs are missing
      setShowParticles(true);
      setIsIconGlowing(true);
      
      // Trigger the actual burn with a slight delay to allow animation to start
      animationTimeouts.current.burn = setTimeout(() => {
        onBurnTile();
        
        // End animation after a delay
        animationTimeouts.current.end = setTimeout(() => {
          setShowParticles(false);
          setIsIconGlowing(false);
        }, 500); // Standardized to 500ms
      }, 500); // Standardized to 500ms
    }
  };

  // Helper to get frequency class similar to PlayerHand component
  const getFrequencyClass = (frequency: string, tileType?: string) => {
    // Special style for piston tile
    if (tileType === 'piston') {
      return 'bg-purple-200 border-purple-500';
    }
    
    // Special style for wild tile
    if (tileType === 'wild') {
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

  // Wrapper for cell click handler that checks if game is active
  const handleCellClick = (cell: HexCell) => {
    if (isGameActive) {
      onCellClick(cell);
    }
  };

  // Wrapper for tile select handler that checks if game is active
  const handleTileSelect = (tile: LetterTile) => {
    if (isGameActive) {
      onTileSelect(tile);
    }
  };

  return (
    <div 
      ref={ref}
      className={`flex-grow ${!isGameActive ? 'pointer-events-none opacity-70' : ''} relative`}
    >
      {/* Game Over Overlay with Restart Button */}
      {!isGameActive && (
        <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-auto">
          <motion.div 
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, delay: 1.5 }}
            className="bg-white shadow-xl rounded-lg p-8 text-center max-w-sm mx-auto border-2 border-amber-500"
          >
            <div className="mb-2">
              <span className="inline-block bg-amber-100 rounded-full p-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
              </span>
            </div>
            <h2 className="text-2xl font-bold text-amber-800 mb-3">Game Complete!</h2>
            <p className="text-gray-700 mb-6">Final score: <span className="font-bold text-amber-600 text-xl">{score}</span> points</p>
            <button
              onClick={() => {
                // Dismiss any toast notifications
                import('../lib/toastService').then(({ default: toastService }) => {
                  toastService.dismiss();
                  // Reset the game
                  resetGame();
                });
              }}
              className="w-full py-3 px-4 bg-honeycomb hover:bg-honeycomb-dark text-white font-medium rounded-md shadow-md transition-colors transform hover:scale-105 active:scale-95"
            >
              Play Again
            </button>
          </motion.div>
        </div>
      )}

      {/* Mobile Game Controls - New Component */}
      <MobileGameControls
        currentScore={score}
        targetScore={TARGET_SCORE}
        turns={turns}
        letterBagCount={letterBagCount}
        isPlacementPhase={isPlacementPhase}
        placedTilesCount={placedTilesThisTurn.length}
        maxPlacementTiles={maxPlacementTiles}
        wordHistory={wordHistory}
        onEndPlacementPhase={isGameActive ? onEndPlacementPhase : undefined}
        isPistonActive={isPistonActive}
        pistonSourceCell={pistonSourceCell}
        playerHand={playerHand}
        isGameActive={isGameActive}
      />
      
      {/* Phase transition animation wrapper */}
      <AnimatePresence mode="wait">
        <motion.div
          key={isPlacementPhase ? "placement" : "scoring"}
          initial="initial"
          animate="animate"
          exit="exit"
          variants={phaseTransitionVariants}
          className="w-full"
        >
          {/* Grid container */}
          <div className="grid-container flex justify-center mb-4 md:mb-6 mt-12">
            <HexGrid 
              gridSize={gridSize}
              cells={grid} 
              onCellClick={handleCellClick}
              isWordValid={currentWord.length >= 3 ? isWordValid : undefined}
              isPlacementPhase={isPlacementPhase}
              isWordAlreadyScored={isWordAlreadyScored}
              placedTilesThisTurn={placedTilesThisTurn}
              isGameActive={isGameActive}
              playerHandRef={playerHandRef} 
            />
          </div>
        </motion.div>
      </AnimatePresence>
      
      {/* Action buttons - conditionally rendered only when there are buttons to show */}
      {(!isPlacementPhase || placedTilesThisTurn.length > 0) && (
        <div className="flex justify-center items-center mb-4 flex-wrap gap-2">
          <AnimatePresence mode="wait">
            <motion.div
              key={isPlacementPhase ? "placement-actions" : "scoring-actions"}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="flex flex-wrap gap-2 justify-center items-center"
            >
              {!isPlacementPhase ? (
                <>
                  {/* Dynamic button color based on word state */}
                  <button
                    className={`py-1.5 px-3 rounded-md shadow-sm
                              flex items-center justify-center transition-colors text-sm font-medium
                              ${!currentWord || currentWord.length < 3 || !isGameActive
                                ? 'bg-gray-300 text-gray-600 cursor-not-allowed' 
                                : isWordValid && !isWordAlreadyScored
                                  ? 'bg-green-500 hover:bg-green-600 text-white' 
                                  : 'bg-red-500 hover:bg-red-600 text-white'}`}
                    onClick={() => onScoreWord()}
                    disabled={!isWordValid || isWordAlreadyScored || currentWord.length < 3 || !isGameActive}
                    aria-label="Score word"
                  >
                    Score Word <span className="ml-1">({potentialScore})</span>
                    {isDictionaryLoading && (
                      <span className="ml-1 animate-pulse">•••</span>
                    )}
                  </button>
                  
                  {/* Current word display */}
                  {currentWord && currentWord.length > 0 && (
                    <div className="py-1.5 px-3 bg-purple-100 text-purple-800 rounded-md font-medium">
                      Word: {currentWord}
                    </div>
                  )}
                  
                  {/* Undo button */}
                  <UndoButton />
                </>
              ) : (
                <>
                  {/* Show tiles placed info */}
                  {placedTilesThisTurn.length > 0 && (
                    <div className="py-1.5 px-3 bg-blue-100 text-blue-800 rounded-md font-medium">
                      Tiles: {placedTilesThisTurn.length}/{maxPlacementTiles}
                    </div>
                  )}
                  
                  {/* End Placement Phase button - Only show during placement with at least 1 tile placed */}
                  {isPlacementPhase && placedTilesThisTurn.length > 0 && onEndPlacementPhase && (
                    <button
                      className={`py-1.5 px-3 rounded-md shadow-sm
                                flex items-center justify-center transition-colors text-sm font-medium
                                ${(isPistonActive || pistonSourceCell !== null || playerHand.some(t => t.isSelected && t.tileType === 'piston') || !isGameActive) 
                                  ? 'bg-gray-400 cursor-not-allowed' 
                                  : 'bg-amber-500 hover:bg-amber-600'} text-white`}
                      onClick={onEndPlacementPhase}
                      disabled={isPistonActive || pistonSourceCell !== null || playerHand.some(t => t.isSelected && t.tileType === 'piston') || !isGameActive}
                      aria-label="End placement phase"
                    >
                      End Phase
                    </button>
                  )}
                  
                  {/* Undo button */}
                  <UndoButton />
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      )}
      
      {/* Player hand with positioned action buttons */}
      <div className="mt-4 pb-16 md:pb-0 relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={isPlacementPhase ? "placement-hand" : "scoring-hand"}
            initial={{ opacity: 0.7 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="flex items-center justify-center"
            ref={playerHandRef}
          >
            <PlayerHand 
              tiles={playerHand} 
              onTileSelect={handleTileSelect} 
              tilesRemaining={letterBagCount}
            />
            
            {/* Burn button */}
            <button
              ref={burnButtonRef}
              onClick={handleBurnWithAnimation}
              disabled={!isPlacementPhase || !playerHand.some(t => t.isSelected) || pistonSourceCell !== null || !isGameActive}
              className={`h-12 w-12 ml-2 order-2 flex items-center justify-center
                         relative hover:scale-105 ${isBurnButtonActive ? 'burn-button-active' : ''}`}
              aria-label="Burn selected tile"
              style={{ 
                opacity: !isPlacementPhase || !playerHand.some(t => t.isSelected) || pistonSourceCell !== null || !isGameActive ? 0.5 : 1,
                transition: 'all 0.2s ease'
              }}
            >
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                viewBox="0 0 24 24" 
                fill="currentColor" 
                className={`w-8 h-8 text-red-500 transition-filter duration-300 ${isIconGlowing ? 'burn-icon-glow' : ''}`}
              >
                <path fillRule="evenodd" d="M12.963 2.286a.75.75 0 00-1.071-.136 9.742 9.742 0 00-3.539 6.177A7.547 7.547 0 016.648 6.61a.75.75 0 00-1.152.082A9 9 0 1015.68 4.534a7.46 7.46 0 01-2.717-2.248zM15.75 14.25a3.75 3.75 0 11-7.313-1.172c.628.465 1.35.81 2.133 1a5.99 5.99 0 011.925-3.545 3.75 3.75 0 013.255 3.717z" clipRule="evenodd" />
              </svg>
              
              {/* Fire particles */}
              <AnimatePresence mode="sync">
                {(showParticles && isBurnButtonActive) && (
                  <>
                    {/* Create multiple fire particles */}
                    {[...Array(8)].map((_, index) => (
                      <motion.div
                        key={`particle-${index}-${animationKey}`}
                        initial={{ 
                          opacity: 0.9, 
                          scale: 0.5 + Math.random() * 0.5,
                          y: 0, 
                          x: (index % 2 === 0 ? -1 : 1) * Math.random() * 5 
                        }}
                        animate={{ 
                          opacity: 0, 
                          scale: 0 + Math.random() * 0.5,
                          y: -18 - (Math.random() * 12),
                          x: (index % 2 === 0 ? -1 : 1) * (3 + Math.random() * 8) 
                        }}
                        exit={{ opacity: 0, scale: 0 }}
                        transition={{ 
                          duration: 0.5 + (Math.random() * 0.3),
                          ease: "easeOut"
                        }}
                        className={`absolute w-3 h-3 rounded-full z-10 fire-particle-${index % 3}`}
                        style={{
                          bottom: '40%',
                          left: '50%',
                          transform: 'translateX(-50%)'
                        }}
                      />
                    ))}
                  </>
                )}
              </AnimatePresence>
            </button>
          </motion.div>
        </AnimatePresence>
      </div>
      
      {/* Animated tile for burn animation */}
      <AnimatePresence>
        {animatedBurnTile && animatedBurnTile.isAnimating && (
          <motion.div
            initial={{ 
              position: 'fixed', 
              left: animatedBurnTile.sourcePosition.x, 
              top: animatedBurnTile.sourcePosition.y, 
              x: '-50%', 
              y: '-50%',
              scale: 1,
              zIndex: 100,
              opacity: 1,
              rotate: 0
            }}
            animate={{ 
              left: animatedBurnTile.targetPosition.x, 
              top: animatedBurnTile.targetPosition.y,
              rotate: 180
            }}
            exit={{ 
              opacity: 0,
              scale: 0,
              filter: "brightness(1.5) blur(5px)"
            }}
            transition={{ 
              type: 'spring',
              duration: 0.5,
              bounce: 0.2
            }}
            className="burn-animated-tile"
            data-testid="burn-animated-tile"
            style={{
              width: `${animatedBurnTile.dimensions?.width || 48}px`,
              height: `${animatedBurnTile.dimensions?.height || 48}px`
            }}
          >
            <motion.div
              initial={{ backgroundColor: "rgba(255, 255, 255, 1)" }}
              animate={{ 
                backgroundColor: "rgba(255, 87, 34, 1)",
                boxShadow: "0 0 15px rgba(255, 87, 34, 0.8)"
              }}
              transition={{ 
                duration: 0.5,
                ease: "easeOut"
              }}
              className={`burn-animated-tile-inner ${getFrequencyClass(animatedBurnTile.frequency, animatedBurnTile.tileType)}`}
            >
              <span className="letter-tile">{animatedBurnTile.letter}</span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Animated tile for placement animation */}
      <AnimatePresence>
        {tilePlacementAnimation && tilePlacementAnimation.isAnimating && (
          <motion.div
            initial={{ 
              position: 'fixed', 
              left: tilePlacementAnimation.sourcePosition.x, 
              top: tilePlacementAnimation.sourcePosition.y, 
              transform: 'translate(-50%, -50%)',
              scale: 1,
              zIndex: 100,
              opacity: 1,
              rotate: 0
            }}
            animate={{ 
              left: tilePlacementAnimation.targetPosition.x, 
              top: tilePlacementAnimation.targetPosition.y,
              scale: 0.9
            }}
            transition={{ 
              type: 'spring',
              duration: 0.5,
              bounce: 0.2,
              ease: [0.25, 0.1, 0.25, 1]
            }}
            className="tile-placement-animated"
            data-testid="tile-placement-animated"
            style={{
              width: `${tilePlacementAnimation.dimensions?.width || 48}px`,
              height: `${tilePlacementAnimation.dimensions?.height || 48}px`
            }}
          >
            <motion.div
              initial={{ backgroundColor: "rgba(255, 255, 255, 1)" }}
              animate={{ 
                backgroundColor: "rgba(52, 211, 153, 0.8)",
                boxShadow: "0 0 15px rgba(52, 211, 153, 0.5)"
              }}
              transition={{ 
                duration: 0.5,
                ease: "easeOut"
              }}
              className={`tile-placement-animated-inner ${getFrequencyClass(tilePlacementAnimation.frequency, tilePlacementAnimation.tileType)}`}
            >
              <span className="letter-tile">{tilePlacementAnimation.letter}</span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      <style>{`
        .burn-animated-tile {
          pointer-events: none;
          will-change: transform;
        }
        
        .burn-animated-tile-inner {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          font-size: 1.25rem;
          filter: drop-shadow(0px 0px 8px rgba(255, 59, 48, 0.6));
          will-change: transform;
          border-radius: 0.5rem;
          border: 1px solid black;
        }
        
        .tile-placement-animated {
          pointer-events: none;
          will-change: transform;
          position: fixed;
          z-index: 100;
        }
        
        .tile-placement-animated-inner {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          font-size: 1.25rem;
          border-radius: 0.5rem;
          border: 1px solid black;
          filter: drop-shadow(0px 0px 8px rgba(52, 211, 153, 0.6));
          will-change: transform;
          position: relative;
          overflow: hidden;
        }
        
        .tile-placement-animated::before {
          content: '';
          position: absolute;
          top: 50%;
          left: 0;
          right: 0;
          height: 5px;
          background: linear-gradient(90deg, 
            rgba(52, 211, 153, 0) 0%, 
            rgba(52, 211, 153, 0.3) 20%, 
            rgba(52, 211, 153, 0.7) 40%, 
            rgba(52, 211, 153, 0.8) 60%, 
            rgba(52, 211, 153, 0.3) 80%, 
            rgba(52, 211, 153, 0) 100%
          );
          transform: translateY(-50%);
          filter: blur(3px);
          opacity: 0.7;
          z-index: -1;
          animation: placement-trail 0.5s ease-out;
        }
        
        @keyframes placement-trail {
          0% {
            width: 0;
            opacity: 0;
            filter: blur(1px);
          }
          50% {
            opacity: 0.9;
            filter: blur(3px);
          }
          100% {
            width: 100%;
            opacity: 0;
            filter: blur(5px);
          }
        }
      `}</style>
    </div>
  );
});

export default GameContent; 