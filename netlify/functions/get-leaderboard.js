import { getStore } from '@netlify/blobs';

export default async function handler(request, context) {
  try {
    const url = new URL(request.url);
    const type = url.searchParams.get('type') || 'daily';
    const limit = parseInt(url.searchParams.get('limit') || '20');
    
    // Validate type parameter
    if (!['daily', 'alltime'].includes(type)) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Invalid type parameter. Must be "daily" or "alltime"' 
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    const maxLimit = Math.min(limit, 100); // Cap at 100 entries
    
    const isLocal = !context.site?.id;
    
    if (type === 'daily') {
      return await getDailyLeaderboard(isLocal, context, maxLimit);
    } else {
      return await getAllTimeLeaderboard(isLocal, context, maxLimit);
    }

  } catch (error) {
    console.error('Error in get-leaderboard function:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Failed to fetch leaderboard'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
};

async function getDailyLeaderboard(isLocal, context, limit) {
  const today = new Date().toISOString().split('T')[0];
  const scores = [];

  try {
    const keyPrefix = isLocal ? 'dev_' : '';
    
    // Get scores from Netlify Blobs
    const store = getStore('leaderboard-daily');

    const entries = store.list({ prefix: `${keyPrefix}${today}_`, paginate: true });
    
    for await (const { blobs } of entries) {
      for (const { key } of blobs) {
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

  return new Response(
    JSON.stringify({
      success: true,
      type: 'daily',
      date: today,
      leaderboard: rankedScores,
      totalEntries: scores.length
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=5' // Cache for 5 seconds - fast updates after score submission
      }
    }
  );
}

async function getAllTimeLeaderboard(isLocal, context, limit) {
  const scores = [];

  try {
    const keyPrefix = isLocal ? 'dev_' : '';
    
    // Get scores from Netlify Blobs
    const store = getStore('leaderboard-alltime');

    const entries = store.list({ prefix: keyPrefix, paginate: true });
    
    for await (const { blobs } of entries) {
      for (const { key } of blobs) {
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

  return new Response(
    JSON.stringify({
      success: true,
      type: 'alltime',
      leaderboard: rankedScores,
      totalEntries: scores.length
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=10' // Cache for 10 seconds - faster updates for all-time leaderboard
      }
    }
  );
}