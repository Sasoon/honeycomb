import { getStore } from '@netlify/blobs';

export default async function handler(event, context) {

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: 'Method not allowed' })
    };
  }

  try {
    const { playerName, score, round, totalWords, longestWord, timeSpent, date } = JSON.parse(event.body);

    // Validate required fields
    if (!playerName || score === undefined || !round || !date) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: 'Missing required fields: playerName, score, round, date'
        })
      };
    }

    // Sanitize player name
    const sanitizedName = sanitizePlayerName(playerName);
    if (!sanitizedName) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: 'Invalid player name'
        })
      };
    }

    // Get today's date string
    const today = new Date().toISOString().split('T')[0];

    // Validate that the submission is for today's challenge
    if (date !== today) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: 'Can only submit scores for today\'s challenge'
        })
      };
    }

    // Basic score validation
    if (score < 0 || score > 10000 || round < 1 || round > 100) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: 'Invalid score or round values'
        })
      };
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

    // Initialize stores with explicit site ID - try without token first
    const siteID = context.site?.id || process.env.NETLIFY_SITE_ID || 'a1b92087-b54c-4d15-8194-e44eb6c57e27';
    console.log('Blob config - Site ID:', siteID);

    const dailyStore = getStore({
      name: 'leaderboard-daily',
      siteID: siteID,
      consistency: 'strong'
    });

    let existingScore;
    try {
      existingScore = await dailyStore.get(playerKey, { type: 'json' });
    } catch (error) {
      // No existing score, which is fine
    }

    // Only update if new score is better
    if (existingScore && existingScore.score >= scoreEntry.score) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          message: 'Score not improved',
          existingScore: existingScore.score,
          newScore: scoreEntry.score
        })
      };
    }

    // Save to daily leaderboard
    await dailyStore.set(playerKey, JSON.stringify(scoreEntry));

    // Update all-time leaderboard if this is a new personal best
    const allTimeStore = getStore({
      name: 'leaderboard-alltime',
      siteID: siteID,
      consistency: 'strong'
    });

    let allTimeBest;
    try {
      allTimeBest = await allTimeStore.get(allTimeKey, { type: 'json' });
    } catch (error) {
      // No existing all-time score
    }

    let isPersonalBest = false;
    if (!allTimeBest || scoreEntry.score > allTimeBest.score) {
      await allTimeStore.set(allTimeKey, JSON.stringify(scoreEntry));
      isPersonalBest = true;
    }

    // Update strongly-consistent daily index and compute player's rank from it
    await updateDailyIndex({ siteID, isLocal, date, entry: scoreEntry });

    // Also update strongly-consistent all-time index
    await updateAllTimeIndex({ siteID, isLocal, entry: scoreEntry });

    // Get player's rank in daily leaderboard (reads the index with strong consistency)
    const dailyRank = await getDailyRank(isLocal, date, scoreEntry.score, siteID);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        scoreEntry,
        dailyRank,
        isPersonalBest
      })
    };

  } catch (error) {
    console.error('Error in submit-score function:', error);

    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: 'Failed to submit score'
      })
    };
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

