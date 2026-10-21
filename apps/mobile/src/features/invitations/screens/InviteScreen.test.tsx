import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { invitationErrorMessage } from '@discordia/core';
import { invitationsService } from '@/shared/api';
import { InviteScreen } from './InviteScreen';

const mockReplace = jest.fn();

jest.mock('@/shared/api', () => ({ invitationsService: { joinServer: jest.fn() } }));
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ code: 'abc123' }),
  useRouter: () => ({ replace: mockReplace }),
}));

describe('InviteScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('joins the server on its own and opens it', async () => {
    jest.mocked(invitationsService.joinServer).mockResolvedValue({ server_id: 'srv' } as never);
    await render(<InviteScreen />);

    expect(screen.getByText('Procesando invitación…')).toBeOnTheScreen();
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/server/srv'));
    expect(invitationsService.joinServer).toHaveBeenCalledWith('abc123');
  });

  it('explains an expired invitation and goes back to the home', async () => {
    jest.mocked(invitationsService.joinServer).mockRejectedValue({ response: { status: 410 } });
    const user = userEvent.setup();
    await render(<InviteScreen />);

    await waitFor(() => expect(screen.getByText('Invitación inválida')).toBeOnTheScreen());
    expect(screen.getByText(invitationErrorMessage(410))).toBeOnTheScreen();
    expect(mockReplace).not.toHaveBeenCalled();

    await user.press(screen.getByText('Ir al inicio'));
    expect(mockReplace).toHaveBeenCalledWith('/');
  });
});
