import type { User } from '@discordia/api';

export const STAFF_ROLE = 'staff';

// UX gate only: the real authorization is the 403 of every backoffice endpoint.
export const isStaff = (user: User | null): boolean => user?.role === STAFF_ROLE;
