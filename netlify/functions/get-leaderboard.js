import { getStore } from '@netlify/blobs';

// Each game keeps its own leaderboard stores, so Orbit scores never mix
// with the classic game's
const STORE_NAMES = {
  classic: {
    daily: 'leaderboard-daily',
    dailyIndex: 'leaderboard-daily-index',
    alltime: 'leaderboard-alltime',
    alltimeIndex: 'leaderboard-alltime-index',
    maxPointsPerWord: 50,
  },
  orbit: {
    daily: 'orbit-daily',
    dailyIndex: 'orbit-daily-index',
    alltime: 'orbit-alltime',
    alltimeIndex: 'orbit-alltime-index',
    // Letter values x length x gold tiles: a whole run can't average this
    maxPointsPerWord: 400,
  },
};

function storeNamesFor(game) {
  return STORE_NAMES[game] || STORE_NAMES.classic;
}

// Daily puzzles follow each player's local calendar day, so "today" is
// anywhere from UTC yesterday to UTC tomorrow depending on time zone
function isCurrentDailyDate(date) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const utcToday = Date.parse(new Date().toISOString().slice(0, 10));
  const diffDays = Math.round((Date.parse(date) - utcToday) / 86400000);
  return Math.abs(diffDays) <= 1;
}

export default async function handler(request, context) {
  try {
    const url = new URL(request.url);
    const type = url.searchParams.get('type') || 'daily';
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const stores = storeNamesFor(url.searchParams.get('game'));
    // Clients ask for their own local day; anything outside the live window
    // falls back to UTC today
    const requestedDate = url.searchParams.get('date');
    const date = isCurrentDailyDate(requestedDate) ? requestedDate : new Date().toISOString().split('T')[0];

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
      return await getDailyLeaderboard(isLocal, context, maxLimit, stores, date);
    } else {
      return await getAllTimeLeaderboard(isLocal, context, maxLimit, stores);
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

async function getDailyLeaderboard(isLocal, context, limit, stores, today) {

  try {
    const keyPrefix = isLocal ? 'dev_' : '';

    // Read from strongly-consistent daily index for instant visibility
    const indexStore = getStore({
      name: stores.dailyIndex,
      siteID: context.site?.id,
    });

    let data = await indexStore.get(`${keyPrefix}${today}`, { type: 'json', consistency: 'strong' });

    // If no index exists yet, build-on-read from raw store and persist
    if (!data || !Array.isArray(data.leaderboard)) {
      const built = await buildDailyIndex({ siteID: context.site?.id, isLocal, date: today, stores });
      if (built) data = built;
    }

    const entries = (Array.isArray(data?.leaderboard) ? data.leaderboard : []).filter(e => isPlausibleEntry(e, stores.maxPointsPerWord));

    // Sort by score (descending), then by submission time (ascending - earlier is better for ties)
    const sorted = [...entries].sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return new Date(a.submittedAt) - new Date(b.submittedAt);
    });

    // Add rank and limit results
    const rankedScores = sorted.slice(0, limit).map((score, index) => ({
      ...score,
      rank: index + 1
    }));

    return new Response(
      JSON.stringify({
        success: true,
        type: 'daily',
        date: today,
        leaderboard: rankedScores,
        totalEntries: sorted.length
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate', // No caching for real-time updates
          'CDN-Cache-Control': 'no-cache', // Netlify CDN bypass
          'Netlify-CDN-Cache-Control': 'no-cache', // Netlify-specific bypass
          'Pragma': 'no-cache',
          'Expires': '0',
          'Vary': '*' // Prevent any caching based on request parameters
        }
      }
    );
  } catch (error) {
    console.error('Error reading daily index:', error);

    // Graceful fallback
    return new Response(
      JSON.stringify({
        success: true,
        type: 'daily',
        date: today,
        leaderboard: [],
        totalEntries: 0
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'CDN-Cache-Control': 'no-cache',
          'Netlify-CDN-Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          'Expires': '0',
          'Vary': '*'
        }
      }
    );
  }
}

