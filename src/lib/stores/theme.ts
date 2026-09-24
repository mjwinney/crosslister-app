import { browser } from '$app/environment';
import { writable } from 'svelte/store';

export type AppTheme = 'dark' | 'light';

const STORAGE_KEY = 'prelistr-theme';
const defaultTheme: AppTheme = 'dark';

function getStoredTheme(): AppTheme {
	if (!browser) {
		return defaultTheme;
	}

	const stored = window.localStorage.getItem(STORAGE_KEY);
	return stored === 'light' || stored === 'dark' ? stored : defaultTheme;
}

export const appTheme = writable<AppTheme>(getStoredTheme());

export function setAppTheme(theme: AppTheme) {
	if (!browser) return;

	window.localStorage.setItem(STORAGE_KEY, theme);
	document.documentElement.dataset.theme = theme;
	document.documentElement.style.colorScheme = theme;
	appTheme.set(theme);
}

if (browser) {
	document.documentElement.dataset.theme = getStoredTheme();
	document.documentElement.style.colorScheme = getStoredTheme();

	appTheme.subscribe((theme) => {
		document.documentElement.dataset.theme = theme;
		document.documentElement.style.colorScheme = theme;
		window.localStorage.setItem(STORAGE_KEY, theme);
	});
}
