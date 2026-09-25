// crypto.randomUUID only exists in secure contexts (https or localhost), so opening the dev
// server through http://<lan-ip>:5173 would break without the fallback.
export const newClientMessageId = (): string => {
    if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();

    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0'));
    return [hex.slice(0, 4), hex.slice(4, 6), hex.slice(6, 8), hex.slice(8, 10), hex.slice(10, 16)]
        .map((part) => part.join(''))
        .join('-');
};
