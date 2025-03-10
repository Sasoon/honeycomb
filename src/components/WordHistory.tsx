import React, { useState } from 'react';
import { WordHistoryEntry } from '../store/activeGameStore';

interface WordHistoryProps {
  wordHistory: WordHistoryEntry[];
  maxDisplay?: number;
}

const WordHistory: React.FC<WordHistoryProps> = ({ 
  wordHistory, 
  maxDisplay = 7  // Reduced default max display for sidebar
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const [showMore, setShowMore] = useState(false);
  
  // Sort words by turn descending (most recent first)
  const sortedWords = [...wordHistory].sort((a, b) => b.turn - a.turn);
  const displayWords = showMore ? sortedWords : sortedWords.slice(0, maxDisplay);
  
  return (
    <div className="word-history bg-amber-50 border border-amber-100 rounded-lg overflow-hidden">
      <div className="bg-amber-100 p-2 flex justify-between items-center border-b border-amber-200">
        <h3 className="font-semibold text-amber-900">Word History</h3>
        <button 
          className="w-5 h-5 rounded-full bg-amber-50 text-amber-800 font-medium flex items-center justify-center hover:bg-amber-200 text-xs"
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
          aria-label="Word history information"
        >
          ?
          {showTooltip && (
            <div className="absolute right-0 top-6 w-48 p-2 bg-white shadow-lg rounded text-xs z-10">
              Your previously scored words. Each word can only be scored once.
            </div>
          )}
        </button>
      </div>
      
      <div className="p-2">
        {displayWords.length === 0 ? (
          <p className="text-gray-500 italic text-sm">No words scored yet</p>
        ) : (
          <div className="space-y-1">
            <div className="flex text-xs font-medium text-amber-800 border-b border-amber-100 pb-1 mb-1">
              <span className="flex-grow">Word</span>
              <span className="w-12 text-right">Pts</span>
              <span className="w-10 text-right">Turn</span>
            </div>
            
            <div className="max-h-32 overflow-y-auto">
              {displayWords.map((entry, index) => (
                <div 
                  key={`${entry.turn}-${entry.word}`} 
                  className="flex items-center text-sm hover:bg-amber-100 rounded px-1 py-0.5"
                >
                  <span className="flex-grow font-medium">{entry.word}</span>
                  <span className="w-12 text-right">{entry.score}</span>
                  <span className="w-10 text-right text-gray-500 text-xs">{entry.turn}</span>
                </div>
              ))}
            </div>
            
            {wordHistory.length > maxDisplay && !showMore && (
              <button 
                className="w-full text-xs text-amber-600 hover:text-amber-800 mt-1 text-center py-1"
                onClick={() => setShowMore(true)}
              >
                Show all {wordHistory.length} words
              </button>
            )}
            
            {showMore && wordHistory.length > maxDisplay && (
              <button 
                className="w-full text-xs text-amber-600 hover:text-amber-800 mt-1 text-center py-1"
                onClick={() => setShowMore(false)}
              >
                Show less
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default WordHistory; 