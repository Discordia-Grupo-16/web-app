import { useState } from 'react';
import { getApiErrorMessage, type AdminUser } from '@discordia/api';
import { adminUserService } from '@/shared/api';

// SCRUM-82 adds 'reactivate' here and one case in runAction.
export type UserStatusAction = 'suspend';

interface State {
    target: AdminUser | null;
    kind: UserStatusAction | null;
    isSubmitting: boolean;
    error: string | null;
}

const CLOSED: State = { target: null, kind: null, isSubmitting: false, error: null };

const runAction = (user: AdminUser, kind: UserStatusAction): Promise<AdminUser> => {
    switch (kind) {
        case 'suspend':
            return adminUserService.suspendUser(user.id);
    }
};

const isConflict = (err: unknown) => (err as { response?: { status?: number } })?.response?.status === 409;

interface Options {
    onDone: (updated: AdminUser, kind: UserStatusAction) => void;
    /**
     * The list was out of date (409, e.g. another staff member already did it). The dialog is closed
     * because retrying would only give another 409: the caller reloads and shows `message`.
     */
    onConflict: (message: string) => void;
}

export const useUserStatusAction = ({ onDone, onConflict }: Options) => {
    const [state, setState] = useState<State>(CLOSED);

    const open = (user: AdminUser, kind: UserStatusAction) =>
        setState({ target: user, kind, isSubmitting: false, error: null });

    const cancel = () => setState(CLOSED);

    const confirm = async () => {
        const { target, kind, isSubmitting } = state;
        if (!target || !kind || isSubmitting) return;

        setState({ ...state, isSubmitting: true, error: null });
        try {
            const updated = await runAction(target, kind);
            setState(CLOSED);
            onDone(updated, kind);
        } catch (err: unknown) {
            const message = getApiErrorMessage(err, 'No se pudo completar la acción.');
            if (isConflict(err)) {
                setState(CLOSED);
                onConflict(message);
                return;
            }
            // Any other failure (403, 5xx, network) stays in the dialog with confirm enabled to retry.
            setState({ ...state, isSubmitting: false, error: message });
        }
    };

    return { ...state, open, cancel, confirm };
};
