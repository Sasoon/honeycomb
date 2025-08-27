// Seeded Random Number Generator for Daily Challenges
// Ensures all players get the same sequence of random events

export interface SeededRNG {
  next(): number;
  state: number;
  setState(newState: number): void;
}

// Create a seeded random number generator using Linear Congruential Generator
export function createSeededRNG(seed: number): SeededRNG {
  let state = seed;
  
  return {
    next() {
      // LCG formula: (a * state + c) mod m
      // Using same constants as backend for consistency
      state = (state * 1664525 + 1013904223) % (2**32);
      return state / (2**32);
    },
    
    get state() {
      return state;
    },
    
    setState(newState: number) {
      state = newState;
    }
  };
}

// Generate a seeded letter using the same weights as backend
export function generateSeededLetter(rng: SeededRNG, letterWeights: Record<string, number>): string {
  const totalWeight = Object.values(letterWeights).reduce((a, b) => a + b, 0);
  let random = rng.next() * totalWeight;
  
  for (const [letter, weight] of Object.entries(letterWeights)) {
    random -= weight;
    if (random <= 0) return letter;
  }
  
  return 'E'; // Fallback
}

// Seeded shuffle algorithm (Fisher-Yates)
export function seededShuffle<T>(array: T[], rng: SeededRNG): T[] {
  const shuffled = [...array];
  
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  
  return shuffled;
}

// Generate seeded integer in range [min, max)
export function seededInt(rng: SeededRNG, min: number, max: number): number {
  return Math.floor(rng.next() * (max - min)) + min;
}

// Generate seeded boolean with given probability
export function seededBoolean(rng: SeededRNG, probability: number = 0.5): boolean {
  return rng.next() < probability;
}

// Letter frequency weights (same as backend and main game)
export const LETTER_WEIGHTS = {
  // Common (70%)
  'E': 12, 'A': 10, 'I': 9, 'O': 8, 'N': 7, 'R': 7, 'T': 7, 'L': 6, 'S': 6, 'U': 5,
  // Medium (25%)
  'D': 4, 'G': 3, 'B': 3, 'C': 3, 'M': 3, 'P': 3, 'F': 2, 'H': 2, 'V': 2, 'W': 2, 'Y': 2,
  // Rare (5%)
  'K': 1, 'J': 1, 'X': 1, 'Q': 1, 'Z': 1
};

// Daily challenge specific letter generation
export function generateDailyLetters(rng: SeededRNG, count: number): string[] {
  const letters: string[] = [];
  
  for (let i = 0; i < count; i++) {
    letters.push(generateSeededLetter(rng, LETTER_WEIGHTS));
  }
  
  return letters;
}