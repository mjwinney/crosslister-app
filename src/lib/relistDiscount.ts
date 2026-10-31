export const MAX_DISCOUNT_PERCENT = 50;
export const DEFAULT_DISCOUNT_PERCENT = 5;
export const DEFAULT_MAX_DISCOUNT_PERCENT = 20;

export type RelistDiscountValidation = { valid: true } | { valid: false; message: string };
export type RelistDiscountFieldErrors = { percent?: string; max?: string };

export function getRelistDiscountFieldErrors(discount: unknown, max: unknown): RelistDiscountFieldErrors {
	const errors: RelistDiscountFieldErrors = {};

	if (typeof discount !== 'number' || !Number.isInteger(discount)) {
		errors.percent = 'Discount must be a whole number';
	} else if (discount <= 0) {
		errors.percent = 'Discount must be greater than 0';
	} else if (discount > MAX_DISCOUNT_PERCENT) {
		errors.percent = `Discount cannot exceed ${MAX_DISCOUNT_PERCENT}%`;
	}

	if (typeof max !== 'number' || !Number.isInteger(max)) {
		errors.max = 'Maximum must be a whole number';
	} else if (max <= 0) {
		errors.max = 'Maximum must be greater than 0';
	} else if (max > MAX_DISCOUNT_PERCENT) {
		errors.max = `Maximum cannot exceed ${MAX_DISCOUNT_PERCENT}%`;
	}

	if (!errors.percent && !errors.max && (discount as number) >= (max as number)) {
		errors.percent = 'Discount must be less than the maximum';
	}

	return errors;
}

export function validateRelistDiscount(discount: unknown, max: unknown): RelistDiscountValidation {
	const errors = getRelistDiscountFieldErrors(discount, max);
	const message = errors.percent ?? errors.max;
	return message ? { valid: false, message } : { valid: true };
}

function roundCents(value: number): number {
	return Math.round((value + Number.EPSILON) * 100) / 100;
}

// Takes `discount`% off the current price but never goes below the floor (max% off the base) or above the current price.
export function nextDiscountPrice(current: number, base: number, discount: number, max: number): number {
	const floor = roundCents(base * (1 - max / 100));
	const discounted = roundCents(current * (1 - discount / 100));
	return Math.min(roundCents(current), Math.max(discounted, floor));
}

export type RelistDiscountSettings = {
	relistDiscountEnabled?: boolean;
	relistDiscountPercent?: number | null;
	relistDiscountMaxPercent?: number | null;
	relistDiscountBasePrice?: number | null;
	relistDiscountLastPrice?: number | null;
};

export type RelistDiscountUpdateResult<T> = { ok: true; data: T } | { ok: false; message: string };

// The base and last prices are owned by the relist job, so the client can never set them; they are only cleared when the discount is switched on or off.
export function prepareRelistDiscountUpdate<T extends RelistDiscountSettings>(
	incoming: T,
	existing?: RelistDiscountSettings | null
): RelistDiscountUpdateResult<T> {
	const data: T = { ...incoming };
	delete data.relistDiscountBasePrice;
	delete data.relistDiscountLastPrice;

	const wasEnabled = existing?.relistDiscountEnabled === true;

	if (incoming.relistDiscountEnabled === true) {
		const errors = getRelistDiscountFieldErrors(incoming.relistDiscountPercent, incoming.relistDiscountMaxPercent);
		const message = errors.percent ?? errors.max;
		if (message) {
			return { ok: false, message };
		}

		if (wasEnabled) {
			const samePercent = incoming.relistDiscountPercent === (existing?.relistDiscountPercent ?? DEFAULT_DISCOUNT_PERCENT);
			const sameMax = incoming.relistDiscountMaxPercent === (existing?.relistDiscountMaxPercent ?? DEFAULT_MAX_DISCOUNT_PERCENT);
			if (!samePercent || !sameMax) {
				return { ok: false, message: 'Discount settings cannot be changed while the discount is enabled' };
			}
		} else {
			data.relistDiscountBasePrice = null;
			data.relistDiscountLastPrice = null;
		}
	} else if (incoming.relistDiscountEnabled === false && wasEnabled) {
		data.relistDiscountBasePrice = null;
		data.relistDiscountLastPrice = null;
	}

	return { ok: true, data };
}
