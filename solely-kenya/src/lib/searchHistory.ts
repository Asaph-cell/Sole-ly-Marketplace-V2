/**
 * useSearchHistory
 * Persists the user's recent search terms in localStorage.
 * Used to personalise product rankings on Home and Shop pages.
 */

const STORAGE_KEY = "solely_search_history";
const MAX_ENTRIES = 15;

/** Returns the last N saved search terms, most-recent first */
export const getSearchHistory = (): string[] => {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
        return [];
    }
};

/** Adds a new search term to the front of the list */
export const saveSearch = (term: string) => {
    const trimmed = term.trim().toLowerCase();
    if (!trimmed) return;

    const existing = getSearchHistory().filter((t) => t !== trimmed);
    const updated = [trimmed, ...existing].slice(0, MAX_ENTRIES);

    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {
        // localStorage might be unavailable (private browsing)
    }
};

/**
 * Shuffle an array in-place using Fisher-Yates.
 * Returns the same array reference for convenience.
 */
export const shuffleArray = <T>(arr: T[]): T[] => {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
};

/**
 * Rank products using search history.
 *
 * Algorithm:
 *  1. Score each product against every saved search term
 *     (name, brand, category, description each checked case-insensitively).
 *  2. Products with score > 0 go first, sorted by descending score.
 *  3. The rest are shuffled randomly each render.
 */
export const rankBySearchHistory = <T extends {
    name?: string;
    brand?: string;
    category?: string;
    description?: string;
}>(products: T[]): T[] => {
    const history = getSearchHistory();

    if (history.length === 0) {
        // No history, just shuffle everything
        return shuffleArray([...products]);
    }

    const scored = products.map((p) => {
        let score = 0;
        const fields = [p.name, p.brand, p.category, p.description]
            .filter(Boolean)
            .map((f) => f!.toLowerCase());

        history.forEach((term, idx) => {
            // Recency weight: most-recent searches count more
            const weight = MAX_ENTRIES - idx;
            fields.forEach((field) => {
                if (field.includes(term)) score += weight;
            });
        });

        return { product: p, score };
    });

    const boosted = scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score);
    const rest = shuffleArray(scored.filter((s) => s.score === 0));

    return [...boosted, ...rest].map((s) => s.product);
};
