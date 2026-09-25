import { getStore } from '@netlify/blobs';

// Scheduled function configuration - runs daily at 00:05 UTC
export const config = {
  schedule: "5 0 * * *"  // 5 minutes after midnight UTC
};

export default async function handler(event, context) {
  try {
    console.log('Starting daily leaderboard purge at', new Date().toISOString());
    
    // Get today's date in YYYY-MM-DD format
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0); // Normalize to UTC midnight
    const todayString = today.toISOString().split('T')[0];
    
    let deletedCount = 0;
    let checkedCount = 0;
    let errors = [];

    // Players' local days run up to a day behind UTC, so yesterday (UTC)
    // may still be live somewhere: only purge entries older than that
    const cutoffDate = new Date(Date.parse(todayString + 'T00:00:00.000Z') - 86400000);

    // Raw per-player scores and the per-day indexes the leaderboard reads
    // both age out on the same cutoff
    const storeNames = [
      'leaderboard-daily', 'leaderboard-daily-index',
      'orbit-daily', 'orbit-daily-index',
    ];

    for (const storeName of storeNames) {
      const dailyStore = getStore(storeName);
      const entries = dailyStore.list({ paginate: true });

      for await (const { blobs } of entries) {
        for (const { key } of blobs) {
          checkedCount++;
        
          try {
            // Keys are [dev_]YYYY-MM-DD_playerName (raw scores) or
            // [dev_]YYYY-MM-DD (indexes); the date is the first segment
            let dateFromKey;
            if (key.startsWith('dev_')) {
              // Extract date from dev_YYYY-MM-DD_playerName
              const parts = key.substring(4).split('_');
              dateFromKey = parts[0];
            } else {
              // Extract date from YYYY-MM-DD_playerName
              const parts = key.split('_');
              dateFromKey = parts[0];
            }
          
            // Validate date format (YYYY-MM-DD)
            if (!/^\d{4}-\d{2}-\d{2}$/.test(dateFromKey)) {
              console.warn(`Skipping key with invalid date format: ${key}`);
              continue;
            }
          
            const entryDate = new Date(dateFromKey + 'T00:00:00.000Z');
            if (entryDate < cutoffDate) {
              await dailyStore.delete(key);
              deletedCount++;
            }
          
          } catch (error) {
            const errorMsg = `Error processing entry ${key}: ${error.message}`;
            console.error(errorMsg);
            errors.push(errorMsg);
          }
        }
      }
    }

    const summary = {
      success: true,
      timestamp: new Date().toISOString(),
      todayDate: todayString,
      checkedEntries: checkedCount,
      deletedEntries: deletedCount,
      keptEntries: checkedCount - deletedCount,
      errors: errors
    };

    console.log('Daily leaderboard purge completed:', summary);

    return new Response(
      JSON.stringify(summary),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error in purge-daily-leaderboard function:', error);
    
    const errorResponse = {
      success: false,
      error: 'Failed to purge daily leaderboard',
      details: error.message,
      timestamp: new Date().toISOString()
    };

    return new Response(
      JSON.stringify(errorResponse),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}