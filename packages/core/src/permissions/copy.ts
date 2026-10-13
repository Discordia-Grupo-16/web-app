/**
 * The user-visible text of the permission screens, shared by web and mobile.
 *
 * It lives next to the bits for the same reason they do: the two clients have
 * to show the same thing. A string copied into each app drifts the first time
 * one of them is reworded, and nothing fails when it does — the screens just
 * stop matching, which is only noticed by whoever demos both.
 *
 * Only what both platforms show is here. Platform idioms stay in each app: the
 * web closes a modal with an X and the backdrop, the mobile with a button.
 */
export const PERMISSION_COPY = {
    /** Title of the modal that edits the permissions of a role (SCRUM-61). */
    rolePermissionsTitle: 'Permisos del rol',
    /**
     * Shown when ADMINISTRATOR is on. The rest of the switches are left as they
     * are instead of being forced on: what gets saved is what is on, and the
     * implication is resolved by the backend.
     */
    administratorNotice:
        'Con «Administrador» el rol tiene todos los permisos, estén marcados o no.',
    save: 'Guardar cambios',
    saving: 'Guardando...',
    rolePermissionsError: 'Error al editar los permisos',
    editRolePermissions: (roleName: string) => `Editar permisos de ${roleName}`,

    /** Title of the modal that gives and takes the roles of a member (SCRUM-62). */
    memberRolesTitle: 'Roles del miembro',
    membersTitle: (count: number) => `Miembros — ${count}`,
    ownerMark: 'Dueño del servidor',
    editMemberRoles: (memberName: string) => `Editar roles de ${memberName}`,
    noRolesYet: 'Este servidor todavía no tiene roles. Creá uno para poder asignarlo.',
    memberRoleError: 'No se pudo cambiar el rol',

    /** Placeholder of the composer for whoever lacks SEND_MESSAGES. */
    sendMessage: (channelName: string) => `Enviar mensaje a #${channelName}`,
    cannotSendMessage: (channelName: string) =>
        `No tenés permiso para escribir en #${channelName}`,
} as const;
