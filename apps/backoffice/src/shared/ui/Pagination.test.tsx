import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Pagination } from './Pagination';

describe('Pagination', () => {
    it('shows the range of the current page', () => {
        render(<Pagination total={57} limit={20} offset={20} onPageChange={vi.fn()} />);

        expect(screen.getByText('Mostrando 21–40 de 57')).toBeInTheDocument();
    });

    it('caps the range at the total on the last page', () => {
        render(<Pagination total={57} limit={20} offset={40} onPageChange={vi.fn()} />);

        expect(screen.getByText('Mostrando 41–57 de 57')).toBeInTheDocument();
    });

    it('renders nothing when there are no results', () => {
        const { container } = render(<Pagination total={0} limit={20} offset={0} onPageChange={vi.fn()} />);

        expect(container).toBeEmptyDOMElement();
    });

    it('disables Anterior on the first page and Siguiente on the last one', () => {
        const { rerender } = render(<Pagination total={57} limit={20} offset={0} onPageChange={vi.fn()} />);
        expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Siguiente' })).toBeEnabled();

        rerender(<Pagination total={57} limit={20} offset={40} onPageChange={vi.fn()} />);
        expect(screen.getByRole('button', { name: 'Anterior' })).toBeEnabled();
        expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled();
    });

    it('asks for the previous and next offsets', async () => {
        const onPageChange = vi.fn();
        render(<Pagination total={57} limit={20} offset={20} onPageChange={onPageChange} />);

        await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
        await userEvent.click(screen.getByRole('button', { name: 'Anterior' }));

        expect(onPageChange).toHaveBeenNthCalledWith(1, 40);
        expect(onPageChange).toHaveBeenNthCalledWith(2, 0);
    });
});
