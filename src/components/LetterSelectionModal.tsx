import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface LetterSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectLetter: (letter: string) => void;
  currentLetter: string;
}

const LetterSelectionModal = ({ 
  isOpen, 
  onClose, 
  onSelectLetter,
  currentLetter
}: LetterSelectionModalProps) => {
  const [inputLetter, setInputLetter] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  
  // Reset input when modal opens and focus the input field
  useEffect(() => {
    if (isOpen) {
      setInputLetter('');
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);
  
  // Handle clicking outside the modal
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Only take the first character and convert to uppercase
    const value = e.target.value;
    if (value.length > 0) {
      setInputLetter(value[value.length - 1].toUpperCase());
    } else {
      setInputLetter('');
    }
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputLetter && /^[A-Z]$/i.test(inputLetter)) {
      onSelectLetter(inputLetter);
      onClose();
    }
  };
  
  if (!isOpen) return null;
  
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.2 }}
            className="bg-amber-50 rounded-lg shadow-lg p-4 max-w-xs w-full mx-4"
            ref={modalRef}
          >
            <h2 className="text-lg font-bold text-amber-900 mb-3 text-center">
              Replace {currentLetter} with...
            </h2>
            
            <form onSubmit={handleSubmit} className="flex flex-col">
              <input
                ref={inputRef}
                type="text"
                value={inputLetter}
                onChange={handleInputChange}
                maxLength={1}
                className="text-center text-2xl font-bold py-3 px-4 border-2 border-amber-300 rounded-lg bg-white focus:border-amber-500 focus:outline-none"
                placeholder="A-Z"
              />
              
              <div className="flex justify-between mt-4">
                <button 
                  type="button"
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                  onClick={onClose}
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className={`px-4 py-2 rounded-md font-medium
                    ${inputLetter && /^[A-Z]$/i.test(inputLetter)
                      ? 'bg-amber-500 text-white hover:bg-amber-600' 
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}
                  disabled={!inputLetter || !/^[A-Z]$/i.test(inputLetter)}
                >
                  Confirm
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default LetterSelectionModal; 