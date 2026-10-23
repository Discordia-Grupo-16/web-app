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

    /** The role new members receive (SCRUM-63). */
    defaultRoleBadge: 'Por defecto',
    isDefaultRole: 'Es el rol que reciben los nuevos miembros.',
    makeDefaultRole: 'Marcar como rol por defecto',
    defaultRoleError: 'No se pudo cambiar el rol por defecto',

    /** Who holds a role (SCRUM-67). */
    viewRoleMembers: (roleName: string) => `Ver los miembros con el rol ${roleName}`,
    roleMembersTitle: 'Miembros con el rol',
    /**
     * Shown when the role exists but nobody has it. It is a normal state —
     * a role is created empty and gets its permissions before its members —
     * so it says what to do rather than reading as an error.
     */
    noMembersWithRole: 'Todavía nadie tiene este rol. Se asigna desde la lista de miembros.',
  
    /** Kicking a member (SCRUM-68). */
    kickMember: (memberName: string) => `Expulsar a ${memberName}`,
    kickMemberTitle: 'Expulsar miembro',
    /**
     * Says the half a moderator might get wrong: unlike a ban, an invitation does
     * bring them back.
     */
    kickMemberWarning: (memberName: string) =>
        `${memberName} va a perder el acceso al servidor y a sus canales. Puede volver a entrar con una nueva invitación.`,
    kickConfirm: 'Expulsar',
    kicking: 'Expulsando...',
    kickCancel: 'Cancelar',
    kickMemberError: 'No se pudo expulsar al miembro',

    /** Banning a member (SCRUM-69). */
    banMember: (memberName: string) => `Banear a ${memberName}`,
    banMemberTitle: 'Banear miembro',
    /**
     * Says both halves of what a ban does. The second one is the part a
     * moderator cannot guess: it is not the same as removing them, because an
     * invitation does not bring them back.
     */
    banMemberWarning: (memberName: string) =>
        `${memberName} va a perder el acceso al servidor y no va a poder volver a entrar con ninguna invitación.`,
    banReasonLabel: 'Motivo (opcional)',
    banReasonPlaceholder: 'Queda guardado para los moderadores',
    banConfirm: 'Banear',
    banning: 'Baneando...',
    banCancel: 'Cancelar',
    banMemberError: 'No se pudo banear al miembro',

    /** The bans of a server and revoking one (SCRUM-70). */
    bansTitle: (count: number) => `Baneados — ${count}`,
    noBans: 'No hay usuarios baneados.',
    /**
     * Known debt: `community` returns dates without a time zone (it breaks
     * `procesos/convenciones.md`), so they are read as local time and a ban made
     * late at night shows the next day. The fix belongs in the backend (see the PR of SCRUM-70).
     */
    bannedOn: (moderatorName: string, isoDate: string) =>
        `Baneado por ${moderatorName} el ${new Date(isoDate).toLocaleDateString('es-AR')}`,
    banReason: (reason: string) => `Motivo: ${reason}`,
    revokeBan: (memberName: string) => `Revocar el baneo de ${memberName}`,
    revokeBanTitle: 'Revocar baneo',
    revokeBanWarning: (memberName: string) =>
        `${memberName} va a poder volver a entrar al servidor con una invitación válida. No vuelve solo: tiene que aceptar una.`,
    revokeConfirm: 'Revocar baneo',
    revoking: 'Revocando...',
    revokeCancel: 'Cancelar',
    revokeBanError: 'No se pudo revocar el baneo',
    bansError: 'No se pudieron cargar los baneados',

    /** Shown instead of the channel list to whoever lacks VIEW_CHANNEL. */
    noViewChannel: 'No tenés permiso para ver los canales de este servidor.',

    /** Placeholder of the composer for whoever lacks SEND_MESSAGES. */
    sendMessage: (channelName: string) => `Enviar mensaje a #${channelName}`,
    cannotSendMessage: (channelName: string) =>
        `No tenés permiso para escribir en #${channelName}`,
} as const;
