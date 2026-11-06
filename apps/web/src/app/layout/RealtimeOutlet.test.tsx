import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { RealtimeOutlet } from './RealtimeOutlet';

vi.mock('@discordia/core', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@discordia/core')>()),
    UnreadProvider: ({ children }: { children: ReactNode }) => children,
}));
vi.mock('@/features/chat', () => ({ RealtimeProvider: ({ children }: { children: ReactNode }) => children }));
vi.mock('@/features/voice', () => ({ VoiceProvider: ({ children }: { children: ReactNode }) => children }));
vi.mock('@/features/ownership', () => ({
    IncomingTransferBanner: () => <p>Ana te propone ser el owner de Grupo 16</p>,
}));

const renderAt = (path: string) =>
    render(
        <MemoryRouter initialEntries={[path]}>
            <Routes>
                <Route element={<RealtimeOutlet />}>
                    <Route path="/" element={<p>Lista de servidores</p>} />
                    <Route path="/invite/:code" element={<p>Invitación</p>} />
                </Route>
            </Routes>
        </MemoryRouter>,
    );

describe('RealtimeOutlet', () => {
    it.each([
        ['/', 'Lista de servidores'],
        ['/invite/abc', 'Invitación'],
    ])('shows the ownership banner above %s', (path, page) => {
        renderAt(path);

        const banner = screen.getByText('Ana te propone ser el owner de Grupo 16');
        const content = screen.getByText(page);
        expect(banner.compareDocumentPosition(content) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
});
