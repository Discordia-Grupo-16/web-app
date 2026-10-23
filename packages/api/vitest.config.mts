import { defineConfig } from 'vitest/config';

// environment: 'node', not 'jsdom' — running without a DOM is how the suite
// proves the module stays agnostic (PLAN-SCRUM-139.md §7).
export default defineConfig({
    test: {
        environment: 'node',
        coverage: {
            provider: 'v8',
            reporter: ['text', 'html'],
            // Every source file counts, not only the ones a test imports: otherwise untested
            // modules are simply missing from the report and the percentage looks better than it is.
            include: ['src/**/*.{ts,tsx}'],
            exclude: ['src/**/*.test.{ts,tsx}', 'src/**/index.ts'],
        },
    },
});
