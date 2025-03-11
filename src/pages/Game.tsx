import { useRef, useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import { useActiveGameStore } from '../store/activeGameStore';
import { useGameActions } from '../hooks/useGameActions';
import GameSidebar from '../components/GameSidebar';
import GameContent from '../components/GameContent';
import LetterSelectionModal from '../components/LetterSelectionModal';
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
    handleBurnWithAnimation,
    isLetterSelectionModalOpen,
    selectedCellForWild,
    closeLetterSelectionModal,
    handleWildLetterSelection,
    handleDeselectTile
  } = useGameActions();

  // Refs for sidebar and content
  const sidebarRef = useRef<HTMLDivElement>(null);
  const mainContentRef = useRef<HTMLDivElement>(null);
  const playerHandRef = useRef<HTMLDivElement>(null);

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

  // Add useEffect to handle clicking outside the player hand
  useEffect(() => {
    function handleClickOutsideHand(event: MouseEvent) {
      // Only deselect during placement phase
      if (!isPlacementPhase) return;
      
      // Skip if clicking within the player hand or if the modal is open
      if (
        (playerHandRef.current && playerHandRef.current.contains(event.target as Node)) ||
        isLetterSelectionModalOpen
      ) {
        return;
      }
      
      // Skip if clicking on the grid (we handle these separately)
      const gridElement = document.querySelector('.grid-container');
      if (gridElement && gridElement.contains(event.target as Node)) {
        return;
      }
      
      // Deselect the tile if clicking elsewhere
      handleDeselectTile();
    }
    
    // Attach the event listener
    document.addEventListener('mousedown', handleClickOutsideHand);
    return () => {
      document.removeEventListener('mousedown', handleClickOutsideHand);
    };
  }, [isPlacementPhase, isLetterSelectionModalOpen, handleDeselectTile]);

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
            playerHandRef={playerHandRef}
          />
        </div>
      </div>
      
      {/* Letter Selection Modal */}
      <LetterSelectionModal
        isOpen={isLetterSelectionModalOpen}
        onClose={closeLetterSelectionModal}
        onSelectLetter={handleWildLetterSelection}
        currentLetter={selectedCellForWild?.letter || ''}
      />
      
      <Toaster position="bottom-center" />
    </div>
  );
};

export default Game; 