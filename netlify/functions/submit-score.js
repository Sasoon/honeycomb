import { getStore } from '@netlify/blobs';

export default async function handler(request, context) {
  try {
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ success: false, error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    let parsed;
    try {
      parsed = await request.json();
    } catch {
      return new Response(JSON.stringify({ success: false, error: 'Invalid JSON body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { playerName, score, round, totalWords, longestWord, timeSpent, date } = parsed;

    // Validate required fields
    if (!playerName || score === undefined || !round || !date) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing required fields: playerName, score, round, date'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Sanitize player name
    const sanitizedName = sanitizePlayerName(playerName);
    if (!sanitizedName) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid player name' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Date validation: allow both UTC and local YYYY-MM-DD
    const now = new Date();
    const utcToday = now.toISOString().split('T')[0];
    const localToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const isToday = date === utcToday || date === localToday;

    if (!isToday) {
      return new Response(JSON.stringify({ success: false, error: 'Can only submit scores for today\'s challenge' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Basic score validation (relaxed upper bound)
    const numericScore = parseInt(score);
    const numericRound = parseInt(round);
    if (numericScore < 0 || numericScore > 1000000 || numericRound < 1 || numericRound > 100) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid score or round values' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const isLocal = !context.site?.id;
    const timestamp = new Date().toISOString();

    // Add dev_ prefix for local development to keep test data separate
    const keyPrefix = isLocal ? 'dev_' : '';
    const playerKey = `${keyPrefix}${date}_${sanitizedName}`;
    const allTimeKey = `${keyPrefix}${sanitizedName}`;

    const scoreEntry = {
      playerName: sanitizedName,
      score: numericScore,
      round: numericRound,
      totalWords: parseInt(totalWords) || 0,
      longestWord: longestWord || '',
      timeSpent: parseInt(timeSpent) || 0,
      date: date,
      submittedAt: timestamp
    };

    // Use runtime-injected site context for blobs
    const dailyStore = getStore('leaderboard-daily');

    let existingScore;
    try {
      existingScore = await dailyStore.get(playerKey, { type: 'json', consistency: 'strong' });
    } catch {
      // No existing score, which is fine
    }

    // Only update if new score is better
    if (existingScore && existingScore.score >= scoreEntry.score) {
      return new Response(JSON.stringify({
        success: true,
        message: 'Score not improved',
        existingScore: existingScore.score,
        newScore: scoreEntry.score
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Save to daily leaderboard
    await dailyStore.set(playerKey, JSON.stringify(scoreEntry));

    // Update all-time leaderboard if this is a new personal best
    const allTimeStore = getStore('leaderboard-alltime');

    let allTimeBest;
    try {
      allTimeBest = await allTimeStore.get(allTimeKey, { type: 'json', consistency: 'strong' });
    } catch {
      // No existing all-time score
    }

    let isPersonalBest = false;
    if (!allTimeBest || scoreEntry.score > allTimeBest.score) {
      await allTimeStore.set(allTimeKey, JSON.stringify(scoreEntry));
      isPersonalBest = true;
    }

    // Update strongly-consistent daily index and compute player's rank from it
    await updateDailyIndex({ isLocal, date, entry: scoreEntry });

    // Also update strongly-consistent all-time index
    await updateAllTimeIndex({ isLocal, entry: scoreEntry });

    // Get player's rank in daily leaderboard (reads the index with strong consistency)
    const dailyRank = await getDailyRank(isLocal, date, scoreEntry.score);

    return new Response(JSON.stringify({
      success: true,
      scoreEntry,
      dailyRank,
      isPersonalBest
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in submit-score function:', error);

    return new Response(JSON.stringify({ success: false, error: 'Failed to submit score' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

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
async function updateDailyIndex({ isLocal, date, entry }) {
  const keyPrefix = isLocal ? 'dev_' : '';
  const indexKey = `${keyPrefix}${date}`;
  const indexStore = getStore('leaderboard-daily-index');

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
async function updateAllTimeIndex({ isLocal, entry }) {
  const keyPrefix = isLocal ? 'dev_' : '';
  const indexKey = `${keyPrefix}all`;
  const indexStore = getStore('leaderboard-alltime-index');

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
async function getDailyRank(isLocal, date, playerScore) {
  try {
    const keyPrefix = isLocal ? 'dev_' : '';
    const store = getStore('leaderboard-daily-index');
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