import { describe, expect, it } from 'vitest';
import {
	getRelistDiscountFieldErrors,
	nextDiscountPrice,
	prepareRelistDiscountUpdate,
	validateRelistDiscount
} from './relistDiscount';

describe('validateRelistDiscount', () => {
	it.each([
		[5, 20],
		[10, 15],
		[1, 2],
		[49, 50]
	])('accepts %i / %i', (discount, max) => {
		expect(validateRelistDiscount(discount, max)).toEqual({ valid: true });
	});

	it.each([
		['equal values', 15, 15],
		['both at the cap', 50, 50],
		['discount above max', 20, 10],
		['zero discount', 0, 10],
		['negative discount', -5, 10],
		['negative max', 5, -10],
		['decimal discount', 2.5, 20],
		['decimal max', 5, 20.5],
		['discount over cap', 51, 60],
		['max over cap', 5, 51],
		['both far over cap', 5, 100],
		['string discount', 'abc', 20],
		['empty string', '', 20],
		['null discount', null, 20],
		['undefined max', 5, undefined],
		['NaN discount', NaN, 20],
		['Infinity max', 5, Infinity]
	])('rejects %s', (_name, discount, max) => {
		expect(validateRelistDiscount(discount, max).valid).toBe(false);
	});
});

describe('getRelistDiscountFieldErrors', () => {
	it('returns no errors for a valid pair', () => {
		expect(getRelistDiscountFieldErrors(5, 20)).toEqual({});
	});

	it('reports a discount-only problem on the discount field', () => {
		const errors = getRelistDiscountFieldErrors(2.5, 20);
		expect(errors.percent).toBeDefined();
		expect(errors.max).toBeUndefined();
	});

	it('reports a max-only problem on the max field', () => {
		const errors = getRelistDiscountFieldErrors(5, 51);
		expect(errors.percent).toBeUndefined();
		expect(errors.max).toBeDefined();
	});

	it('reports problems on both fields independently', () => {
		const errors = getRelistDiscountFieldErrors(0, 60);
		expect(errors.percent).toBeDefined();
		expect(errors.max).toBeDefined();
	});

	it('puts the less-than-maximum error on the discount field', () => {
		const errors = getRelistDiscountFieldErrors(20, 10);
		expect(errors.percent).toMatch(/less than/i);
		expect(errors.max).toBeUndefined();
	});
});

describe('nextDiscountPrice', () => {
	function run(discount: number, max: number, steps: number, base = 100) {
		const prices: number[] = [];
		let current = base;
		for (let i = 0; i < steps; i++) {
			current = nextDiscountPrice(current, base, discount, max);
			prices.push(current);
		}
		return prices;
	}

	it('discounts the current price and stops at the floor (5 / 20)', () => {
		expect(run(5, 20, 7)).toEqual([95, 90.25, 85.74, 81.45, 80, 80, 80]);
	});

	it('clamps the last step to exactly the floor (10 / 15)', () => {
		expect(run(10, 15, 4)).toEqual([90, 85, 85, 85]);
	});

	it('clamps when the floor is not a whole step away (3 / 7)', () => {
		expect(run(3, 7, 5)).toEqual([97, 94.09, 93, 93, 93]);
	});

	it('rounds to 2 decimals at every step', () => {
		for (const price of run(7, 40, 10, 33.33)) {
			expect(Math.round(price * 100) / 100).toBe(price);
		}
	});

	it('never goes below the floor for any valid pair', () => {
		for (let discount = 1; discount < 50; discount += 7) {
			for (let max = discount + 1; max <= 50; max += 9) {
				const floor = Math.round(100 * (1 - max / 100) * 100) / 100;
				for (const price of run(discount, max, 40)) {
					expect(price).toBeGreaterThanOrEqual(floor);
				}
			}
		}
	});

	it('never increases the price, even when the current price is already below the floor', () => {
		expect(nextDiscountPrice(70, 100, 5, 20)).toBe(70);
	});

	it('follows the new base after a manual price edit', () => {
		// A manual edit to 200 resets the base to 200, so the floor becomes 160.
		expect(nextDiscountPrice(200, 200, 5, 20)).toBe(190);
		expect(nextDiscountPrice(161, 200, 5, 20)).toBe(160);
	});
});

