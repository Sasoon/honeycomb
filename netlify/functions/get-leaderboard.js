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

  try {
    const keyPrefix = isLocal ? 'dev_' : '';

    // Read from strongly-consistent daily index for instant visibility
    const indexStore = getStore({
      name: 'leaderboard-daily-index',
      siteID: context.site?.id,
    });

    let data = await indexStore.get(`${keyPrefix}${today}`, { type: 'json', consistency: 'strong' });

    // If no index exists yet, build-on-read from raw store and persist
    if (!data || !Array.isArray(data.leaderboard)) {
      const built = await buildDailyIndex({ siteID: context.site?.id, isLocal, date: today });
      if (built) data = built;
    }

    const entries = Array.isArray(data?.leaderboard) ? data.leaderboard : [];

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

async function getAllTimeLeaderboard(isLocal, context, limit) {
  try {
    const keyPrefix = isLocal ? 'dev_' : '';

    // Read from strongly-consistent all-time index
    const indexStore = getStore({
      name: 'leaderboard-alltime-index',
      siteID: context.site?.id,
    });

    let data = await indexStore.get(`${keyPrefix}all`, { type: 'json', consistency: 'strong' });

    // Build-on-read if missing
    if (!data || !Array.isArray(data.leaderboard)) {
      const built = await buildAllTimeIndex({ siteID: context.site?.id, isLocal });
      if (built) data = built;
    }

    const entries = Array.isArray(data?.leaderboard) ? data.leaderboard : [];

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

async function buildDailyIndex({ siteID, isLocal, date }) {
  try {
    const keyPrefix = isLocal ? 'dev_' : '';
    const rawStore = getStore({ name: 'leaderboard-daily', siteID });
    const indexStore = getStore({ name: 'leaderboard-daily-index', siteID });
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

async function buildAllTimeIndex({ siteID, isLocal }) {
  try {
    const keyPrefix = isLocal ? 'dev_' : '';
    const rawStore = getStore({ name: 'leaderboard-alltime', siteID });
    const indexStore = getStore({ name: 'leaderboard-alltime-index', siteID });
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