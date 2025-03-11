import React from 'react';
import { useActiveGameStore } from '../store/activeGameStore';
import { toast } from 'react-hot-toast';

const UndoButton: React.FC = () => {
  const { canUndo, undoLastAction, lastAction } = useActiveGameStore();

  const handleUndo = () => {
    if (canUndo && lastAction) {
      undoLastAction();
      toast.success('Action undone!');
    }
  };
  
  // Only show button when there's an action that can be undone
  if (!canUndo) return null;

  return (
    <button
      onClick={handleUndo}
      className="py-1.5 px-3 bg-amber-500 hover:bg-amber-600 text-white rounded-md shadow-sm
                flex items-center justify-center transition-colors text-sm font-medium"
      aria-label="Undo last action"
    >
      {/* Simple undo icon */}
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
        <path d="M9 14L4 9L9 4"></path>
        <path d="M4 9H16C18.2091 9 20 10.7909 20 13C20 15.2091 18.2091 17 16 17H12"></path>
      </svg>
      Undo
    </button>
  );
};

export default UndoButton; 