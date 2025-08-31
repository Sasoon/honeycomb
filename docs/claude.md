# Blob Stores Guide - Honeycomb Tetris Leaderboard System

## Overview

The Honeycomb Tetris game uses Netlify Blob Stores to persist leaderboard data. There are separate stores for daily and all-time leaderboards, with automatic separation between local development and production environments.

## Store Structure

### Store Names
- `leaderboard-daily` - Daily challenge scores
- `leaderboard-alltime` - Best scores per player across all time

### Key Formats

#### Daily Leaderboard Keys
- **Production**: `YYYY-MM-DD_playername` (e.g., `2025-08-31_john`)  
- **Local Dev**: `dev_YYYY-MM-DD_playername` (e.g., `dev_2025-08-31_john`)

#### All-time Leaderboard Keys  
- **Production**: `playername` (e.g., `john`)
- **Local Dev**: `dev_playername` (e.g., `dev_john`)

### Data Format
```json
{
  "playerName": "john",
  "score": 150,
  "round": 8,
  "totalWords": 12,
  "longestWord": "TESTING",
  "timeSpent": 120,
  "date": "2025-08-31",
  "submittedAt": "2025-08-31T12:34:56.789Z"
}
```

## Environment Detection

### How Local vs Production is Determined
```javascript
const isLocal = !context.site?.id;
```

**Note**: When using `netlify dev`, this may return `false` if connected to a Netlify site, causing local data to be stored without the `dev_` prefix.

### Local Development Storage Location
When running `netlify dev`, blob data is stored locally at:
```
/var/www/html/honeycomb/.netlify/blobs-serve/entries/{site-id}/site:leaderboard-{daily|alltime}/
```

Example paths:
```
.netlify/blobs-serve/entries/a1b92087-b54c-4d15-8194-e44eb6c57e27/site:leaderboard-daily/2025-08-31_playername
.netlify/blobs-serve/entries/a1b92087-b54c-4d15-8194-e44eb6c57e27/site:leaderboard-alltime/playername
```

## API Endpoints

### Submit Score
**Endpoint**: `POST /.netlify/functions/submit-score`

**Payload**:
```json
{
  "playerName": "john",
  "score": 150,
  "round": 8,
  "totalWords": 12,
  "longestWord": "TESTING",
  "timeSpent": 120,
  "date": "2025-08-31"
}
```

**Response**:
```json
{
  "success": true,
  "scoreEntry": { /* score data */ },
  "dailyRank": {
    "rank": 3,
    "totalPlayers": 15
  },
  "isPersonalBest": true
}
```

### Get Leaderboard
**Endpoint**: `GET /.netlify/functions/get-leaderboard?type={daily|alltime}&limit={number}`

**Response**:
```json
{
  "success": true,
  "type": "daily",
  "date": "2025-08-31",
  "leaderboard": [
    {
      "playerName": "john",
      "score": 150,
      "rank": 1,
      // ... other fields
    }
  ],
  "totalEntries": 15
}
```

## Testing Commands

### Local Testing (netlify dev)

```bash
# Start local development
netlify dev

# Get daily leaderboard
curl -s "http://localhost:43067/.netlify/functions/get-leaderboard?type=daily" | jq '.'

# Get all-time leaderboard  
curl -s "http://localhost:43067/.netlify/functions/get-leaderboard?type=alltime" | jq '.'

# Submit a test score
curl -X POST "http://localhost:43067/.netlify/functions/submit-score" \
  -H "Content-Type: application/json" \
  -d '{
    "playerName": "testplayer",
    "score": 100,
    "round": 5,
    "totalWords": 10,
    "longestWord": "TESTING",
    "timeSpent": 60,
    "date": "2025-08-31"
  }' | jq '.'
```

### Production Testing

```bash
# Get daily leaderboard
curl -s "https://upbank-financial-dashboard.netlify.app/.netlify/functions/get-leaderboard?type=daily" | jq '.'

# Get all-time leaderboard
curl -s "https://upbank-financial-dashboard.netlify.app/.netlify/functions/get-leaderboard?type=alltime" | jq '.'

# Submit score (use with caution - this affects production data!)
curl -X POST "https://upbank-financial-dashboard.netlify.app/.netlify/functions/submit-score" \
  -H "Content-Type: application/json" \
  -d '{
    "playerName": "prodtester",
    "score": 100,
    "round": 5,
    "totalWords": 10,
    "longestWord": "TESTING",
    "timeSpent": 60,
    "date": "2025-08-31"
  }' | jq '.'
```

