export function playSound(name: string) {
    if (typeof window === 'undefined' || typeof Audio === 'undefined') return;
    const src = `/sounds/${name}.mp3`;
    // Simple cache
    const cache = (playSound as unknown as { _c?: Record<string, HTMLAudioElement> })._c || {};
    (playSound as unknown as { _c?: Record<string, HTMLAudioElement> })._c = cache;
    if (!cache[src]) {
        cache[src] = new Audio(src);
    }
    try {
        const a = cache[src];
        a.currentTime = 0;
        a.play();
    } catch {
        // ignore autoplay / gesture errors
    }
} 