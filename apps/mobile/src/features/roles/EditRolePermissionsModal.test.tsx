import { act, fireEvent, render, screen, userEvent } from '@testing-library/react-native';
import { ADMINISTRATOR, PERMISSION_COPY, SEND_MESSAGES, VIEW_CHANNEL } from '@discordia/core';
import type { Role } from '@discordia/api';
import { rolesService } from '@/shared/api';
import { EditRolePermissionsModal } from './EditRolePermissionsModal';

jest.useFakeTimers();
jest.mock('@/shared/api', () => ({
  rolesService: { updateRolePermissions: jest.fn(), setDefaultRole: jest.fn() },
}));

const role = (permissions: number, is_default = false): Role => ({
  id: 'r1',
  server_id: 'srv',
  name: 'Moderador',
  is_default,
  permissions,
  permission_names: [],
  position: 1,
  created_at: '2026-10-01T00:00:00Z',
});

const renderModal = async (permissions: number, isDefault = false) => {
  const onUpdated = jest.fn();
  const user = userEvent.setup();
  await render(
    <EditRolePermissionsModal
      visible
      serverId="srv"
      role={role(permissions, isDefault)}
      onClose={jest.fn()}
      onUpdated={onUpdated}
    />,
  );
  return { user, onUpdated };
};

const save = () => screen.getByLabelText(PERMISSION_COPY.save);
const permission = (label: string) => screen.getByLabelText(label);

// A Switch does not react to a press: it reports through onValueChange, and its state lives in
// the `value` prop and not in accessibilityState. The act() is what flushes the re-render.
const toggle = (label: string, value: boolean) =>
  act(async () => {
    fireEvent(permission(label), 'valueChange', value);
  });

describe('EditRolePermissionsModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('turns on the permissions the role already has, and only those', async () => {
    await renderModal(VIEW_CHANNEL | SEND_MESSAGES);

    expect(permission('Ver canales')).toHaveProp('value', true);
    expect(permission('Enviar mensajes')).toHaveProp('value', true);
    expect(permission('Banear miembros')).toHaveProp('value', false);
  });

  it('sends the whole resulting list, not just what changed', async () => {
    // The endpoint replaces the permissions: sending only the new one would silently revoke
    // the rest.
    jest.mocked(rolesService.updateRolePermissions).mockResolvedValue(role(3));
    const { user } = await renderModal(VIEW_CHANNEL);

    await toggle('Enviar mensajes', true);
    await user.press(save());

    expect(rolesService.updateRolePermissions).toHaveBeenCalledWith('srv', 'r1', [
      'VIEW_CHANNEL',
      'SEND_MESSAGES',
    ]);
  });

  it('lets a permission be taken away', async () => {
    jest.mocked(rolesService.updateRolePermissions).mockResolvedValue(role(VIEW_CHANNEL));
    const { user } = await renderModal(VIEW_CHANNEL | SEND_MESSAGES);

    await toggle('Enviar mensajes', false);
    await user.press(save());

    expect(rolesService.updateRolePermissions).toHaveBeenCalledWith('srv', 'r1', ['VIEW_CHANNEL']);
  });

  it('allows leaving the role with no permission at all', async () => {
    jest.mocked(rolesService.updateRolePermissions).mockResolvedValue(role(0));
    const { user } = await renderModal(VIEW_CHANNEL);

    await toggle('Ver canales', false);
    await user.press(save());

    expect(rolesService.updateRolePermissions).toHaveBeenCalledWith('srv', 'r1', []);
  });

  it('hands the updated role back', async () => {
    const updated = role(VIEW_CHANNEL | SEND_MESSAGES);
    jest.mocked(rolesService.updateRolePermissions).mockResolvedValue(updated);
    const { user, onUpdated } = await renderModal(VIEW_CHANNEL);

    await toggle('Enviar mensajes', true);
    await user.press(save());

    expect(onUpdated).toHaveBeenCalledWith(updated);
  });

  it('does not save when nothing changed', async () => {
    // Every save publishes an event to the bus and re-resolves the permissions of every
    // member: sending one that changes nothing is pure noise.
    const { user, onUpdated } = await renderModal(VIEW_CHANNEL);

    expect(save()).toBeDisabled();
    await user.press(save());

    expect(rolesService.updateRolePermissions).not.toHaveBeenCalled();
    expect(onUpdated).not.toHaveBeenCalled();
  });

  it('warns that ADMINISTRATOR overrides the rest of the switches', async () => {
    await renderModal(VIEW_CHANNEL);
    expect(screen.queryByText(PERMISSION_COPY.administratorNotice)).not.toBeOnTheScreen();

    await toggle('Administrador', true);

    expect(screen.getByText(PERMISSION_COPY.administratorNotice)).toBeOnTheScreen();
  });

  it('shows the reason when the backend refuses', async () => {
    // The hierarchy is only known by the backend: this screen does not know which roles the
    // caller has, so it reports instead of guessing.
    jest.mocked(rolesService.updateRolePermissions).mockRejectedValue({
      response: { data: { detail: 'No podés editar un rol igual o superior al tuyo' } },
    });
    const { user, onUpdated } = await renderModal(VIEW_CHANNEL);

    await toggle('Administrador', true);
    await user.press(save());

    expect(
      await screen.findByText('No podés editar un rol igual o superior al tuyo'),
    ).toBeOnTheScreen();
    expect(onUpdated).not.toHaveBeenCalled();
  });

  it('keeps ADMINISTRATOR out of the mask it sends unless it is on', async () => {
    jest.mocked(rolesService.updateRolePermissions).mockResolvedValue(role(ADMINISTRATOR));
    const { user } = await renderModal(0);

    await toggle('Administrador', true);
    await user.press(save());

    expect(rolesService.updateRolePermissions).toHaveBeenCalledWith('srv', 'r1', [
      'ADMINISTRATOR',
    ]);
  });
});

