import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import RelistBadge from './RelistBadge.svelte';

describe('RelistBadge', () => {
	it.each([undefined, null, '', '  ', 'success', ' SUCCESS '])(
		'keeps the normal countdown for result %s',
		(lastRelistResult) => {
			const { body } = render(RelistBadge, {
				props: { enabled: true, daysRemaining: 12, lastRelistResult }
			});
			expect(body).toContain('src="/relist-12.svg"');
			expect(body).toContain('alt="Relists in 12 days"');
			expect(body).toContain('title="Relists in 12 days"');
			expect(body).not.toContain('relist-badge-failed');
		}
	);

	it.each([
		'failed: eBay rejected listing',
		'error: network down',
		'invalid relist discount settings',
		'success; old listing still active: EndItem failed',
		'relisted as 123 but DB itemId swap failed'
	])('marks a recorded problem as failed: %s', (lastRelistResult) => {
		const { body } = render(RelistBadge, {
			props: { enabled: true, daysRemaining: 12, lastRelistResult }
		});
		expect(body).toContain('src="/relist-12.svg"');
		expect(body).toContain('relist-badge-failed');
		expect(body).toContain('alt="Last automatic relist had a problem; relists in 12 days"');
		expect(body).toContain('title="Last automatic relist had a problem; relists in 12 days"');
	});

	it('shows no badge when relisting is disabled, even with a recorded failure', () => {
		const { body } = render(RelistBadge, {
			props: { enabled: false, daysRemaining: 12, lastRelistResult: 'failed' }
		});
		expect(body).not.toContain('<img');
	});
});
