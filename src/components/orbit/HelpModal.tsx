import { Button } from '../ui/Button';
import { OrbitModal } from './OrbitModal';
import { wordPoints, DAILY_UNDOS } from '../../lib/orbit';

const RULES: Array<{ icon: string; title: string; body: string }> = [
    {
        icon: '🔤',
        title: 'Build words.',
        body: 'Tap tiles in order, each touching the last, to spell a word of 3+ letters. Longer words score far more.',
    },
    {
        icon: '🌊',
        title: 'The flood follows.',
        body: 'Every word or pass ends your turn, and the NEXT letters pour in from the top. When a letter has nowhere to land, the game is over.',
    },
    {
        icon: '🔄',
        title: 'Spin to set up.',
        body: 'Tap one tile, then drag around it to rotate its neighbours. Spins are free and never end your turn, but each one makes every later wave one tile bigger. So does passing.',
    },
    {
        icon: '✂️',
        title: 'Out-spell the flood.',
        body: 'A word at least as long as the NEXT row shrinks it by one. The minimum wave size creeps up every 4 waves.',
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
            <div className="grid grid-cols-6 gap-1 text-center mb-4" aria-label="Points by word length">
                {[3, 4, 5, 6, 7, 8].map(n => (
                    <div key={n} className="rounded-lg bg-secondary/15 py-1.5">
                        <div className="text-[10px] uppercase tracking-wide text-text-muted">{n} ltr</div>
                        <div className="text-sm font-bold text-amber tabular-nums">+{wordPoints(n)}</div>
                    </div>
                ))}
            </div>
            <p className="text-xs text-text-muted text-center mb-5">
                Daily: same letters for everyone, {DAILY_UNDOS} undos. Practice: endless undos.
                <span className="hidden md:inline"> Keys: Enter submits, Backspace drops a letter, Esc clears.</span>
            </p>
            <Button onClick={onClose} className="w-full">Let's go</Button>
        </OrbitModal>
    );
}
