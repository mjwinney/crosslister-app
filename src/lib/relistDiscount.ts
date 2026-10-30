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