## Direct Blob Store Access

### Using Netlify CLI

```bash
# List all stores
netlify blobs:list

# List daily leaderboard entries
netlify blobs:list leaderboard-daily

# Get specific entry
netlify blobs:get leaderboard-daily "2025-08-31_playername"

# Delete entry (use with caution!)
netlify blobs:delete leaderboard-daily "2025-08-31_playername"
```

### Local Blob Store Inspection

```bash
# List local daily entries for today
ls -la "/path/to/project/.netlify/blobs-serve/entries/{site-id}/site:leaderboard-daily/" | grep "$(date +%Y-%m-%d)"

# Read local entry content
cat "/path/to/project/.netlify/blobs-serve/entries/{site-id}/site:leaderboard-daily/2025-08-31_playername" | jq '.'

# Count total local entries for today
ls "/path/to/project/.netlify/blobs-serve/entries/{site-id}/site:leaderboard-daily/" | grep "$(date +%Y-%m-%d)" | wc -l

# Get all scores sorted (for debugging ranking)
for file in /path/to/project/.netlify/blobs-serve/entries/{site-id}/site:leaderboard-daily/$(date +%Y-%m-%d)_*; do 
  cat "$file" | jq -r '.score'
done | sort -rn
```

## Common Issues & Debugging

### Issue 1: Incorrect Player Count in Rankings
**Symptom**: Ranking shows "#3 of 2 players" when there are more players
**Cause**: Bug in score filtering that excluded players with score 0
**Fix**: Changed `scoreData.score` to `scoreData.score !== undefined` in submit-score.js

### Issue 2: Local Data Mixing with Production
**Symptom**: Local testing affects production leaderboard
**Cause**: `isLocal` detection not working properly with `netlify dev`
**Solution**: Use more robust local detection:
```javascript
const isLocal = request.url.includes('localhost') || !context.site?.id;
```

### Issue 3: Missing Entries in Leaderboard
**Symptom**: Some submitted scores don't appear in leaderboard
**Cause**: Different prefix logic between submit and retrieve functions
**Debug**: Check both functions use consistent `isLocal` detection

### Issue 4: Duplicate Submissions
**Prevention**: Each player can only have one entry per day due to key structure
**Behavior**: New submissions overwrite previous ones if score is better

## Data Maintenance

### Clear Local Development Data
```bash
# Delete all local daily entries
rm -f "/path/to/project/.netlify/blobs-serve/entries/{site-id}/site:leaderboard-daily/dev_*"

# Or use the clear function if available
curl -X POST "http://localhost:43067/.netlify/functions/clear-dev-data"
```

### Backup Production Data
```bash
# Export all daily entries to JSON
netlify blobs:list leaderboard-daily --json > daily-backup-$(date +%Y%m%d).json

# Export all-time entries  
netlify blobs:list leaderboard-alltime --json > alltime-backup-$(date +%Y%m%d).json
```

## Ranking Algorithm

### How Rankings are Calculated
1. Fetch all scores for the date
2. Filter valid entries: `scoreData.score !== undefined`
3. Sort scores in descending order
4. Count scores better than player's score
5. Rank = (better scores count) + 1

### Example Ranking
Scores: [100, 90, 90, 50, 0, 0]
- Player with 100: Rank #1 (0 better scores)
- Player with 90: Rank #2 (1 better score) 
- Player with 50: Rank #4 (3 better scores)
- Player with 0: Rank #6 (5 better scores)

### Tied Scores
Players with identical scores get the best possible rank for that score level.

## Security Considerations

- Player names are sanitized to prevent injection
- Score validation prevents impossible values
- Only today's date submissions are accepted for daily challenges
- Local development data is isolated from production

## Performance Notes

- Daily leaderboard API cached for 5 seconds
- All-time leaderboard API cached for 10 seconds  
- Blob store pagination handles large datasets
- Invalid entries are skipped gracefully

This system provides robust, scalable leaderboard functionality with proper development/production separation and comprehensive debugging capabilities.