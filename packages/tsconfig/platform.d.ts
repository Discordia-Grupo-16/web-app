// Globals that both the browser and React Native provide. They are declared here because the
// packages compile without lib.dom, which would also let window, document and friends through.
// Only the members the packages use: add one when it is needed, never a whole DOM type.

interface Blob {
    readonly size: number;
    readonly type: string;
}
declare var Blob: {
    prototype: Blob;
    new (parts?: unknown[], options?: { type?: string }): Blob;
};

interface File extends Blob {
    readonly name: string;
}

interface FormData {
    append(name: string, value: string | Blob, fileName?: string): void;
}
declare var FormData: {
    prototype: FormData;
    new (): FormData;
};

declare function setTimeout(handler: () => void, timeoutMs?: number): number;
declare function clearTimeout(id: number | undefined): void;

declare var console: {
    log(...args: unknown[]): void;
    warn(...args: unknown[]): void;
    error(...args: unknown[]): void;
};
