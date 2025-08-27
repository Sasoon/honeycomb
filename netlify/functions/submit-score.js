import { getStore } from '@netlify/blobs';

export default async function handler(event, context) {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return new Response(
      JSON.stringify({ success: false, error: 'Method not allowed' }),
      {
        status: 405,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }

  try {
    const { playerName, score, round, totalWords, longestWord, timeSpent, date } = JSON.parse(event.body);
    
    // Validate required fields
    if (!playerName || score === undefined || !round || !date) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Missing required fields: playerName, score, round, date' 
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Sanitize player name
    const sanitizedName = sanitizePlayerName(playerName);
    if (!sanitizedName) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Invalid player name' 
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Get today's date string
    const today = new Date().toISOString().split('T')[0];
    
    // Validate that the submission is for today's challenge
    if (date !== today) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Can only submit scores for today\'s challenge' 
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Basic score validation
    if (score < 0 || score > 10000 || round < 1 || round > 100) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Invalid score or round values' 
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    const isLocal = !context.site?.id;
    const timestamp = new Date().toISOString();
    
    // Add dev_ prefix for local development to keep test data separate
    const keyPrefix = isLocal ? 'dev_' : '';
    const playerKey = `${keyPrefix}${date}_${sanitizedName}`;
    const allTimeKey = `${keyPrefix}${sanitizedName}`;
    
    const scoreEntry = {
      playerName: sanitizedName,
      score: parseInt(score),
      round: parseInt(round),
      totalWords: parseInt(totalWords) || 0,
      longestWord: longestWord || '',
      timeSpent: parseInt(timeSpent) || 0,
      date: date,
      submittedAt: timestamp
    };
    
    // Initialize stores - Functions v2 provides automatic configuration
    const dailyStore = getStore('leaderboard-daily');
    
    let existingScore;
    try {
      existingScore = await dailyStore.get(playerKey, { type: 'json' });
    } catch (error) {
      // No existing score, which is fine
    }

    // Only update if new score is better
    if (existingScore && existingScore.score >= scoreEntry.score) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Score not improved',
          existingScore: existingScore.score,
          newScore: scoreEntry.score
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Save to daily leaderboard
    await dailyStore.set(playerKey, JSON.stringify(scoreEntry));

    // Update all-time leaderboard if this is a new personal best
    const allTimeStore = getStore('leaderboard-alltime');
    
    let allTimeBest;
    try {
      allTimeBest = await allTimeStore.get(allTimeKey, { type: 'json' });
    } catch (error) {
      // No existing all-time score
    }

    if (!allTimeBest || scoreEntry.score > allTimeBest.score) {
      await allTimeStore.set(allTimeKey, JSON.stringify(scoreEntry));
    }

    // Get player's rank in daily leaderboard
    const dailyRank = await getDailyRank(isLocal, date, scoreEntry.score);

    return new Response(
      JSON.stringify({
        success: true,
        scoreEntry,
        dailyRank,
        isPersonalBest: !allTimeBest || scoreEntry.score > allTimeBest.score
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error in submit-score function:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Failed to submit score'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
};

// Sanitize player name
function sanitizePlayerName(name) {
  if (!name || typeof name !== 'string') return null;
  
  // Remove any potentially harmful characters, keep alphanumeric and basic punctuation
  const sanitized = name.trim()
    .replace(/[^\w\s\-_.']/g, '') // Allow letters, numbers, spaces, hyphens, underscores, periods, apostrophes
    .slice(0, 20); // Limit length
  
  return sanitized.length >= 2 ? sanitized : null;
}

// Get player's rank in daily leaderboard
async function getDailyRank(isLocal, date, playerScore) {
  try {
    const scores = [];
    const keyPrefix = isLocal ? 'dev_' : '';
    
    // Get scores from Netlify Blobs
    const store = getStore('leaderboard-daily');
    
    const entries = store.list({ prefix: `${keyPrefix}${date}_`, paginate: true });
    
    for await (const { blobs } of entries) {
      for (const { key } of blobs) {
        try {
          const scoreData = await store.get(key, { type: 'json' });
          if (scoreData && scoreData.score) {
            scores.push(scoreData.score);
          }
        } catch (error) {
          // Skip invalid entries
        }
      }
    }
    
    // Sort scores in descending order and find rank
    scores.sort((a, b) => b - a);
    const rank = scores.findIndex(score => score <= playerScore) + 1;
    
    return {
      rank,
      totalPlayers: scores.length
    };
  } catch (error) {
    console.error('Error calculating daily rank:', error);
    return { rank: 1, totalPlayers: 1 };
  }
}