import { getStore } from '@netlify/blobs';

export const handler = async (event, context) => {
  try {
    const { type = 'daily', limit = 20 } = event.queryStringParameters || {};
    
    // Validate type parameter
    if (!['daily', 'alltime'].includes(type)) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          success: false, 
          error: 'Invalid type parameter. Must be "daily" or "alltime"' 
        })
      };
    }

    const maxLimit = Math.min(parseInt(limit) || 20, 100); // Cap at 100 entries
    
    const isLocal = !context.site?.id;
    
    if (type === 'daily') {
      return await getDailyLeaderboard(isLocal, context, maxLimit);
    } else {
      return await getAllTimeLeaderboard(isLocal, context, maxLimit);
    }

  } catch (error) {
    console.error('Error in get-leaderboard function:', error);
    
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: 'Failed to fetch leaderboard'
      })
    };
  }
};

async function getDailyLeaderboard(isLocal, context, limit) {
  const today = new Date().toISOString().split('T')[0];
  const scores = [];

  try {
    const keyPrefix = isLocal ? 'dev_' : '';
    
    // Get scores from Netlify Blobs
    const siteID = context.site?.id || process.env.NETLIFY_SITE_ID;
    const store = getStore({
      name: 'leaderboard-daily',
      siteID: siteID,
      consistency: 'strong'
    });

    const entries = store.list({ prefix: `${keyPrefix}${today}_` });
    
    for await (const { key } of entries) {
        try {
          const scoreData = await store.get(key, { type: 'json' });
          if (scoreData && scoreData.score !== undefined) {
            scores.push(scoreData);
          }
        } catch (error) {
          console.error(`Error reading score entry ${key}:`, error);
          // Skip invalid entries
        }
      }
  } catch (error) {
    console.error('Error listing daily scores:', error);
  }

  // Sort by score (descending), then by submission time (ascending - earlier is better for ties)
  scores.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return new Date(a.submittedAt) - new Date(b.submittedAt);
  });

  // Add rank and limit results
  const rankedScores = scores.slice(0, limit).map((score, index) => ({
    ...score,
    rank: index + 1
  }));

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=60' // Cache for 1 minute
    },
    body: JSON.stringify({
      success: true,
      type: 'daily',
      date: today,
      leaderboard: rankedScores,
      totalEntries: scores.length
    })
  };
}

async function getAllTimeLeaderboard(isLocal, context, limit) {
  const scores = [];

  try {
    const keyPrefix = isLocal ? 'dev_' : '';
    
    // Get scores from Netlify Blobs
    const siteID = context.site?.id || process.env.NETLIFY_SITE_ID;
    const store = getStore({
      name: 'leaderboard-alltime',
      siteID: siteID,
      consistency: 'strong'
    });

    const entries = store.list({ prefix: keyPrefix });
    
    for await (const { key } of entries) {
        try {
          const scoreData = await store.get(key, { type: 'json' });
          if (scoreData && scoreData.score !== undefined) {
            scores.push(scoreData);
          }
        } catch (error) {
          console.error(`Error reading all-time score entry ${key}:`, error);
          // Skip invalid entries
        }
      }
  } catch (error) {
    console.error('Error listing all-time scores:', error);
  }

  // Sort by score (descending), then by submission time (ascending)
  scores.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return new Date(a.submittedAt) - new Date(b.submittedAt);
  });

  // Add rank and limit results
  const rankedScores = scores.slice(0, limit).map((score, index) => ({
    ...score,
    rank: index + 1
  }));

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=300' // Cache for 5 minutes
    },
    body: JSON.stringify({
      success: true,
      type: 'alltime',
      leaderboard: rankedScores,
      totalEntries: scores.length
    })
  };
}