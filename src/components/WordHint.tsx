import { useState, useEffect } from 'react';
import wordValidator from '../lib/wordValidator';

interface WordHintProps {
  prefix: string;
}

/**
 * Word hint component that suggests valid words starting with a prefix
 */
const WordHint = ({ prefix }: WordHintProps) => {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  
  useEffect(() => {
    if (prefix && prefix.length >= 2) {
      // Get suggestions from the wordValidator - handle the Promise correctly
      const fetchSuggestions = async () => {
        try {
          const words = await wordValidator.getSuggestions(prefix);
          setSuggestions(words);
        } catch (error) {
          console.error('Error fetching word suggestions:', error);
          setSuggestions([]);
        }
      };
      
      fetchSuggestions();
    } else {
      setSuggestions([]);
    }
  }, [prefix]);
  
  if (!suggestions.length) return null;
  
  return (
    <div className="word-hint bg-white p-2 rounded shadow-md mt-2">
      <h4 className="text-sm font-medium text-gray-700 mb-1">Word Suggestions:</h4>
      <ul className="grid grid-cols-2 gap-1">
        {suggestions.map((word) => (
          <li key={word} className="text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded">
            {word}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default WordHint; 