describe('prepareRelistDiscountUpdate', () => {
	const enabledExisting = {
		relistDiscountEnabled: true,
		relistDiscountPercent: 5,
		relistDiscountMaxPercent: 20
	};

	it('rejects invalid values when enabling', () => {
		const result = prepareRelistDiscountUpdate(
			{ relistDiscountEnabled: true, relistDiscountPercent: 20, relistDiscountMaxPercent: 10 },
			{ relistDiscountEnabled: false }
		);
		expect(result.ok).toBe(false);
	});

	it('rejects a discount over 50', () => {
		const result = prepareRelistDiscountUpdate(
			{ relistDiscountEnabled: true, relistDiscountPercent: 5, relistDiscountMaxPercent: 51 },
			null
		);
		expect(result.ok).toBe(false);
	});

	it('clears the price anchors when the discount is newly enabled', () => {
		const result = prepareRelistDiscountUpdate(
			{ relistDiscountEnabled: true, relistDiscountPercent: 5, relistDiscountMaxPercent: 20, relistDiscountBasePrice: 99, relistDiscountLastPrice: 88 },
			{ relistDiscountEnabled: false }
		);
		expect(result).toMatchObject({ ok: true, data: { relistDiscountBasePrice: null, relistDiscountLastPrice: null } });
	});

	it('treats a missing existing record as newly enabled', () => {
		const result = prepareRelistDiscountUpdate(
			{ relistDiscountEnabled: true, relistDiscountPercent: 5, relistDiscountMaxPercent: 20 },
			undefined
		);
		expect(result).toMatchObject({ ok: true, data: { relistDiscountBasePrice: null, relistDiscountLastPrice: null } });
	});

	it('rejects changing the percentages while the discount stays enabled', () => {
		expect(
			prepareRelistDiscountUpdate({ relistDiscountEnabled: true, relistDiscountPercent: 6, relistDiscountMaxPercent: 20 }, enabledExisting).ok
		).toBe(false);
		expect(
			prepareRelistDiscountUpdate({ relistDiscountEnabled: true, relistDiscountPercent: 5, relistDiscountMaxPercent: 25 }, enabledExisting).ok
		).toBe(false);
	});

	it('accepts an unchanged enabled update and ignores client-sent price anchors', () => {
		const result = prepareRelistDiscountUpdate(
			{ relistDiscountEnabled: true, relistDiscountPercent: 5, relistDiscountMaxPercent: 20, relistDiscountBasePrice: 1, relistDiscountLastPrice: 2 },
			enabledExisting
		);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.data).not.toHaveProperty('relistDiscountBasePrice');
			expect(result.data).not.toHaveProperty('relistDiscountLastPrice');
		}
	});

	it('clears the price anchors when the discount is switched off', () => {
		const result = prepareRelistDiscountUpdate({ relistDiscountEnabled: false }, enabledExisting);
		expect(result).toMatchObject({ ok: true, data: { relistDiscountBasePrice: null, relistDiscountLastPrice: null } });
	});

	it('allows changing percentages while the discount is disabled', () => {
		const result = prepareRelistDiscountUpdate(
			{ relistDiscountEnabled: false, relistDiscountPercent: 12, relistDiscountMaxPercent: 30 },
			{ relistDiscountEnabled: false }
		);
		expect(result).toMatchObject({ ok: true, data: { relistDiscountPercent: 12, relistDiscountMaxPercent: 30 } });
	});

	it('does not touch discount state for an unrelated metadata update', () => {
		const result = prepareRelistDiscountUpdate({ relistDiscountBasePrice: 50, relistDiscountLastPrice: 40 }, enabledExisting);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.data).toEqual({});
		}
	});

	it('does not mutate its input', () => {
		const incoming = { relistDiscountEnabled: true, relistDiscountPercent: 5, relistDiscountMaxPercent: 20, relistDiscountBasePrice: 1 };
		prepareRelistDiscountUpdate(incoming, { relistDiscountEnabled: false });
		expect(incoming.relistDiscountBasePrice).toBe(1);
	});
});
