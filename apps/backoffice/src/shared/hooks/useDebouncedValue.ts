import { useEffect, useState } from 'react';

// Returns `value` only after it stopped changing for `delayMs`: typing in a search box then
// triggers one request when the user pauses, not one per key.
export const useDebouncedValue = <T,>(value: T, delayMs = 300): T => {
    const [debounced, setDebounced] = useState(value);

    useEffect(() => {
        const timer = setTimeout(() => setDebounced(value), delayMs);
        return () => clearTimeout(timer);
    }, [value, delayMs]);

    return debounced;
};
