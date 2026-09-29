<script lang="ts">
	import type { Snippet } from 'svelte';

	let openSections = $state({
		dashboard: true,
		ebay: true,
		poshmark: true,
		reports: false,
		settings: false
	});

	const navSections = [
		{
			id: 'dashboard',
			label: 'Dashboard',
			items: [{ label: 'Dashboard', href: '/auth/dashboard' }]
		},
		{
			id: 'ebay',
			label: 'Ebay',
			items: [
				{ label: 'Active', href: '/auth/active-items' },
				{ label: 'Scheduled', href: '/auth/scheduled-items' },
				{ label: 'Sold', href: '/auth/sold-items' },
				{ label: 'Unsold', href: '/auth/unsold-items' }
			]
		},
		{
			id: 'poshmark',
			label: 'Poshmark',
			items: [
				{ label: 'Dashboard', href: '/auth/poshmark-dashboard' },
				{ label: 'Active', href: '/auth/poshmark-active-items' },
				{ label: 'Sold', href: '/auth/poshmark-sold-items' }
			]
		}
	] as const;

	type NavigationPath = (typeof navSections)[number]['items'][number]['href'];
	type Props = {
		children: Snippet;
		navigateTo: (path: NavigationPath) => Promise<void>;
	};
	let { children, navigateTo }: Props = $props();

	function toggleSection(id: keyof typeof openSections) {
		openSections[id] = !openSections[id];
	}
</script>

<main class="min-h-[calc(100vh-74px)] overflow-x-hidden bg-[radial-gradient(circle_at_8%_0%,rgba(124,58,237,0.14),transparent_26rem),linear-gradient(135deg,#040b14_0%,#0a1628_48%,#07111f_100%)] text-slate-50">
	<div class="mx-auto max-w-[1800px] px-4 py-4 lg:px-8">
		<div class="grid gap-4 xl:grid-cols-[188px_minmax(0,1fr)]">
			<aside class="sidebar-panel sticky top-4 overflow-hidden rounded-xl border border-slate-700/20 bg-slate-950/70 shadow-[0_12px_32px_rgba(4,11,20,0.22)]">
				<div class="space-y-2 p-3">
					{#each navSections as section (section.id)}
						<div class="overflow-hidden rounded-lg border border-slate-700/20 bg-slate-900/40">
							<button
								type="button"
								class="flex w-full items-center justify-between px-4 py-3 text-left text-[0.95rem] font-bold tracking-[0.02em] text-slate-200 transition-colors hover:bg-violet-500/10"
								onclick={() => toggleSection(section.id)}
								aria-expanded={openSections[section.id]}
							>
								<span>{section.label}</span>
								<svg
									class="h-3.5 w-3.5 transition-transform duration-150 {openSections[section.id] ? 'rotate-180' : ''}"
									viewBox="0 0 20 20"
									fill="none"
									stroke="currentColor"
									stroke-width="1.8"
									aria-hidden="true"
								>
									<path d="M5 7.5L10 12.5L15 7.5" stroke-linecap="round" stroke-linejoin="round" />
								</svg>
							</button>

							{#if openSections[section.id]}
								<div class="border-t border-slate-700/20 px-2 py-2">
									<ul class="space-y-1">
										{#each section.items as item (item.href)}
											<li>
												<button
													type="button"
													class="flex w-full items-center rounded-md px-3 py-2 text-left text-sm text-slate-200 transition-colors hover:bg-violet-500/15 hover:text-white"
													onclick={() => navigateTo(item.href)}
												>
													{item.label}
												</button>
											</li>
										{/each}
									</ul>
								</div>
							{/if}
						</div>
					{/each}
				</div>
			</aside>

			<section class="content-panel min-h-[calc(100vh-122px)] overflow-auto rounded-xl border border-slate-700/20 bg-transparent shadow-none">
				{@render children()}
			</section>
		</div>
	</div>
</main>
<style>
	@media (max-width: 767.98px) {
		.sidebar-panel {
			position: static;
		}
	}
</style>

