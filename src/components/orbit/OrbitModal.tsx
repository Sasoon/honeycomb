import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

type OrbitModalProps = {
    onClose: () => void;
    labelledBy: string;
    children: ReactNode;
    className?: string;
};

// Shared dialog shell: backdrop click, Escape and the close button all dismiss
export function OrbitModal({ onClose, labelledBy, children, className }: OrbitModalProps) {
    const panelRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.stopPropagation();
                onClose();
            }
        };
        // Capture phase so the board's own Escape handling never sees it
        window.addEventListener('keydown', onKey, true);
        return () => window.removeEventListener('keydown', onKey, true);
    }, [onClose]);

    useEffect(() => {
        const prev = document.activeElement as HTMLElement | null;
        panelRef.current?.focus();
        return () => prev?.focus?.();
    }, []);

    return (
        <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 anim-backdrop-in p-4"
            onClick={onClose}
        >
            <div
                ref={panelRef}
                tabIndex={-1}
                role="dialog"
                aria-modal="true"
                aria-labelledby={labelledBy}
                onClick={e => e.stopPropagation()}
                className={cn(
                    'relative bg-bg-primary border border-secondary/30 rounded-2xl p-6 shadow-2xl',
                    'max-w-sm w-full max-h-full overflow-y-auto anim-modal-in outline-none',
                    className
                )}
            >
                <button
                    onClick={onClose}
                    aria-label="Close"
                    className="absolute top-3 right-3 p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-secondary/20 transition-colors"
                >
                    <X size={18} />
                </button>
                {children}
            </div>
        </div>
    );
}