// Maintain a strongly-consistent daily index for instant reads after writes
async function updateDailyIndex({ siteID, isLocal, date, entry }) {
  const keyPrefix = isLocal ? 'dev_' : '';
  const indexKey = `${keyPrefix}${date}`;
  const indexStore = getStore({ name: 'leaderboard-daily-index', siteID });

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const existing = await indexStore.getWithMetadata(indexKey, { type: 'json', consistency: 'strong' });

      let itemsByPlayer = Object.create(null);
      if (existing && existing.data) {
        const existingEntries = Array.isArray(existing.data.leaderboard) ? existing.data.leaderboard : [];
        for (const e of existingEntries) {
          if (e && e.playerName) itemsByPlayer[e.playerName] = e;
        }
      }

      const current = itemsByPlayer[entry.playerName];
      if (!current || entry.score > current.score || (entry.score === current.score && new Date(entry.submittedAt) < new Date(current.submittedAt))) {
        itemsByPlayer[entry.playerName] = entry;
      }

      const updatedEntries = Object.values(itemsByPlayer).sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return new Date(a.submittedAt) - new Date(b.submittedAt);
      });

      const payload = {
        date,
        leaderboard: updatedEntries,
        totalEntries: updatedEntries.length,
        updatedAt: new Date().toISOString()
      };

      const setOptions = existing && existing.etag ? { onlyIfMatch: existing.etag } : { onlyIfNew: true };
      const result = await indexStore.set(indexKey, JSON.stringify(payload), setOptions);
      if (result && result.modified) return payload;

      // Brief backoff then retry on contention
      await new Promise((r) => setTimeout(r, 50));
    } catch (err) {
      // Retry on transient errors
      await new Promise((r) => setTimeout(r, 50));
    }
  }

  // Best-effort fallback write
  try {
    await indexStore.set(indexKey, JSON.stringify({
      date,
      leaderboard: [entry],
      totalEntries: 1,
      updatedAt: new Date().toISOString()
    }));
  } catch { }
}

// Maintain a strongly-consistent all-time index for instant reads after writes
async function updateAllTimeIndex({ siteID, isLocal, entry }) {
  const keyPrefix = isLocal ? 'dev_' : '';
  const indexKey = `${keyPrefix}all`;
  const indexStore = getStore({ name: 'leaderboard-alltime-index', siteID });

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const existing = await indexStore.getWithMetadata(indexKey, { type: 'json', consistency: 'strong' });

      let itemsByPlayer = Object.create(null);
      if (existing && existing.data && Array.isArray(existing.data.leaderboard)) {
        for (const e of existing.data.leaderboard) {
          if (e && e.playerName) itemsByPlayer[e.playerName] = e;
        }
      }

      const current = itemsByPlayer[entry.playerName];
      if (!current || entry.score > current.score || (entry.score === current.score && new Date(entry.submittedAt) < new Date(current.submittedAt))) {
        itemsByPlayer[entry.playerName] = entry;
      }

      const updatedEntries = Object.values(itemsByPlayer).sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return new Date(a.submittedAt) - new Date(b.submittedAt);
      });

      const payload = {
        leaderboard: updatedEntries,
        totalEntries: updatedEntries.length,
        updatedAt: new Date().toISOString()
      };

      const setOptions = existing && existing.etag ? { onlyIfMatch: existing.etag } : { onlyIfNew: true };
      const result = await indexStore.set(indexKey, JSON.stringify(payload), setOptions);
      if (result && result.modified) return payload;

      await new Promise((r) => setTimeout(r, 50));
    } catch (err) {
      await new Promise((r) => setTimeout(r, 50));
    }
  }

  // Best-effort fallback
  try {
    await indexStore.set(indexKey, JSON.stringify({
      leaderboard: [entry],
      totalEntries: 1,
      updatedAt: new Date().toISOString()
    }), { onlyIfNew: true });
  } catch { }
}

// Get player's rank in daily leaderboard
async function getDailyRank(isLocal, date, playerScore, siteId) {
  try {
    const keyPrefix = isLocal ? 'dev_' : '';
    const store = getStore({ name: 'leaderboard-daily-index', siteID: siteId });
    const data = await store.get(`${keyPrefix}${date}`, { type: 'json', consistency: 'strong' });

    if (!data || !Array.isArray(data.leaderboard) || data.leaderboard.length === 0) {
      return { rank: 1, totalPlayers: 1 };
    }

    const sorted = [...data.leaderboard].sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return new Date(a.submittedAt) - new Date(b.submittedAt);
    });

    const rank = sorted.findIndex((s) => s.score <= playerScore) + 1;

    return {
      rank: rank > 0 ? rank : 1,
      totalPlayers: sorted.length
    };
  } catch (error) {
    console.error('Error calculating daily rank:', error);
    return { rank: 1, totalPlayers: 1 };
  }
}