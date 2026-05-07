import { writable } from 'svelte/store';

export const poshmarkTabOpen = writable<boolean>(false);
export const poshmarkTabLoggedInUid = writable<string>("");
