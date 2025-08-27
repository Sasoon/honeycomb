// Simple in-memory storage for local development
// In production, Netlify Blobs will be used instead

// In-memory storage objects
const dailyScores = {};
const allTimeScores = {};
const dailySeeds = {};

export const localStorage = {
  // Daily scores
  getDailyScore(key) {
    return dailyScores[key];
  },
  
  setDailyScore(key, value) {
    dailyScores[key] = value;
  },
  
  getAllDailyScores() {
    return { ...dailyScores };
  },
  
  // All-time scores
  getAllTimeScore(key) {
    return allTimeScores[key];
  },
  
  setAllTimeScore(key, value) {
    allTimeScores[key] = value;
  },
  
  getAllAllTimeScores() {
    return { ...allTimeScores };
  },
  
  // Daily seeds
  getDailySeed(key) {
    return dailySeeds[key];
  },
  
  setDailySeed(key, value) {
    dailySeeds[key] = value;
  }
};