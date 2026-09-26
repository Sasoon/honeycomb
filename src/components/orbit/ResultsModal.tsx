import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Share2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { OrbitModal } from './OrbitModal';
import {
    actionStrip,
    formatCountdown,
    msUntilLocalMidnight,
    type Action,
    type DailyResult,
    type StatsSummary,
} from '../../lib/orbit';

type ResultsModalProps = {
    onClose: () => void;
    mode: 'daily' | 'practice';
    gameOver: boolean;
    score: number;
    waves: number;
    wordCount: number;
    best: string;
    actionLog: Action[];
    summary: StatsSummary;
    dailyResult?: DailyResult;
    onShare: () => void;
    onPractice: () => void;
    onNewPractice: () => void;
    onSubmitScore: (name: string) => Promise<void>;
    savedName: string;
};

function Countdown() {
    const [ms, setMs] = useState(msUntilLocalMidnight);
    useEffect(() => {
        const t = window.setInterval(() => setMs(msUntilLocalMidnight()), 1000);
        return () => window.clearInterval(t);
    }, []);
    return (
        <p className="text-xs text-text-secondary">
            Next daily in <span className="font-semibold tabular-nums text-text-primary">{formatCountdown(ms)}</span>
        </p>
    );
}

function Stat({ value, label }: { value: number; label: string }) {
    return (
        <div className="flex flex-col items-center">
            <span className="text-2xl font-bold text-text-primary tabular-nums">{value}</span>
            <span className="text-[10px] leading-tight uppercase tracking-wide text-text-muted text-center">{label}</span>
        </div>
    );
}

function SubmitScore({ result, onSubmit, savedName }: {
    result: DailyResult;
    onSubmit: (name: string) => Promise<void>;
    savedName: string;
}) {
    const [name, setName] = useState(savedName);
    const [status, setStatus] = useState<'idle' | 'sending' | 'error'>('idle');
    const [error, setError] = useState('');

    if (result.submitted) {
        const { rank, total } = result.submitted;
        return (
            <p className="text-sm text-text-secondary">
                {rank ? <>Ranked <span className="font-bold text-amber">#{rank}</span>{total ? ` of ${total}` : ''} today · </> : 'Submitted · '}
                <Link to="/leaderboard" className="text-amber underline underline-offset-2">Leaderboard</Link>
            </p>
        );
    }

    const trimmed = name.trim();
    const submit = async (e: FormEvent) => {
        e.preventDefault();
        if (trimmed.length < 2 || status === 'sending') return;
        setStatus('sending');
        try {
            await onSubmit(trimmed);
            setStatus('idle');
        } catch (err) {
            // Surface the server's reason (e.g. a rejected name) when it gave one
            const msg = err instanceof Error ? err.message : '';
            setError(/failed|fetch|network|json/i.test(msg) || !msg ? "Couldn't reach the leaderboard. Try again?" : msg);
            setStatus('error');
        }
    };

    return (
        <form onSubmit={submit} className="space-y-1.5">
            <div className="flex gap-2">
                <input
                    value={name}
                    onChange={e => { setName(e.target.value); setStatus('idle'); }}
                    maxLength={20}
                    placeholder="Your name"
                    aria-label="Name for the leaderboard"
                    className="flex-1 min-w-0 h-10 px-3 rounded-xl bg-bg-secondary border border-secondary/40 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-amber/50"
                />
                <Button type="submit" variant="secondary" disabled={trimmed.length < 2 || status === 'sending'}>
                    {status === 'sending' ? 'Sending…' : 'Post score'}
                </Button>
            </div>
            {status === 'error' && (
                <p className="text-xs text-red-400">{error}</p>
            )}
        </form>
    );
}

export function ResultsModal(props: ResultsModalProps) {
    const { mode, gameOver, score, waves, wordCount, best, actionLog, summary, dailyResult } = props;
    const isDaily = mode === 'daily';
    const strip = actionStrip(actionLog);

    return (
        <OrbitModal onClose={props.onClose} labelledBy="orbit-results-title" className="text-center">
            {gameOver ? (
                <>
                    <div className="text-4xl mb-1" aria-hidden="true">🌊</div>
                    <h2 id="orbit-results-title" className="text-xl font-bold text-text-primary">
                        The board is full
                    </h2>
                    <p className="text-3xl font-bold text-amber tabular-nums mt-1">
                        {score} <span className="text-sm text-text-secondary font-medium">pts</span>
                    </p>
                    <p className="text-text-secondary text-sm mt-1">
                        {waves} {waves === 1 ? 'wave' : 'waves'} · {wordCount} {wordCount === 1 ? 'word' : 'words'}
                        {best && <> · best <span className="font-mono font-semibold text-text-primary">{best.toUpperCase()}</span></>}
                    </p>
                    {strip && (
                        <p className="text-sm leading-5 tracking-wide whitespace-pre-line mt-3" aria-label="Turn history">
                            {strip}
                        </p>
                    )}
                </>
            ) : (
                <h2 id="orbit-results-title" className="text-xl font-bold text-text-primary">Daily stats</h2>
            )}

            <div className="grid grid-cols-4 gap-2 my-5 py-4 border-y border-secondary/30">
                <Stat value={summary.played} label="Played" />
                <Stat value={summary.currentStreak} label="Streak" />
                <Stat value={summary.maxStreak} label="Max streak" />
                <Stat value={summary.best} label="Best" />
            </div>

            {isDaily && gameOver && dailyResult && dailyResult.score > 0 && (
                <div className="mb-4">
                    <SubmitScore result={dailyResult} onSubmit={props.onSubmitScore} savedName={props.savedName} />
                </div>
            )}

            <div className="flex gap-3 justify-center">
                {gameOver && (
                    <Button onClick={props.onShare} variant="secondary" className="flex-1">
                        <Share2 size={16} /> Share
                    </Button>
                )}
                {isDaily
                    ? <Button onClick={props.onPractice} className="flex-1">Practice</Button>
                    : gameOver && <Button onClick={props.onNewPractice} className="flex-1">Play again</Button>}
            </div>

            {isDaily && dailyResult && (
                <div className="mt-4"><Countdown /></div>
            )}
        </OrbitModal>
    );
}
