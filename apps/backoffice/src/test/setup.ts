import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Without globals, RTL does not register its own cleanup: unmount between tests by hand.
afterEach(cleanup);
