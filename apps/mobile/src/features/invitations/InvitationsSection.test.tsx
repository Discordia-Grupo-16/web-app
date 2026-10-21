import { Alert } from 'react-native';
import { act, render, screen, userEvent } from '@testing-library/react-native';
import type { Invitation } from '@discordia/api';
import * as Clipboard from 'expo-clipboard';
import { invitationsService } from '@/shared/api';
import { InvitationsSection } from './InvitationsSection';

jest.mock('@/shared/api', () => ({
  invitationsService: { listInvitations: jest.fn(), createInvitation: jest.fn(), revokeInvitation: jest.fn() },
}));
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn() }));
let mockWebUrl = 'https://discordia.test/';
jest.mock('@/shared/config/env', () => ({
  get WEB_URL() {
    return mockWebUrl;
  },
}));

const invitation = (code: string): Invitation => ({
  id: `inv-${code}`,
  server_id: 'srv',
  code,
  created_by: 'owner',
  expires_at: null,
  max_uses: null,
  uses: 0,
  created_at: '2026-10-01T00:00:00Z',
});

const pressAlertButton = async (text: string) => {
  const buttons = jest.mocked(Alert.alert).mock.calls.at(-1)?.[2] ?? [];
  // The handler updates state after awaiting the request: run it inside act.
  await act(async () => {
    await buttons.find(b => b.text === text)?.onPress?.();
  });
};

const openModal = async () => {
  const user = userEvent.setup();
  await render(<InvitationsSection serverId="srv" canManage />);
  await user.press(screen.getByText('Gestionar invitaciones'));
  return user;
};

describe('InvitationsSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWebUrl = 'https://discordia.test/';
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  it('is not shown to members who cannot manage invitations', async () => {
    await render(<InvitationsSection serverId="srv" canManage={false} />);
    expect(screen.queryByText('Gestionar invitaciones')).not.toBeOnTheScreen();
  });

  it('loads the active invitations when opened', async () => {
    jest.mocked(invitationsService.listInvitations).mockResolvedValue([invitation('abc123')]);
    await openModal();

    expect(invitationsService.listInvitations).toHaveBeenCalledWith('srv');
    expect(screen.getByText('abc123')).toBeOnTheScreen();
  });

  it('creates an invitation with the chosen expiry and use limit', async () => {
    jest.mocked(invitationsService.listInvitations).mockResolvedValue([]);
    jest.mocked(invitationsService.createInvitation).mockResolvedValue(invitation('new999'));
    const user = await openModal();

    await user.press(screen.getByText('24 h'));
    await user.type(screen.getByPlaceholderText('Sin límite'), '5');
    await user.press(screen.getByText('+ Nueva invitación'));

    expect(invitationsService.createInvitation).toHaveBeenCalledWith('srv', 24, 5);
    expect(screen.getByText('new999')).toBeOnTheScreen();
  });

  it('revokes an invitation once the user confirms', async () => {
    jest.mocked(invitationsService.listInvitations).mockResolvedValue([invitation('abc123')]);
    jest.mocked(invitationsService.revokeInvitation).mockResolvedValue();
    const user = await openModal();

    await user.press(screen.getByText('Revocar'));
    await pressAlertButton('Revocar');

    expect(invitationsService.revokeInvitation).toHaveBeenCalledWith('srv', 'abc123');
    expect(screen.queryByText('abc123')).not.toBeOnTheScreen();
  });

  it('shows the invite link and copies it instead of the bare code', async () => {
    jest.mocked(invitationsService.listInvitations).mockResolvedValue([invitation('abc123')]);
    const user = await openModal();

    expect(screen.getByText('https://discordia.test/invite/abc123')).toBeOnTheScreen();
    await user.press(screen.getByText('Copiar'));

    expect(Clipboard.setStringAsync).toHaveBeenCalledWith('https://discordia.test/invite/abc123');
    expect(Alert.alert).toHaveBeenCalledWith('Copiado', 'Link copiado.');
  });

  it('shows and copies only the code when the web url is not configured', async () => {
    mockWebUrl = '';
    jest.mocked(invitationsService.listInvitations).mockResolvedValue([invitation('abc123')]);
    const user = await openModal();

    expect(screen.queryByText('/invite/abc123')).not.toBeOnTheScreen();
    await user.press(screen.getByText('Copiar'));

    expect(Clipboard.setStringAsync).toHaveBeenCalledWith('abc123');
    expect(Alert.alert).toHaveBeenCalledWith('Copiado', 'Código copiado.');
  });
});
