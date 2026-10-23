import { act, render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { invitationErrorMessage } from '@discordia/core';
import { invitationsService } from '@/shared/api';
import { InviteScreen } from './InviteScreen';

const mockReplace = jest.fn();
let mockCode: string | string[] = 'abc123';

jest.mock('@/shared/api', () => ({ invitationsService: { joinServer: jest.fn() } }));
// A new router object on every render: joining must not depend on it being stable.
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ code: mockCode }),
  useRouter: () => ({ replace: mockReplace }),
}));

describe('InviteScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCode = 'abc123';
  });

  it('joins the server on its own and opens it', async () => {
    jest.mocked(invitationsService.joinServer).mockResolvedValue({ server_id: 'srv' } as never);
    await render(<InviteScreen />);

    expect(screen.getByText('Procesando invitación…')).toBeOnTheScreen();
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/server/srv'));
    expect(invitationsService.joinServer).toHaveBeenCalledWith('abc123');
    expect(invitationsService.joinServer).toHaveBeenCalledTimes(1);
  });

  it('does not navigate when the user leaves before the join answers', async () => {
    let resolveJoin: (member: { server_id: string }) => void = () => undefined;
    jest.mocked(invitationsService.joinServer).mockReturnValue(
      new Promise((resolve) => { resolveJoin = resolve as typeof resolveJoin; }),
    );
    const { unmount } = await render(<InviteScreen />);
    expect(invitationsService.joinServer).toHaveBeenCalledTimes(1);

    await unmount();
    await act(async () => resolveJoin({ server_id: 'srv' }));

    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('does not set state when the join fails after the user left', async () => {
    let rejectJoin: (err: unknown) => void = () => undefined;
    jest.mocked(invitationsService.joinServer).mockReturnValue(
      new Promise((_resolve, reject) => { rejectJoin = reject; }),
    );
    const { unmount } = await render(<InviteScreen />);

    await unmount();
    const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    await act(async () => rejectJoin({ response: { status: 410 } }));

    expect(error).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
    error.mockRestore();
  });

  it('explains an expired invitation and goes back to the home', async () => {
    jest.mocked(invitationsService.joinServer).mockRejectedValue({ response: { status: 410 } });
    const user = userEvent.setup();
    await render(<InviteScreen />);

    await waitFor(() => expect(screen.getByText('Invitación inválida')).toBeOnTheScreen());
    expect(screen.getByText(invitationErrorMessage(410))).toBeOnTheScreen();
    expect(mockReplace).not.toHaveBeenCalled();
    // The error re-renders the screen with a new router: it must not join again.
    expect(invitationsService.joinServer).toHaveBeenCalledTimes(1);

    await user.press(screen.getByText('Ir al inicio'));
    expect(mockReplace).toHaveBeenCalledWith('/');
  });

  it.each(['..', '..%2F', 'abc%20def', 'a;b'])('does not call the backend for the invalid code %s', async (code) => {
    mockCode = code;
    const user = userEvent.setup();
    await render(<InviteScreen />);

    expect(screen.getByText('Invitación inválida')).toBeOnTheScreen();
    expect(invitationsService.joinServer).not.toHaveBeenCalled();

    await user.press(screen.getByText('Ir al inicio'));
    expect(mockReplace).toHaveBeenCalledWith('/');
  });
});
