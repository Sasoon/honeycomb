import { Button } from '../ui/Button';
import { OrbitModal } from './OrbitModal';
import { DAILY_UNDOS } from '../../lib/orbit';

const RULES: Array<{ icon: string; title: string; body: string }> = [
    {
        icon: '🔤',
        title: 'Build words.',
        body: 'Tap tiles in order, each touching the last, to spell 3+ letters. Once per word you may leap to a tile two steps away. Score = letter points, ×2 for 5–6 letters, ×3 for 7+.',
    },
    {
        icon: '🟨',
        title: 'Gold tiles',
        body: 'double any word that uses them. Two gold tiles? ×4.',
    },
    {
        icon: '🌊',
        title: 'The flood follows.',
        body: 'After every word or pass, the NEXT tiles pour in from the top. When one has nowhere to land, the run is over.',
    },
    {
        icon: '🔄',
        title: 'Spin to set up.',
        body: 'Tap one tile, then drag around it to rotate its neighbours. Your first spin each turn is free; each extra spin adds a tile to this turn’s wave.',
    },
    {
        icon: '✂️',
        title: 'Out-spell the flood.',
        body: 'A word at least as long as the NEXT row shrinks that wave by one. Waves grow as the game goes on.',
    },
];

export function HelpModal({ onClose }: { onClose: () => void }) {
    return (
        <OrbitModal onClose={onClose} labelledBy="orbit-help-title">
            <h2 id="orbit-help-title" className="text-xl font-bold text-text-primary mb-4 text-center">
                How to play
            </h2>
            <div className="space-y-3 text-sm text-text-secondary mb-4">
                {RULES.map(r => (
                    <p key={r.title} className="flex gap-2.5">
                        <span className="text-lg leading-5 shrink-0" aria-hidden="true">{r.icon}</span>
                        <span>
                            <span className="font-semibold text-text-primary">{r.title}</span> {r.body}
                        </span>
                    </p>
                ))}
            </div>
            <div className="rounded-xl bg-secondary/15 px-3 py-2 mb-4 text-xs text-text-secondary text-center">
                <span className="font-mono font-bold text-text-primary">PLANTED</span> = 10 pts × 3 (7 letters) = <span className="font-bold text-amber">30</span>
                <span className="block mt-0.5">…with one gold tile in it: <span className="font-bold text-gold">60</span></span>
            </div>
            <p className="text-xs text-text-muted text-center mb-5">
                Daily: same tiles for everyone, {DAILY_UNDOS} undos. Practice: endless undos.
                <span className="hidden md:inline"> Keys: Enter submits, Backspace drops a letter, Esc clears.</span>
            </p>
            <Button onClick={onClose} className="w-full">Let's go</Button>
        </OrbitModal>
    );
}