describe('el rol por defecto (SCRUM-63)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('ofrece marcarlo cuando no lo es', async () => {
    jest.mocked(rolesService.setDefaultRole).mockResolvedValue();
    const { user, onUpdated } = await renderModal(VIEW_CHANNEL);

    await user.press(screen.getByLabelText(PERMISSION_COPY.makeDefaultRole));

    expect(rolesService.setDefaultRole).toHaveBeenCalledWith('srv', 'r1');
    expect(onUpdated).toHaveBeenCalledWith(expect.objectContaining({ is_default: true }));
  });

  it('dice que ya lo es, en vez de ofrecerlo', async () => {
    await renderModal(VIEW_CHANNEL, true);

    expect(screen.getByText(PERMISSION_COPY.isDefaultRole)).toBeOnTheScreen();
    expect(screen.queryByLabelText(PERMISSION_COPY.makeDefaultRole)).not.toBeOnTheScreen();
  });

  it('muestra el motivo cuando el backend lo rechaza', async () => {
    jest.mocked(rolesService.setDefaultRole).mockRejectedValue({
      response: {
        data: { detail: 'No podés marcar como rol por defecto uno que está en tu misma posición o por encima' },
      },
    });
    const { user, onUpdated } = await renderModal(VIEW_CHANNEL);

    await user.press(screen.getByLabelText(PERMISSION_COPY.makeDefaultRole));

    expect(await screen.findByText(/por encima/)).toBeOnTheScreen();
    expect(onUpdated).not.toHaveBeenCalled();
  });

  it('no manda a la lista los permisos que no se guardaron', async () => {
    jest.mocked(rolesService.setDefaultRole).mockResolvedValue();
    const { user, onUpdated } = await renderModal(VIEW_CHANNEL);

    await toggle('Banear miembros', true);
    await user.press(screen.getByLabelText(PERMISSION_COPY.makeDefaultRole));

    expect(onUpdated).toHaveBeenCalledWith(
      expect.objectContaining({ permissions: VIEW_CHANNEL, is_default: true }),
    );
  });
});
