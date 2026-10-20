import { Alert } from 'react-native';
import { render, screen, userEvent } from '@testing-library/react-native';
import { invitationsService } from '@/shared/api';
import { JoinScreen } from './JoinScreen';

const mockReplace = jest.fn();

jest.mock('@/shared/api', () => ({ invitationsService: { joinServer: jest.fn() } }));
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace }) }));

const join = async (text: string) => {
  const user = userEvent.setup();
  await render(<JoinScreen />);
  await user.type(screen.getByPlaceholderText('ej: abc123def456'), text);
  await user.press(screen.getByText('Unirme'));
};

describe('JoinScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    jest.mocked(invitationsService.joinServer).mockResolvedValue({ server_id: 'srv' } as never);
  });

  it('joins with a bare code', async () => {
    await join('abc123');
    expect(invitationsService.joinServer).toHaveBeenCalledWith('abc123');
    expect(mockReplace).toHaveBeenCalledWith('/server/srv');
  });

  it('joins with a pasted invite link', async () => {
    await join(' https://discordia.app/invite/abc123/ ');
    expect(invitationsService.joinServer).toHaveBeenCalledWith('abc123');
  });

  it('shows an error without calling the backend when there is no code in the text', async () => {
    await join('https://discordia.app/invite/');
    expect(invitationsService.joinServer).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith('Error', 'Ingresá un link o código de invitación válido.');
  });

  it('maps backend statuses to the shared invitation messages', async () => {
    jest.mocked(invitationsService.joinServer).mockRejectedValue({ response: { status: 410 } });
    await join('abc123');
    expect(Alert.alert).toHaveBeenCalledWith(
      'Error',
      'Esta invitación ya no es válida (expirada o sin usos disponibles).',
    );
  });
});
