import { getStore } from '@netlify/blobs';
import { localStorage } from './local-storage.js';

export const handler = async (event, context) => {
  try {
    // Get today's date in YYYY-MM-DD format
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0); // Normalize to UTC midnight
    const dateString = today.toISOString().split('T')[0];
    
    let seedData;
    
    // Check if we're in local development (no siteID means local)
    const isLocal = !context.site?.id;
    
    if (isLocal) {
      // Use file-based storage for local development
      seedData = localStorage.getDailySeed(dateString);
    } else {
      // Use Netlify Blobs in production
      const store = getStore({
        name: 'daily-challenges',
        siteID: context.site.id,
        consistency: 'strong'
      });

      try {
        const existingSeed = await store.get(dateString, { type: 'json' });
        if (existingSeed) {
          seedData = existingSeed;
        }
      } catch (error) {
        // Key doesn't exist yet, we'll create it
      }
    }

    if (!seedData) {
      // Generate deterministic seed from date
      const seed = hashString(dateString);
      
      // Generate initial game state using the seed
      const gameState = generateDailyGameState(seed);
      
      seedData = {
        date: dateString,
        seed: seed,
        gameState: gameState,
        createdAt: new Date().toISOString()
      };
      
      if (isLocal) {
        // Store in local file
        localStorage.setDailySeed(dateString, seedData);
      } else {
        // Store in Netlify Blobs
        await store.set(dateString, JSON.stringify(seedData));
      }
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
      },
      body: JSON.stringify({
        success: true,
        data: seedData
      })
    };

  } catch (error) {
    console.error('Error in daily-seed function:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: false,
        error: 'Failed to generate daily seed'
      })
    };
  }
};

// Simple hash function to convert string to numeric seed
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

// Generate initial game state for daily challenge
function generateDailyGameState(seed) {
  // Create a seeded random number generator
  const rng = createSeededRNG(seed);
  
  // Letter frequency distribution (same as main game)
  const letterWeights = {
    'E': 12, 'A': 10, 'I': 9, 'O': 8, 'N': 7, 'R': 7, 'T': 7, 'L': 6, 'S': 6, 'U': 5,
    'D': 4, 'G': 3, 'B': 3, 'C': 3, 'M': 3, 'P': 3, 'F': 2, 'H': 2, 'V': 2, 'W': 2, 'Y': 2,
    'K': 1, 'J': 1, 'X': 1, 'Q': 1, 'Z': 1
  };
  
  // Generate starting letters (3 tiles in center)
  const startingLetters = [];
  for (let i = 0; i < 3; i++) {
    startingLetters.push(generateSeededLetter(rng, letterWeights));
  }
  
  // Generate first few drops for preview
  const firstDrop = [];
  const secondDrop = [];
  
  for (let i = 0; i < 3; i++) {
    firstDrop.push(generateSeededLetter(rng, letterWeights));
    secondDrop.push(generateSeededLetter(rng, letterWeights));
  }
  
  return {
    startingLetters,
    firstDrop,
    secondDrop,
    // Store the RNG state for consistent future generations
    rngState: rng.state
  };
}

// Create a seeded random number generator
function createSeededRNG(seed) {
  let state = seed;
  
  return {
    next() {
      state = (state * 1664525 + 1013904223) % (2**32);
      return state / (2**32);
    },
    get state() {
      return state;
    },
    set state(newState) {
      state = newState;
    }
  };
}

// Generate a letter using seeded randomness
function generateSeededLetter(rng, weights) {
  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
  let random = rng.next() * totalWeight;
  
  for (const [letter, weight] of Object.entries(weights)) {
    random -= weight;
    if (random <= 0) return letter;
  }
  
  return 'E'; // Fallback
}