async function getAllTimeLeaderboard(isLocal, context, limit, stores) {
  try {
    const keyPrefix = isLocal ? 'dev_' : '';

    // Read from strongly-consistent all-time index
    const indexStore = getStore({
      name: stores.alltimeIndex,
      siteID: context.site?.id,
    });

    let data = await indexStore.get(`${keyPrefix}all`, { type: 'json', consistency: 'strong' });

    // Build-on-read if missing
    if (!data || !Array.isArray(data.leaderboard)) {
      const built = await buildAllTimeIndex({ siteID: context.site?.id, isLocal, stores });
      if (built) data = built;
    }

    const entries = (Array.isArray(data?.leaderboard) ? data.leaderboard : []).filter(e => isPlausibleEntry(e, stores.maxPointsPerWord));

    // Sort by score (descending), then by submission time (ascending)
    const sorted = [...entries].sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return new Date(a.submittedAt) - new Date(b.submittedAt);
    });

    // Add rank and limit results
    const rankedScores = sorted.slice(0, limit).map((score, index) => ({
      ...score,
      rank: index + 1
    }));

    return new Response(
      JSON.stringify({
        success: true,
        type: 'alltime',
        leaderboard: rankedScores,
        totalEntries: sorted.length
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=30'
        }
      }
    );
  } catch (error) {
    console.error('Error reading all-time index:', error);

    return new Response(
      JSON.stringify({
        success: true,
        type: 'alltime',
        leaderboard: [],
        totalEntries: 0
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=30'
        }
      }
    );
  }
}

// Hide implausible legacy/forged entries (average points per word too high)
function isPlausibleEntry(entry, maxPointsPerWord) {
  if (!entry) return false;
  return entry.score <= Math.max(entry.totalWords || 0, 1) * maxPointsPerWord;
}

async function buildDailyIndex({ siteID, isLocal, date, stores }) {
  try {
    const keyPrefix = isLocal ? 'dev_' : '';
    const rawStore = getStore({ name: stores.daily, siteID });
    const indexStore = getStore({ name: stores.dailyIndex, siteID });
    const indexKey = `${keyPrefix}${date}`;

    const itemsByPlayer = Object.create(null);
    const entries = rawStore.list({ prefix: `${keyPrefix}${date}_`, paginate: true });

    for await (const { blobs } of entries) {
      for (const { key } of blobs) {
        try {
          const scoreData = await rawStore.get(key, { type: 'json' });
          if (!scoreData || scoreData.score === undefined) continue;

          const current = itemsByPlayer[scoreData.playerName];
          if (!current || scoreData.score > current.score || (scoreData.score === current.score && new Date(scoreData.submittedAt) < new Date(current.submittedAt))) {
            itemsByPlayer[scoreData.playerName] = scoreData;
          }
        } catch { }
      }
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

    // Set only if new to avoid races with concurrent writes
    await indexStore.set(indexKey, JSON.stringify(payload), { onlyIfNew: true });

    return payload;
  } catch (e) {
    console.error('Failed to build daily index on read:', e);
    return null;
  }
}

async function buildAllTimeIndex({ siteID, isLocal, stores }) {
  try {
    const keyPrefix = isLocal ? 'dev_' : '';
    const rawStore = getStore({ name: stores.alltime, siteID });
    const indexStore = getStore({ name: stores.alltimeIndex, siteID });
    const indexKey = `${keyPrefix}all`;

    const itemsByPlayer = Object.create(null);
    const entries = rawStore.list({ prefix: keyPrefix, paginate: true });

    for await (const { blobs } of entries) {
      for (const { key } of blobs) {
        try {
          const scoreData = await rawStore.get(key, { type: 'json' });
          if (!scoreData || scoreData.score === undefined) continue;
          const current = itemsByPlayer[scoreData.playerName];
          if (!current || scoreData.score > current.score || (scoreData.score === current.score && new Date(scoreData.submittedAt) < new Date(current.submittedAt))) {
            itemsByPlayer[scoreData.playerName] = scoreData;
          }
        } catch { }
      }
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

    await indexStore.set(indexKey, JSON.stringify(payload), { onlyIfNew: true });

    return payload;
  } catch (e) {
    console.error('Failed to build all-time index on read:', e);
    return null;
  }
}