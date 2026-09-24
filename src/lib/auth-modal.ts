import { writable } from 'svelte/store';

export type AuthModalMode = 'signin' | 'register';

export const authModal = writable<AuthModalMode | null>(null);

export function openAuthModal(mode: AuthModalMode = 'signin') {
	authModal.set(mode);
}

export function closeAuthModal() {
	authModal.set(null);
}
