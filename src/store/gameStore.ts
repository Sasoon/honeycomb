import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { HexCell } from '../components/HexGrid';

interface GameStats {
    gamesPlayed: number;
    wordsFormed: number;
    bestWord: string;
    bestWordScore: number;
    totalScore: number;
    averageTurns: number;
    fewestTurns: number;
    lastPlayed: string;
}

interface GameRecord {
    date: string;
    score: number;
    turns: number;
    wordCount: number;
}

export interface LetterTile {
    id: string;
    letter: string;
    isSelected: boolean;
}

export interface GameState {
    // Grid state
    grid: HexCell[];
    gridSize: number;

    // Player state
    letterBag: LetterTile[];
    playerHand: LetterTile[];
    selectedHandTile: LetterTile | null;

    // Current word state
    currentWord: string;
    wordPath: HexCell[];

    // Game progress
    score: number;
    turns: number;
    isPlacementPhase: boolean;
    placedTilesThisTurn: HexCell[];
    scoredWords: Set<string>;
    reshuffleCost: number;

    // Game theme
    cursedWord: string;
    cursedWordHint: string;

    // Getters
    getIsWordValid: () => boolean;

    // Actions
    initializeGame: () => void;
    selectHandTile: (tile: LetterTile) => void;
    clickCell: (cell: HexCell) => void;
    endPlacementPhase: () => void;
    resetWord: () => void;
    scoreWord: () => void;
    reshuffle: () => void;
}

interface GameStore {
    // Player stats
    stats: GameStats;
    gameHistory: GameRecord[];

    // Actions
    updateStats: (newStats: Partial<GameStats>) => void;
    addGameRecord: (record: GameRecord) => void;
    clearHistory: () => void;
}

const useGameStore = create<GameStore>()(
    persist(
        (set) => ({
            // Initial state
            stats: {
                gamesPlayed: 0,
                wordsFormed: 0,
                bestWord: '',
                bestWordScore: 0,
                totalScore: 0,
                averageTurns: 0,
                fewestTurns: 0,
                lastPlayed: ''
            },
            gameHistory: [],

            // Actions
            updateStats: (newStats) => set((state) => ({
                stats: { ...state.stats, ...newStats }
            })),

            addGameRecord: (record) => set((state) => {
                const newHistory = [...state.gameHistory, record];

                // Update stats based on the new game
                const gamesPlayed = state.stats.gamesPlayed + 1;
                const totalScore = state.stats.totalScore + record.score;

                // Calculate new average turns
                const totalTurns = state.stats.averageTurns * state.stats.gamesPlayed + record.turns;
                const averageTurns = totalTurns / gamesPlayed;

                // Check for fewest turns
                const fewestTurns = state.stats.fewestTurns === 0
                    ? record.turns
                    : Math.min(state.stats.fewestTurns, record.turns);

                return {
                    gameHistory: newHistory,
                    stats: {
                        ...state.stats,
                        gamesPlayed,
                        wordsFormed: state.stats.wordsFormed + record.wordCount,
                        totalScore,
                        averageTurns,
                        fewestTurns,
                        lastPlayed: record.date
                    }
                };
            }),

            clearHistory: () => set({
                gameHistory: [],
                stats: {
                    gamesPlayed: 0,
                    wordsFormed: 0,
                    bestWord: '',
                    bestWordScore: 0,
                    totalScore: 0,
                    averageTurns: 0,
                    fewestTurns: 0,
                    lastPlayed: ''
                }
            })
        }),
        {
            name: 'honeycomb-storage', // unique name for localStorage
        }
    )
);

export default useGameStore; 