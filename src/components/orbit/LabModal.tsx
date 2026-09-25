import { useState } from 'react';
import { FlaskConical } from 'lucide-react';
import { Button } from '../ui/Button';
import { OrbitModal } from './OrbitModal';
import { cn } from '../../lib/utils';
import { DEFAULT_RULES, type Rules, type Special, type WordShape } from '../../lib/orbit';

// Words available on a typical mid-game board, measured by simulation
const SHAPES: Array<{ id: WordShape; name: string; body: string; words: string }> = [
    { id: 'path', name: 'Path', body: 'Each tile touches the one before it. (Standard)', words: '~6' },
    { id: 'branch', name: 'Branch', body: 'Each tile touches any tile you’ve picked, so words can fork.', words: '~13' },
    { id: 'leap', name: 'Leap', body: 'Path, plus one hop over a single tile per word.', words: '~20' },
];

const SPECIALS: Array<{ id: Special; name: string; glyph: string; body: string }> = [
    { id: 'wild', name: 'Wild', glyph: '✱', body: 'Stands in for any letter. Worth 0 points.' },
    { id: 'bomb', name: 'Bomb', glyph: '✹', body: 'Use it in a word and its whole ring clears too.' },
    { id: 'magnet', name: 'Magnet', glyph: '⊕', body: 'Use it and every tile with the same letter is pulled off the board.' },
];

type LabModalProps = {
    initial: Rules;
    onClose: () => void;
    onStart: (rules: Rules) => void;
};

export function LabModal({ initial, onClose, onStart }: LabModalProps) {
    const [rules, setRules] = useState<Rules>(initial);
    const toggleSpecial = (id: Special) =>
        setRules(r => ({
            ...r,
            specials: r.specials.includes(id) ? r.specials.filter(x => x !== id) : [...r.specials, id],
        }));

    return (
        <OrbitModal onClose={onClose} labelledBy="orbit-lab-title">
            <h2 id="orbit-lab-title" className="text-xl font-bold text-text-primary mb-1 flex items-center justify-center gap-2">
                <FlaskConical size={20} className="text-amber" /> Lab
            </h2>
            <p className="text-xs text-text-muted text-center mb-4">
                Try rule variants in practice. The daily always plays the standard rules.
            </p>

            <h3 className="text-xs font-semibold uppercase tracking-wide text-text-secondary mb-2">Word shape</h3>
            <div className="space-y-2 mb-4" role="radiogroup" aria-label="Word shape">
                {SHAPES.map(sh => (
                    <button
                        key={sh.id}
                        role="radio"
                        aria-checked={rules.shape === sh.id}
                        onClick={() => setRules(r => ({ ...r, shape: sh.id }))}
                        className={cn(
                            'w-full text-left rounded-xl border px-3 py-2 transition-colors',
                            rules.shape === sh.id ? 'border-amber bg-amber/10' : 'border-secondary/40 hover:bg-secondary/15'
                        )}
                    >
                        <div className="flex items-baseline justify-between">
                            <span className="font-semibold text-text-primary text-sm">{sh.name}</span>
                            <span className="text-[11px] text-text-muted">{sh.words} words per board</span>
                        </div>
                        <div className="text-xs text-text-secondary">{sh.body}</div>
                    </button>
                ))}
            </div>

            <h3 className="text-xs font-semibold uppercase tracking-wide text-text-secondary mb-2">Turns</h3>
            <label className="flex gap-3 items-start rounded-xl border border-secondary/40 px-3 py-2 mb-4 cursor-pointer hover:bg-secondary/15">
                <input
                    type="checkbox"
                    checked={rules.multiWord}
                    onChange={e => setRules(r => ({ ...r, multiWord: e.target.checked }))}
                    className="mt-1 accent-[var(--amber)]"
                />
                <span>
                    <span className="font-semibold text-text-primary text-sm">Multi-word turns</span>
                    <span className="block text-xs text-text-secondary">
                        Keep playing words after the first. Each extra word adds a tile to this wave, unless it out-spells it. End turn drops the wave.
                    </span>
                </span>
            </label>

            <h3 className="text-xs font-semibold uppercase tracking-wide text-text-secondary mb-2">Special tiles</h3>
            <div className="space-y-2 mb-3">
                {SPECIALS.map(sp => (
                    <label key={sp.id} className="flex gap-3 items-start rounded-xl border border-secondary/40 px-3 py-2 cursor-pointer hover:bg-secondary/15">
                        <input
                            type="checkbox"
                            checked={rules.specials.includes(sp.id)}
                            onChange={() => toggleSpecial(sp.id)}
                            className="mt-1 accent-[var(--amber)]"
                        />
                        <span>
                            <span className="font-semibold text-text-primary text-sm">
                                <span className={cn('orbit-special-chip', `orbit-special-chip--${sp.id}`)}>{sp.glyph}</span> {sp.name}
                            </span>
                            <span className="block text-xs text-text-secondary">{sp.body}</span>
                        </span>
                    </label>
                ))}
            </div>
            <p className="text-[11px] text-text-muted mb-4">
                Looser rules clear more, so waves grow every 3 turns instead of 4 to keep runs a similar length.
            </p>

            <div className="flex gap-3">
                <Button variant="secondary" className="flex-1" onClick={() => setRules(DEFAULT_RULES)}>Standard</Button>
                <Button className="flex-[1.5]" onClick={() => onStart(rules)}>Start new game</Button>
            </div>
        </OrbitModal>
    );
}
