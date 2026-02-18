import { isArrayLikeTable, slice } from "../helpers";
import { TupleElementValidator } from "../types";
import { validate } from "../validation";
import { isNil, ValidateBy } from "./primitives";

export function Nested(message = "nested validation failed") {
	return ValidateBy("Nested", (value) => {
		if (isNil(value)) return undefined;
		if (!typeIs(value, "table")) return message;

		return validate(value).size() === 0 ? undefined : message;
	});
}

export function IsArray(message = "must be an array") {
	return ValidateBy("IsArray", (value) => {
		if (!typeIs(value, "table")) return message;
		return isArrayLikeTable(value as object) ? undefined : message;
	});
}

export function ArrayMinSize(min: number, message = `array must have size >= ${min}`) {
	return ValidateBy("ArrayMinSize", (value) => {
		if (!typeIs(value, "table")) return message;
		if (!isArrayLikeTable(value as object)) return message;

		return (value as unknown[]).size() >= min ? undefined : message;
	});
}

export function ArrayMaxSize(max: number, message = `array must have size <= ${max}`) {
	return ValidateBy("ArrayMaxSize", (value) => {
		if (!typeIs(value, "table")) return message;
		if (!isArrayLikeTable(value as object)) return message;

		return (value as unknown[]).size() <= max ? undefined : message;
	});
}

/**
 * Validates each element with a predicate. Useful for simple element typing checks.
 *
 * Example:
 *  @ArrayElements((v) => typeIs(v, "number") ? undefined : "must be number")
 */
export function ArrayElements(
	elementValidator: (value: unknown, index: number) => string | undefined,
	message = "array elements invalid",
) {
	return ValidateBy("ArrayElements", (value) => {
		if (!typeIs(value, "table")) return message;
		if (!isArrayLikeTable(value as object)) return message;

		const arr = value as unknown[];
		for (let i = 0; i < arr.size(); i += 1) {
			const idx = i + 1; // Luau arrays are 1-based
			const msg = elementValidator(arr[i], idx);
			if (msg !== undefined) return `${message} (at ${idx}: ${msg})`;
		}

		return undefined;
	});
}

/**
 * Validates a fixed-length tuple (array-like table) and validates each index with its own validator.
 *
 * Usage:
 *  @IsTuple(
 *    (v) => typeIs(v, "string") ? undefined : "must be string",
 *    (v) => typeIs(v, "number") ? undefined : "must be number",
 *  )
 *
 *  // optional custom message as last arg:
 *  @IsTuple(v1, v2, "must be [string, number]")
 */
export function IsTuple(...validators: TupleElementValidator[]) {
	const defaultMsg = `must be a tuple of length ${validators.size()}`;

	return ValidateBy("IsTuple", (value) => {
		if (!typeIs(value, "table")) return defaultMsg;
		if (!isArrayLikeTable(value as object)) return defaultMsg;

		const members: string[] = [];

		const arr = value as unknown[];
		if (arr.size() !== validators.size()) return defaultMsg;

		for (let i = 0; i < validators.size(); i += 1) {
			const idx = i + 1;
			const v = arr[i];
			const err = validators[i](v, idx);
			if (err !== undefined) {
				members.push(`at ${idx}: ${err}`);
			}
		}

		if (members.size() === 0) {
			return undefined;
		}

		return defaultMsg + `(${members.join(", ")})`;
	});
}

/**
 * Convenience: only enforce tuple length (still requires array-like 1..n).
 */
export function TupleLength(len: number, message = `tuple must have length ${len}`) {
	return ValidateBy("TupleLength", (value) => {
		if (!typeIs(value, "table")) return message;
		if (!isArrayLikeTable(value as object)) return message;

		return (value as unknown[]).size() === len ? undefined : message;
	});
}
