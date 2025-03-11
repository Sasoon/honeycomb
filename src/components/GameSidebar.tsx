import { forwardRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { TARGET_SCORE } from '../lib/gameUtils';
import GameControls from './GameControls';
import WordHistory from './WordHistory';
import { WordHistoryEntry } from '../store/activeGameStore';

interface GameSidebarProps {
  isSidebarOpen: boolean;
  score: number;
  turns: number;
  letterBagCount: number;
  currentWord: string;
  isPlacementPhase: boolean;
  wordHistory: WordHistoryEntry[];
  onScoreWord: () => void;
  onEndTurn: () => void;
  onResetWord: () => void;
  isWordValid: boolean;
  placedTilesCount: number;
  maxPlacementTiles: number;
}

const GameSidebar = forwardRef<HTMLDivElement, GameSidebarProps>(({
  isSidebarOpen,
  score,
  turns,
  letterBagCount,
  currentWord,
  isPlacementPhase,
  wordHistory,
  onScoreWord,
  onEndTurn,
  onResetWord,
  isWordValid,
  placedTilesCount,
  maxPlacementTiles
}, ref) => {
  const location = useLocation();
  
  const isActive = (path: string) => location.pathname === path;

  // CSS for sidebar
  const sidebarStyles = `
    .vertical-text {
      writing-mode: vertical-rl;
      text-orientation: mixed;
      transform: rotate(180deg);
    }
    .tooltip {
      position: relative;
    }
    .tooltip:hover:after {
      content: attr(data-tip);
      position: absolute;
      left: 100%;
      top: 50%;
      transform: translateY(-50%);
      background: rgba(0,0,0,0.8);
      color: white;
      padding: 4px 8px;
      border-radius: 4px;
      white-space: nowrap;
      font-size: 12px;
      margin-left: 8px;
      z-index: 10;
    }
  `;

  return (
    <>
      {/* Add style tag */}
      <style dangerouslySetInnerHTML={{ __html: sidebarStyles }} />
      
      <div 
        ref={ref}
        className={`game-sidebar transition-all duration-300 ease-in-out 
          ${isSidebarOpen ? 'w-64 md:w-72' : 'w-0 md:w-72'} 
          bg-white shadow-md z-30 
          ${isSidebarOpen ? 'fixed' : 'fixed md:relative'} 
          top-0 left-0 mt-16 md:mt-0
          md:sticky md:top-16 md:h-[calc(100vh-4rem)] h-[calc(100vh-4rem)] flex flex-col overflow-hidden`}
      >
        
        {/* Sidebar content - navigation on mobile, game info on desktop */}
        <div className={`${isSidebarOpen ? 'flex' : 'hidden md:flex'} flex-col h-full py-4 px-3 overflow-y-auto`}>
          {/* Mobile navigation menu - removed Menu header */}
          <div className="block md:hidden">
            <nav className="flex flex-col space-y-2">
              <Link 
                to="/" 
                className={`px-3 py-2 rounded-lg ${isActive('/') 
                  ? 'bg-honeycomb-dark text-white' 
                  : 'text-amber-800 hover:bg-amber-100'}`}
              >
                Play
              </Link>
              <Link 
                to="/daily" 
                className={`px-3 py-2 rounded-lg ${isActive('/daily') 
                  ? 'bg-honeycomb-dark text-white' 
                  : 'text-amber-800 hover:bg-amber-100'}`}
              >
                Daily
              </Link>
              <Link 
                to="/stats" 
                className={`px-3 py-2 rounded-lg ${isActive('/stats') 
                  ? 'bg-honeycomb-dark text-white' 
                  : 'text-amber-800 hover:bg-amber-100'}`}
              >
                Stats
              </Link>
              <Link 
                to="/how-to-play" 
                className={`px-3 py-2 rounded-lg ${isActive('/how-to-play') 
                  ? 'bg-honeycomb-dark text-white' 
                  : 'text-amber-800 hover:bg-amber-100'}`}
              >
                How to Play
              </Link>
            </nav>
            <div className="border-t border-amber-200 my-4"></div>
          </div>
          
          {/* Desktop game info - hide on mobile */}
          <div className="hidden md:block">
            <h1 className="text-xl font-bold text-amber-900 mb-4">Honeycomb</h1>
            
            {/* Game stats */}
            <div className="flex justify-between mb-4 md:mb-6">
              <div>
                <div className="text-sm text-gray-600">Score</div>
                <div className="text-2xl font-bold">{score} / {TARGET_SCORE}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Turn</div>
                <div className="text-2xl font-bold">{turns}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Bag</div>
                <div className="text-lg font-bold text-amber-700">{letterBagCount}</div>
              </div>
            </div>
            
            {/* Game controls */}
            <div className="mb-4">
              <GameControls
                currentScore={score}
                targetScore={TARGET_SCORE}
                currentWord={currentWord}
                turns={turns}
                onScoreWord={onScoreWord}
                onEndTurn={onEndTurn}
                onResetWord={onResetWord}
                isWordValid={isWordValid}
                isPlacementPhase={isPlacementPhase}
                placedTilesCount={placedTilesCount}
                maxPlacementTiles={maxPlacementTiles}
              />
            </div>
            
            {/* Word history */}
            <div className="mb-4 flex-grow overflow-hidden flex flex-col">
              <WordHistory wordHistory={wordHistory} />
            </div>
            
            {/* Game instructions - collapsible */}
            <div className="mt-auto">
              <details className="bg-amber-50 p-3 rounded-lg">
                <summary className="font-semibold text-amber-900 cursor-pointer">How to Play</summary>
                <ol className="list-decimal list-inside text-sm space-y-1 mt-2 pl-2">
                  <li><strong>Place Phase:</strong> Add up to {maxPlacementTiles} letter tiles to the grid</li>
                  <li><strong>Score Phase:</strong> Trace a path to form a word (3+ letters)</li>
                  <li>Score points based on word length and bonuses</li>
                  <li>Reach {TARGET_SCORE} points in the fewest turns to win!</li>
                </ol>
              </details>
            </div>
          </div>
        </div>
      </div>
    </>
  );
});

export default GameSidebar; 