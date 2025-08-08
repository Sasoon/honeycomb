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
  // Refs for sidebar and content
  const sidebarRef = useRef<HTMLDivElement>(null);
  const mainContentRef = useRef<HTMLDivElement>(null);
  const playerHandRef = useRef<HTMLDivElement | null>(null);
  
  // Get game state from store via selectors to reduce re-renders
  const grid = useActiveGameStore(s => s.grid);
  const gridSize = useActiveGameStore(s => s.gridSize);
  const letterBag = useActiveGameStore(s => s.letterBag);
  const playerHand = useActiveGameStore(s => s.playerHand);
  const currentWord = useActiveGameStore(s => s.currentWord);
  const score = useActiveGameStore(s => s.score);
  const turns = useActiveGameStore(s => s.turns);
  const isPlacementPhase = useActiveGameStore(s => s.isPlacementPhase);
  const placedTilesThisTurn = useActiveGameStore(s => s.placedTilesThisTurn);
  const wordHistory = useActiveGameStore(s => s.wordHistory);
  const isPistonActive = useActiveGameStore(s => s.isPistonActive);
  const pistonSourceCell = useActiveGameStore(s => s.pistonSourceCell);
  const isGameActive = useActiveGameStore(s => s.isGameActive);
  
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
  } = useGameActions(playerHandRef);

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
      contentElement.addEventListener('touchstart', handleTouchStart, { passive: true } as AddEventListenerOptions);
      contentElement.addEventListener('touchmove', handleTouchMove, { passive: true } as AddEventListenerOptions);
      contentElement.addEventListener('touchend', handleTouchEnd, { passive: true } as AddEventListenerOptions);
      
      return () => {
        contentElement.removeEventListener('touchstart', handleTouchStart as any);
        contentElement.removeEventListener('touchmove', handleTouchMove as any);
        contentElement.removeEventListener('touchend', handleTouchEnd as any);
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
            isPistonActive={isPistonActive}
            pistonSourceCell={pistonSourceCell}
            onCellClick={handleCellClick}
            onTileSelect={handleTileSelect}
            onBurnTile={handleBurnWithAnimation}
            onScoreWord={handleScoreWord}
            maxPlacementTiles={MAX_PLACEMENT_TILES}
            onEndPlacementPhase={handleEndPlacementPhase}
            playerHandRef={playerHandRef}
            isGameActive={isGameActive}
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
      
      <Toaster 
        position="bottom-center" 
        toastOptions={{
          // Reduce duration to show toasts faster
          duration: 1000,
          // Only allow one toast at a time by using this ID
          id: 'single-toast'
        }} 
      />
    </div>
  );
};

export default Game; 