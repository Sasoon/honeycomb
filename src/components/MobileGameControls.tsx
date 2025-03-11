import { useState } from 'react';
import { WordHistoryEntry } from '../store/activeGameStore';
import { motion, AnimatePresence } from 'framer-motion';

type MobileGameControlsProps = {
  currentScore: number;
  targetScore: number;
  turns: number;
  letterBagCount: number;
  isPlacementPhase: boolean;
  placedTilesCount: number;
  maxPlacementTiles: number;
  wordHistory: WordHistoryEntry[];
  currentWord?: string;
  onEndPlacementPhase?: () => void;
};

const MobileGameControls = ({
  currentScore,
  targetScore,
  turns,
  letterBagCount,
  isPlacementPhase,
  placedTilesCount,
  maxPlacementTiles,
  wordHistory,
  onEndPlacementPhase
}: MobileGameControlsProps) => {
  const [activeTab, setActiveTab] = useState<'info' | 'history'>('info');
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Sort words by turn descending (most recent first)
  const sortedWords = [...wordHistory].sort((a, b) => b.turn - a.turn);
  const displayWords = sortedWords.slice(0, 5); // Show only last 5 words

  return (
    <div className="md:hidden w-full cursor-pointer">
      {/* Compact Header - Always visible */}
      <div 
        className="bg-white shadow-md border-b border-amber-100 p-4 transition-all"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex flex-wrap justify-between items-center gap-y-2">
          <div className="flex flex-wrap space-x-2 items-center">
            {/* Phase Badge with animation */}
            <AnimatePresence mode="wait">
              <motion.div 
                key={isPlacementPhase ? "placement-phase" : "scoring-phase"}
                initial={{ scale: 0.8, y: -5, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className={`rounded-full px-2 py-0.5 text-md font-medium ${
                  isPlacementPhase 
                    ? 'bg-blue-100 text-blue-800' 
                    : 'bg-green-100 text-green-800'
                }`}
              >
                {isPlacementPhase ? 'Placement' : 'Scoring'}
              </motion.div>
            </AnimatePresence>
          </div>
          
          {/* Game Stats */}
          <div className="flex flex-wrap space-x-3 text-md items-center">
            <div>
              <span className="text-gray-500">Score:</span> {currentScore}/{targetScore}
            </div>
            <div>
              <span className="text-gray-500">Turn:</span> {turns}
            </div>
            <div>
              <span className="text-gray-500">Bag:</span> {letterBagCount}
            </div>
            
            {/* Expand/Collapse Indicator */}
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              viewBox="0 0 20 20" 
              fill="currentColor" 
              className={`w-4 h-4 text-amber-700 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            >
              <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
            </svg>
          </div>
        </div>
      </div>
      
      {/* Expandable Panel */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="bg-white rounded-lg shadow-md overflow-hidden mb-2"
          >
            {/* Tabs */}
            <div className="flex border-b border-amber-100">
              <button
                className={`flex-1 py-4 text-sm font-medium ${
                  activeTab === 'info' 
                    ? 'text-amber-800 border-b-2 border-amber-500' 
                    : 'text-gray-500'
                }`}
                onClick={() => setActiveTab('info')}
              >
                Game Info
              </button>
              <button
                className={`flex-1 py-4 text-sm font-medium ${
                  activeTab === 'history' 
                    ? 'text-amber-800 border-b-2 border-amber-500' 
                    : 'text-gray-500'
                }`}
                onClick={() => setActiveTab('history')}
              >
                Word History
              </button>
            </div>
            
            {/* Tab Content */}
            <div className="p-3">
              {activeTab === 'info' ? (
                <div>
                  {/* Game Phase Info */}
                  <div className="mb-3">
                    <h3 className="text-sm font-semibold text-amber-900 mb-1">
                      {isPlacementPhase ? 'Placement Phase' : 'Scoring Phase'}
                    </h3>
                    <p className="text-xs text-gray-600">
                      {isPlacementPhase 
                        ? `Place up to ${maxPlacementTiles} letter tiles on the grid or press End Phase. You've placed ${placedTilesCount} so far.` 
                        : 'Trace a path to form a word (3+ letters). Create unique words for points.'}
                    </p>
                  </div>
                  
                  {/* End Phase Button (Only in placement phase with at least 1 tile) */}
                  {isPlacementPhase && placedTilesCount > 0 && onEndPlacementPhase && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation(); // Prevent closing the panel
                        onEndPlacementPhase();
                      }}
                      className="w-full py-2 mb-3 px-3 rounded-md font-medium 
                                bg-amber-500 hover:bg-amber-600 text-white
                                transition-colors"
                    >
                      End Placement Phase
                    </button>
                  )}
                  
                  {/* Game Progress */}
                  <div className="space-y-2">
                    <div>
                      <div className="flex justify-between text-md">
                        <span className="text-gray-600">Score Progress</span>
                        <span className="font-medium">{currentScore}/{targetScore}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                        <div className="bg-amber-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, (currentScore / targetScore) * 100)}%` }}></div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="word-history">
                  {displayWords.length === 0 ? (
                    <p className="text-gray-500 italic text-md">No words scored yet</p>
                  ) : (
                    <div className="space-y-1">
                      <div className="flex text-md font-medium text-amber-800 border-b border-amber-100 pb-1 mb-1">
                        <span className="flex-grow">Word</span>
                        <span className="w-12 text-right">Pts</span>
                        <span className="w-10 text-right">Turn</span>
                      </div>
                      
                      <div className="max-h-24 overflow-y-auto">
                        {displayWords.map((entry) => (
                          <div 
                            key={`${entry.turn}-${entry.word}`} 
                            className="flex items-center text-sm hover:bg-amber-50 rounded px-1 py-0.5"
                          >
                            <span className="flex-grow font-medium">{entry.word}</span>
                            <span className="w-12 text-right">{entry.score}</span>
                            <span className="w-10 text-right text-gray-500 text-md">{entry.turn}</span>
                          </div>
                        ))}
                      </div>
                      
                      {wordHistory.length > 5 && (
                        <p className="text-md text-center text-amber-600 mt-2">
                          + {wordHistory.length - 5} more words
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MobileGameControls; 