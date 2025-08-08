// Dictionary Web Worker
// Loads the large JSON off the main thread and responds to queries

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - JSON import in worker context is supported by Vite
import words from '../lib/words_dictionary.json';

type Dictionary = Record<string, number>;

const dictionary: Dictionary = words as Dictionary;

interface BaseMessage {
    id: number;
    type: 'preload' | 'validate' | 'suggestions';
}

interface ValidateMessage extends BaseMessage {
    type: 'validate';
    word: string;
}

interface SuggestionsMessage extends BaseMessage {
    type: 'suggestions';
    prefix: string;
    limit?: number;
}

self.addEventListener('message', (event: MessageEvent<BaseMessage | ValidateMessage | SuggestionsMessage>) => {
    const msg = event.data;

    if (!msg || typeof msg !== 'object' || typeof (msg as any).type !== 'string') return;

    switch (msg.type) {
        case 'preload': {
            // Simply acknowledge readiness
            (self as unknown as Worker).postMessage({ id: msg.id, type: 'preload', ready: true });
            break;
        }
        case 'validate': {
            const { id, word } = msg as ValidateMessage;
            const normalized = (word || '').toLowerCase();
            const isValid = !!normalized && normalized.length >= 3 && (normalized in dictionary);
            (self as unknown as Worker).postMessage({ id, type: 'validate', isValid });
            break;
        }
        case 'suggestions': {
            const { id, prefix, limit = 5 } = msg as SuggestionsMessage;
            const normalizedPrefix = (prefix || '').toLowerCase();
            if (!normalizedPrefix || normalizedPrefix.length < 2) {
                (self as unknown as Worker).postMessage({ id, type: 'suggestions', suggestions: [] });
                break;
            }
            const suggestions = Object.keys(dictionary)
                .filter(w => w.startsWith(normalizedPrefix) && w.length >= 3)
                .slice(0, limit);
            (self as unknown as Worker).postMessage({ id, type: 'suggestions', suggestions });
            break;
        }
    }
}); 