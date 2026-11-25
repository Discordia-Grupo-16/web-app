import { render, screen, userEvent } from '@testing-library/react-native';
import { PERMISSION_COPY, formatMutedUntil } from '@discordia/core';
import { membersService } from '@/shared/api';
import { MuteMemberDialog } from './MuteMemberDialog';

jest.useFakeTimers();
jest.mock('@/shared/api', () => ({
  membersService: { muteMember: jest.fn(), unmuteMember: jest.fn() },
}));

const FUTURE = '2099-01-01T15:30:00Z';
const PAST = '2020-01-01T15:30:00Z';

const renderDialog = async (mutedUntil: string | null) => {
  const onClose = jest.fn();
  const onChanged = jest.fn();
  const user = userEvent.setup();
  await render(
    <MuteMemberDialog
      visible
      serverId="srv"
      userId="milton"
      memberName="Milton"
      mutedUntil={mutedUntil}
      onClose={onClose}
      onChanged={onChanged}
    />,
  );
  return { onClose, onChanged, user };
};

describe('MuteMemberDialog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('with a member who is not muted', () => {
    it('warns that the member stays and offers the durations', async () => {
      await renderDialog(null);

      expect(screen.getByText(PERMISSION_COPY.muteMemberWarning('Milton'))).toBeOnTheScreen();
      for (const label of ['60 segundos', '5 minutos', '10 minutos', '1 hora', '1 día', '1 semana']) {
        expect(screen.getByText(label)).toBeOnTheScreen();
      }
    });

    it('treats a mute that already ended as no mute', async () => {
      await renderDialog(PAST);

      expect(screen.getByText(PERMISSION_COPY.muteConfirm)).toBeOnTheScreen();
      expect(screen.queryByText(PERMISSION_COPY.unmuteConfirm)).toBeNull();
    });

    it('mutes for the chosen duration and closes', async () => {
      jest.mocked(membersService.muteMember).mockResolvedValue({ user_id: 'milton', muted_until: FUTURE, muted_by: 'me' });
      const { user, onClose, onChanged } = await renderDialog(null);

      await user.press(screen.getByText('1 hora'));
      await user.press(screen.getByText(PERMISSION_COPY.muteConfirm));

      expect(membersService.muteMember).toHaveBeenCalledWith('srv', 'milton', 3600);
      expect(onChanged).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });

    it('shows the detail of the backend as it comes and stays open', async () => {
      jest.mocked(membersService.muteMember).mockRejectedValue({
        response: { data: { detail: 'No podés moderar a un miembro con jerarquía igual o superior a la tuya' } },
      });
      const { user, onClose, onChanged } = await renderDialog(null);

      await user.press(screen.getByText(PERMISSION_COPY.muteConfirm));

      expect(await screen.findByRole('alert')).toHaveTextContent(/jerarquía igual o superior/);
      expect(onChanged).not.toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();
    });

    it('falls back to its own text when the error has no detail', async () => {
      jest.mocked(membersService.muteMember).mockRejectedValue(new Error('network'));
      const { user } = await renderDialog(null);

      await user.press(screen.getByText(PERMISSION_COPY.muteConfirm));

      expect(await screen.findByRole('alert')).toHaveTextContent(PERMISSION_COPY.muteMemberError);
    });

    it('does not mute when it is dismissed', async () => {
      const { user, onClose } = await renderDialog(null);

      await user.press(screen.getByText(PERMISSION_COPY.muteCancel));

      expect(membersService.muteMember).not.toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('with a member who is muted', () => {
    it('says until when and offers to lift it, with no durations', async () => {
      await renderDialog(FUTURE);

      expect(screen.getByText(PERMISSION_COPY.mutedBadge(formatMutedUntil(FUTURE)))).toBeOnTheScreen();
      expect(screen.queryByText('1 hora')).toBeNull();
      expect(screen.getByText(PERMISSION_COPY.unmuteConfirm)).toBeOnTheScreen();
    });

    it('lifts the mute and closes', async () => {
      jest.mocked(membersService.unmuteMember).mockResolvedValue(undefined);
      const { user, onClose, onChanged } = await renderDialog(FUTURE);

      await user.press(screen.getByText(PERMISSION_COPY.unmuteConfirm));

      expect(membersService.unmuteMember).toHaveBeenCalledWith('srv', 'milton');
      expect(membersService.muteMember).not.toHaveBeenCalled();
      expect(onChanged).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });

    it('shows the detail of the backend when lifting is refused', async () => {
      jest.mocked(membersService.unmuteMember).mockRejectedValue({
        response: { data: { detail: 'No tenés permiso para levantar silencios en este servidor' } },
      });
      const { user, onChanged } = await renderDialog(FUTURE);

      await user.press(screen.getByText(PERMISSION_COPY.unmuteConfirm));

      expect(await screen.findByRole('alert')).toHaveTextContent(/No tenés permiso para levantar silencios/);
      expect(onChanged).not.toHaveBeenCalled();
    });
  });
});
