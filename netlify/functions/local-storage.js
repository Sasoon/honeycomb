// Simple file-based storage for local development
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const LOCAL_STORAGE_DIR = '.local-storage';
const DAILY_SCORES_FILE = join(LOCAL_STORAGE_DIR, 'daily-scores.json');
const ALLTIME_SCORES_FILE = join(LOCAL_STORAGE_DIR, 'alltime-scores.json');
const DAILY_SEEDS_FILE = join(LOCAL_STORAGE_DIR, 'daily-seeds.json');

// Ensure storage directory exists
if (!existsSync(LOCAL_STORAGE_DIR)) {
  mkdirSync(LOCAL_STORAGE_DIR, { recursive: true });
}

function readJsonFile(filePath) {
  try {
    if (existsSync(filePath)) {
      const data = readFileSync(filePath, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error(`Error reading ${filePath}:`, error);
  }
  return {};
}

function writeJsonFile(filePath, data) {
  try {
    writeFileSync(filePath, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error(`Error writing ${filePath}:`, error);
  }
}

export const localStorage = {
  // Daily scores
  getDailyScore(key) {
    const scores = readJsonFile(DAILY_SCORES_FILE);
    return scores[key];
  },
  
  setDailyScore(key, value) {
    const scores = readJsonFile(DAILY_SCORES_FILE);
    scores[key] = value;
    writeJsonFile(DAILY_SCORES_FILE, scores);
  },
  
  getAllDailyScores() {
    return readJsonFile(DAILY_SCORES_FILE);
  },
  
  // All-time scores
  getAllTimeScore(key) {
    const scores = readJsonFile(ALLTIME_SCORES_FILE);
    return scores[key];
  },
  
  setAllTimeScore(key, value) {
    const scores = readJsonFile(ALLTIME_SCORES_FILE);
    scores[key] = value;
    writeJsonFile(ALLTIME_SCORES_FILE, scores);
  },
  
  getAllAllTimeScores() {
    return readJsonFile(ALLTIME_SCORES_FILE);
  },
  
  // Daily seeds
  getDailySeed(key) {
    const seeds = readJsonFile(DAILY_SEEDS_FILE);
    return seeds[key];
  },
  
  setDailySeed(key, value) {
    const seeds = readJsonFile(DAILY_SEEDS_FILE);
    seeds[key] = value;
    writeJsonFile(DAILY_SEEDS_FILE, seeds);
  }
};