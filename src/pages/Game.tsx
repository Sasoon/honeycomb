import { useRef, useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import { useActiveGameStore } from '../store/activeGameStore';
import { useGameActions } from '../hooks/useGameActions';
import GameSidebar from '../components/GameSidebar';
import GameContent from '../components/GameContent';
import { MAX_PLACEMENT_TILES } from '../lib/gameUtils';

// Game component props
type GameProps = {
  isSidebarOpen: boolean;
  openMenu: () => void;
  closeMenu: () => void;
};

const Game = ({ isSidebarOpen, openMenu, closeMenu }: GameProps) => {
  // Get game state from store
  const {
    grid,
    gridSize,
    letterBag,
    playerHand,
    currentWord,
    score,
    turns,
    isPlacementPhase,
    placedTilesThisTurn,
    wordHistory
  } = useActiveGameStore();
  
  // Get game actions from hook
  const {
    isWordValid,
    isWordAlreadyScored,
    potentialScore,
    isDictionaryLoading,
    handleTileSelect,
    handleCellClick,
    handleEndPlacementPhase,
    handleEndTurn,
    handleResetWord,
    handleScoreWord,
    handleBurnWithAnimation
  } = useGameActions();

  // Refs for sidebar and content
  const sidebarRef = useRef<HTMLDivElement>(null);
  const mainContentRef = useRef<HTMLDivElement>(null);

  // Add useEffect to handle clicking outside the sidebar
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      // Only do this on mobile screens
      if (window.innerWidth < 768) {
        // Get the header element
        const headerElement = document.querySelector('header');
        
        // Skip if click is in the header (where the X button is)
        if (headerElement && headerElement.contains(event.target as Node)) {
          return;
        }
        
        if (
          sidebarRef.current && 
          isSidebarOpen && 
          !sidebarRef.current.contains(event.target as Node)
        ) {
          closeMenu();
        }
      }
    }

    // Attach the event listener
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      // Clean up the event listener
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isSidebarOpen, closeMenu]);

  // Implement swipe detection for mobile
  useEffect(() => {
    let touchStartX = 0;
    let touchEndX = 0;
    
    const handleTouchStart = (e: TouchEvent) => {
      touchStartX = e.touches[0].clientX;
    };
    
    const handleTouchMove = (e: TouchEvent) => {
      touchEndX = e.touches[0].clientX;
    };
    
    const handleTouchEnd = () => {
      // Swipe right to open sidebar
      if (touchEndX - touchStartX > 100 && !isSidebarOpen) {
        openMenu();
      }
      // Swipe left to close sidebar
      else if (touchStartX - touchEndX > 100 && isSidebarOpen) {
        closeMenu();
      }
    };
    
    const contentElement = mainContentRef.current;
    if (contentElement && window.innerWidth < 768) {
      contentElement.addEventListener('touchstart', handleTouchStart);
      contentElement.addEventListener('touchmove', handleTouchMove);
      contentElement.addEventListener('touchend', handleTouchEnd);
      
      return () => {
        contentElement.removeEventListener('touchstart', handleTouchStart);
        contentElement.removeEventListener('touchmove', handleTouchMove);
        contentElement.removeEventListener('touchend', handleTouchEnd);
      };
    }
  }, [isSidebarOpen, openMenu, closeMenu]);

  return (
    <div className="game-container min-h-screen bg-amber-50">
      <div className="flex flex-col md:flex-row">
        {/* Sidebar component */}
        <GameSidebar
          isSidebarOpen={isSidebarOpen}
          score={score}
          turns={turns}
          letterBagCount={letterBag.length}
          currentWord={currentWord}
          isPlacementPhase={isPlacementPhase}
          wordHistory={wordHistory}
          onScoreWord={handleScoreWord}
          onEndTurn={handleEndTurn}
          onResetWord={handleResetWord}
          isWordValid={isWordValid}
          placedTilesCount={placedTilesThisTurn.length}
          maxPlacementTiles={MAX_PLACEMENT_TILES}
          ref={sidebarRef}
        />
        
        {/* Main game content */}
        <div className="flex-1 overflow-auto">
          <GameContent
            ref={mainContentRef}
            grid={grid}
            gridSize={gridSize}
            playerHand={playerHand}
            letterBagCount={letterBag.length}
            currentWord={currentWord}
            isPlacementPhase={isPlacementPhase}
            isWordValid={isWordValid}
            isWordAlreadyScored={isWordAlreadyScored}
            potentialScore={potentialScore}
            isDictionaryLoading={isDictionaryLoading}
            placedTilesThisTurn={placedTilesThisTurn}
            score={score}
            turns={turns}
            wordHistory={wordHistory}
            onCellClick={handleCellClick}
            onTileSelect={handleTileSelect}
            onBurnTile={handleBurnWithAnimation}
            onScoreWord={handleScoreWord}
            maxPlacementTiles={MAX_PLACEMENT_TILES}
            onEndPlacementPhase={handleEndPlacementPhase}
          />
        </div>
      </div>
      <Toaster position="bottom-center" />
    </div>
  );
};

export default Game; 