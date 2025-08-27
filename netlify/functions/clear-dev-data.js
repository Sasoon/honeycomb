import { getStore } from '@netlify/blobs';

export const handler = async (event, context) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: 'Method not allowed' })
    };
  }

  // Only allow this endpoint to run in local development for safety
  const isLocal = !context.site?.id;
  if (!isLocal) {
    return {
      statusCode: 403,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        success: false, 
        error: 'This endpoint is only available in local development' 
      })
    };
  }

  try {
    let deletedCount = 0;

    // Clear daily leaderboard dev entries
    const dailyStore = getStore({
      name: 'leaderboard-daily',
      siteID: context.site?.id,
      consistency: 'strong'
    });

    const dailyEntries = dailyStore.list({ prefix: 'dev_' });
    for await (const { key } of dailyEntries) {
      try {
        await dailyStore.delete(key);
        deletedCount++;
        console.log(`Deleted daily entry: ${key}`);
      } catch (error) {
        console.error(`Error deleting daily entry ${key}:`, error);
      }
    }

    // Clear all-time leaderboard dev entries
    const allTimeStore = getStore({
      name: 'leaderboard-alltime',
      siteID: context.site?.id,
      consistency: 'strong'
    });

    const allTimeEntries = allTimeStore.list({ prefix: 'dev_' });
    for await (const { key } of allTimeEntries) {
      try {
        await allTimeStore.delete(key);
        deletedCount++;
        console.log(`Deleted all-time entry: ${key}`);
      } catch (error) {
        console.error(`Error deleting all-time entry ${key}:`, error);
      }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        message: `Cleared ${deletedCount} development entries from leaderboards`,
        deletedCount
      })
    };

  } catch (error) {
    console.error('Error clearing dev data:', error);
    
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: 'Failed to clear development data'
      })
    };
  }
};