import { isArrayLikeTable } from "../helpers";
import { TupleElementValidator } from "../types";
import { validate } from "../validation";
import { isNil, ValidateBy } from "./primitives";

/**
 * Performs nested validation on a child object/table.
 *
 * This is the equivalent of "validate the object stored in this property too".
 * It calls your global `validate(value)` function on the nested table and succeeds
 * only if the nested validation produces **zero errors**.
 *
 * Behavior:
 * - `nil` passes (no error). Use a required validator if you need it present.
 * - Non-table values fail.
 * - Tables pass if `validate(value).size() === 0`.
 *
 * ## Example
 * ```ts
 * class Engine {
 *   @IsNumber()
 *   @Min(1)
 *   hp!: number;
 * }
 *
 * class Car {
 *   @Nested()
 *   engine!: Engine;
 * }
 *
 * // { engine: { hp: 200 } } -> Works (assuming Engine validators pass)
 * // { engine: { hp: 0 } }   -> Fails (nested validation failed)
 * ```
 *
 * ## Note
 * This validator returns a single message (`message`) rather than bubbling up all
 * nested errors.
 */
export function Nested(message = "nested validation failed") {
	return ValidateBy("Nested", (value) => {
		if (isNil(value)) return undefined;
		if (!typeIs(value, "table")) return message;

		return validate(value).size() === 0 ? undefined : message;
	});
}

/**
 * Validates that a value is an array-like table (1-based, contiguous) in Luau terms.
 *
 * This checks:
 * - `typeIs(value, "table")`
 * - `isArrayLikeTable(value)` (your helper for "looks like an array")
 *
 * Behavior:
 * - Non-table values fail.
 * - Tables pass only if they are "array-like".
 *
 * ## Example
 * ```ts
 * class Inventory {
 *   @IsArray()
 *   items!: unknown[];
 * }
 *
 * // Works { items: ["a", "b"] }
 * // Fails { items: { a: 1 } } (record/table with string keys)
 * ```
 */
export function IsArray(message = "must be an array") {
	return ValidateBy("IsArray", (value) => {
		if (!typeIs(value, "table")) return message;
		return isArrayLikeTable(value as object) ? undefined : message;
	});
}

/**
 * Validates that an array-like table has length **at least** `min`.
 *
 * Behavior:
 * - Fails if value is not a table.
 * - Fails if table is not array-like.
 * - Passes if `value.size() >= min`.
 *
 * ## Example
 * ```ts
 * class Party {
 *   @IsArray()
 *   @ArrayMinSize(1, "must have at least one member")
 *   members!: unknown[];
 * }
 * ```
 */
export function ArrayMinSize(min: number, message = `array must have size >= ${min}`) {
	return ValidateBy("ArrayMinSize", (value) => {
		if (!typeIs(value, "table")) return message;
		if (!isArrayLikeTable(value as object)) return message;

		return (value as unknown[]).size() >= min ? undefined : message;
	});
}

/**
 * Validates that an array-like table has length **at most** `max`.
 *
 * Behavior:
 * - Fails if value is not a table.
 * - Fails if table is not array-like.
 * - Passes if `value.size() <= max`.
 *
 * ## Example
 * ```ts
 * class Lobby {
 *   @IsArray()
 *   @ArrayMaxSize(10)
 *   players!: unknown[];
 * }
 * ```
 */
export function ArrayMaxSize(max: number, message = `array must have size <= ${max}`) {
	return ValidateBy("ArrayMaxSize", (value) => {
		if (!typeIs(value, "table")) return message;
		if (!isArrayLikeTable(value as object)) return message;

		return (value as unknown[]).size() <= max ? undefined : message;
	});
}

/**
 * Validates each element of an array-like table using a per-element validator function.
 *
 * It's ideal for simple element checks without
 * needing a full nested DTO.
 *
 * The validator receives:
 * - `value`: the element value
 * - `index`: the 1-based Luau index of the element
 *
 * Behavior:
 * - Fails if value is not a table or not array-like.
 * - Iterates the array from index 1..n.
 * - Returns the first failing element as:
 *   `${message} (at <idx>: <reason>)`
 *
 * ## Example: number array
 * ```ts
 * class Stats {
 *   @IsArray()
 *   @ArrayElements((v, i) => (typeIs(v, "number") ? undefined : "must be number"))
 *   samples!: unknown[];
 * }
 * ```
 *
 * ## Example: validate shape-ish objects quickly
 * ```ts
 * class Events {
 *   @ArrayElements((v) => {
 *     if (!typeIs(v, "table")) return "must be table";
 *     // quick check:
 *     return (v as any).type !== undefined ? undefined : "missing type";
 *   })
 *   list!: unknown[];
 * }
 * ```
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
 * Validates that a value is a fixed-length tuple (array-like table) and validates each index
 * with its corresponding validator.
 *
 * You provide one validator per tuple slot. The input must:
 * - be a table
 * - be array-like
 * - have the exact length `validators.size()`
 *
 * It then runs each `validators[i](valueAtIndex, index)` and collects *all* failures,
 * returning them in a single aggregated message.
 *
 * ## Example: [string, number]
 * ```ts
 * class PointLabel {
 *   @IsTuple(
 *     (v) => (typeIs(v, "string") ? undefined : "must be string"),
 *     (v) => (typeIs(v, "number") ? undefined : "must be number"),
 *   )
 *   pair!: unknown[]; // runtime tuple table
 * }
 *
 * // Works: { pair: ["x", 10] }
 * // Fails: { pair: ["x", "10"] } -> must be a tuple of length 2(at 2: must be number)
 * // Fails: { pair: ["x"] }       -> must be a tuple of length 2
 * ```
 *
 * ## Example: richer errors
 * ```ts
 * @IsTuple(
 *   (v) => (typeIs(v, "number") ? undefined : "x must be number"),
 *   (v) => (typeIs(v, "number") ? undefined : "y must be number"),
 * )
 * pos!: unknown[];
 * ```
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
 * Convenience validator that only enforces tuple length (and "array-like").
 *
 * This does *not* validate element types/values - it only checks:
 * - table
 * - array-like
 * - `size() === len`
 *
 * ## Example
 * ```ts
 * class RGB {
 *   @TupleLength(3)
 *   rgb!: unknown[];
 * }
 *
 * // Works: [255, 0, 10] (length 3)
 * // Fails: [255, 0]     (length 2)
 * // Fails: { r: 1 }     (not array-like)
 * ```
 */
export function TupleLength(len: number, message = `tuple must have length ${len}`) {
	return ValidateBy("TupleLength", (value) => {
		if (!typeIs(value, "table")) return message;
		if (!isArrayLikeTable(value as object)) return message;

		return (value as unknown[]).size() === len ? undefined : message;
	});
}
