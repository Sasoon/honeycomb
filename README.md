# WAXLE

A falling tile word game with letter blocks. Form words to clear tiles from the board in this fast-paced puzzle variant.

## Features

- Falling tiles with letter blocks
- Form words to clear tiles and score points  
- Flood mechanics with cascading tile placement
- Mobile-responsive design with touch controls
- Orbit mechanic for rotating tiles around a pivot
- Lock mode to prevent tiles from moving
- Progressive difficulty with increasing tile counts

## Getting Started

### Prerequisites

- Node.js (14.x or later)
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/waxle.git
cd waxle

# Install dependencies
npm install
# or
yarn

# Start the development server
npm run dev
# or
yarn dev
```

## How to Play

1. **Placement Phase**: Add up to 2 letter tiles to the grid
2. **Word Formation Phase**: Trace a path to form a word (3+ letters)
3. Score points based on word length and bonuses
4. Reach 100 points in the fewest turns to win!

## Technologies Used

- React.js
- TypeScript
- Tailwind CSS
- Zustand for state management

### Game Concept
*Honeycomb* is a single-player word-building puzzle game played on a grid of interlocking hexagonal tiles, like a waxle shape. Players strategically place letter tiles to form words along connected paths, leveraging special tiles and mechanics to maximize their score while aiming to reach a target score in the fewest turns possible.

### Core Components
- **Grid**: A waxle-shaped hexagonal grid with 19 interlocked hexagons arranged in a natural waxle pattern, with the middle row containing 5 hexagons and rows above and below having fewer hexagons (creating the tapered waxle shape).
- **Letter Tiles**: 100 tiles, distributed by frequency:
    - 61 common
    - 26 medium
    - 9 uncommon
    - 4 rare
- **Player's Hand**: Maintained at 5 letter tiles, refilled from the bag after each turn if tiles remain.
- **Starting Setup**: Begins with a small cluster of 3–5 pre-placed tiles on the grid for immediate engagement.

### Gameplay Loop
1. **Placement Phase**: Place 2 letter tiles from your hand onto empty hexes, each adjacent to at least one existing tile. No valid word is required during placement.
2. **Scoring Phase**: Trace a connected path through tiles to form a single word. Each unique word (defined by its exact path) can be scored **only once per game**.
3. **Draw Phase**: Draw tiles to maintain a hand of 5, if tiles are available.

### Important Clarification
- **Tile Placement**: Players can place tiles freely without forming valid words.
- **Word Scoring**: Valid words are required only during the scoring phase, with each unique path scored once.

### Word Formation Rules
- Words must be at least 3 letters long.
- Must follow a connected path through adjacent hexes.
- No tile can be reused within the same word.
- Words must be in the English dictionary.
- Only one word can be scored per turn.

### Special Mechanics
- **Jump Tiles**: Earned after using 3 rare letters; allows skipping one tile in a word path during scoring, acting as a bridge.
- **Wild Tiles**: Earned by completing hexes; can overwrite an existing tile with any letter, keeping the grid dynamic.
- **Burn System**: Burn a tile to draw a new one.
- **Double Score Tiles**: Two special hexes on the grid. When a word's path includes a Double Score tile, its base score (1 point per letter) is doubled for that turn. Each Double Score tile can be used only once per game, deactivating after scoring, encouraging strategic clustering toward these high-value spots.

### Density Incentives
- **Adjacency Bonus**: Letters connected to more than 2 others award +1 point when used in a word.
- **Hex Formation Bonus**: Completing a full hexagon (a tile surrounded by 6 letters) awards 5 points and generates a Wild Tile.

### Scoring
- **Base Score**: 1 point per letter in the word.
- **Double Letter Bonus**: +2 points for words with consecutive identical letters.
- **Double Score Bonus**: +1 point per letter when a Double Score tile is used.
- **End-Game Bonuses**:
    - No shuffles used: +5 points
    - Scored a 10+ letter word: +5 points

### Win Condition
The game ends when the player reaches a **preset score of 100 points**. The objective is to achieve this score in as few turns as possible, emphasizing efficiency and strategic planning.

### Additional Features
- **Daily Challenge Mode**: All players receive the same setup and compete on leaderboards.
- **Statistics Tracking**: Records words formed, average word length, high scores, and fewest turns to reach the target score.