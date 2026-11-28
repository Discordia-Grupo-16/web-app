import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AppLayout } from './AppLayout';

vi.mock('@/features/servers', () => ({
    CurrentServerProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
    ServerSidebar: () => <nav>servidores</nav>,
}));
vi.mock('./ServerPanel', () => ({ ServerPanel: () => <aside>panel</aside> }));
vi.mock('@/features/profile', () => ({ UserProfileSection: () => <div>perfil</div> }));
vi.mock('@/features/voice', () => ({ VoiceBar: () => <div>barra de voz</div> }));
vi.mock('./ProfileViewerProvider', () => ({
    ProfileViewerProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

describe('AppLayout', () => {
    // jsdom has no layout, so the width itself cannot be measured: this pins the classes that
    // keep the voice bar from widening the left column past the panel (w-60).
    it('lets the voice bar take the width of the column without adding any to it', () => {
        render(
            <MemoryRouter>
                <AppLayout />
            </MemoryRouter>,
        );

        const bottom = screen.getByText('barra de voz').parentElement as HTMLElement;
        expect(bottom).toContainElement(screen.getByText('perfil'));
        expect(bottom).toHaveClass('w-0', 'min-w-full');
        expect(bottom).not.toHaveClass('w-full');
    });
});
