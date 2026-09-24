// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			session: import("better-auth").Session | null;
			user: import("better-auth").User | null;
			ebayAccessToken: string | null;
			ebayRefreshToken: string | null;
			ebayBrowseToken?: string | null;
			ebaySellerUsername?: string | null;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

declare module 'vanillajs-datepicker' {
	const Datepicker: any;
	export { Datepicker };
	export default Datepicker;
}

export {};
