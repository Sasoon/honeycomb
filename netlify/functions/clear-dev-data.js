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

  // Only allow this endpoint to run in local development for safety
  const isLocal = !context.site?.id;
  if (!isLocal) {
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'This endpoint is only available in local development' 
      }),
      {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }

  try {
    let deletedCount = 0;

    // Clear daily leaderboard dev entries
    const dailyStore = getStore('leaderboard-daily');

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
    const allTimeStore = getStore('leaderboard-alltime');

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

    return new Response(
      JSON.stringify({
        success: true,
        message: `Cleared ${deletedCount} development entries from leaderboards`,
        deletedCount
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error clearing dev data:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Failed to clear development data'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}