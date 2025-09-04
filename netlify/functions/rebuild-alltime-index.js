import { getStore } from '@netlify/blobs';

export default async function handler(request, context) {
    try {
        // Optional guard: in production, require an admin key if provided via env
        const isLocal = !context.site?.id;
        const adminKey = process.env.REBUILD_KEY;
        if (!isLocal && adminKey) {
            const provided = request.headers.get('x-admin-key') || new URL(request.url).searchParams.get('key');
            if (provided !== adminKey) {
                return new Response(JSON.stringify({ success: false, error: 'Forbidden' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
            }
        }

        // Build two aggregations: production and dev_
        const rawStore = getStore('leaderboard-alltime');
        const indexStore = getStore('leaderboard-alltime-index');

        const devByPlayer = Object.create(null);
        const prodByPlayer = Object.create(null);

        // List all keys (iterate pages)
        const entries = rawStore.list({ paginate: true });
        for await (const { blobs } of entries) {
            for (const { key } of blobs) {
                try {
                    const data = await rawStore.get(key, { type: 'json' });
                    if (!data || data.score === undefined || !data.playerName) continue;
                    const target = key.startsWith('dev_') ? devByPlayer : prodByPlayer;
                    const current = target[data.playerName];
                    if (!current || data.score > current.score || (data.score === current.score && new Date(data.submittedAt) < new Date(current.submittedAt))) {
                        target[data.playerName] = data;
                    }
                } catch { }
            }
        }

        const writeIndex = async (map, indexKey) => {
            const list = Object.values(map).sort((a, b) => {
                if (b.score !== a.score) return b.score - a.score;
                return new Date(a.submittedAt) - new Date(b.submittedAt);
            });
            const payload = {
                leaderboard: list,
                totalEntries: list.length,
                updatedAt: new Date().toISOString()
            };
            await indexStore.set(indexKey, JSON.stringify(payload));
            return list.length;
        };

        const prodCount = await writeIndex(prodByPlayer, 'all');
        const devCount = await writeIndex(devByPlayer, 'dev_all');

        return new Response(JSON.stringify({ success: true, imported: { prod: prodCount, dev: devCount } }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('Error rebuilding all-time index:', error);
        return new Response(JSON.stringify({ success: false, error: 'Failed to rebuild all-time index' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
} 