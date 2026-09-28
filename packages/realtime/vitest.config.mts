import { defineConfig } from 'vitest/config';

// environment: 'node', not 'jsdom' — running without a DOM is how the suite
// proves the module stays agnostic (PLAN-SCRUM-139.md §7).
export default defineConfig({
    test: {
        environment: 'node',
        coverage: {
            provider: 'v8',
            reporter: ['text', 'html'],
        },
    },
});
