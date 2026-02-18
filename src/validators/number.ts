import { ValidateBy } from "./primitives";

/**
 * Validates that a value is a `number`.
 *
 * This is a strict type check:
 * - Works: `123`, `0.5`, `math.huge`, `0/0` (NaN is still a number in Luau)
 * - Error: `"123"`, `true`, `{}`, `nil`
 *
 * If you want to accept strings like `"123"` and convert them, pair with `@Coerce.Number()`.
 *
 * ## Example
 * ```ts
 * class Stats {
 *   @IsNumber()
 *   hp!: number;
 * }
 * ```
 *
 * ## Example: with coercion
 * ```ts
 * class Stats {
 *   @Coerce.Number()
 *   @IsNumber()
 *   hp!: number;
 * }
 *
 * // { hp: "10" } -> coerces to 10, then validates
 * ```
 */
export function IsNumber(message = "must be a number") {
	return ValidateBy("IsNumber", (value) => (typeIs(value, "number") ? undefined : message));
}

/**
 * Validates that a value is an integer (no fractional component).
 *
 * Rules:
 * - Value must be a number.
 * - Passes if `math.floor(n) === n`.
 *
 * Examples:
 * - Works: `0`, `10`, `-3`
 * - Fails:  `1.2`, `-5.5`, `"12"`
 *
 * ## Example
 * ```ts
 * class Gearbox {
 *   @IsInteger()
 *   gear!: number;
 * }
 * ```
 *
 * ## Example: bounds + integer
 * ```ts
 * class Gearbox {
 *   @IsInteger()
 *   @Min(-1)
 *   @Max(6)
 *   gear!: number;
 * }
 * ```
 */
export function IsInteger(message = "must be a integer") {
	return ValidateBy("IsInteger", (value) => {
		if (!typeIs(value, "number")) return message;

		const n = value as number;
		return math.floor(n) === n ? undefined : message;
	});
}

/**
 * Validates that a numeric value is **greater than or equal to** `min`.
 *
 * This validator is inclusive: `value >= min`.
 *
 * Rules:
 * - Value must be a number, otherwise fails with `message`.
 * - Passes if `(value as number) >= min`.
 *
 * ## Example
 * ```ts
 * class Player {
 *   @IsNumber()
 *   @Min(0)
 *   coins!: number;
 * }
 * ```
 *
 * ## Example: custom message
 * ```ts
 * class Player {
 *   @Min(1, "must be at least 1 coin")
 *   coins!: number;
 * }
 * ```
 */
export function Min(min: number, message = `must be >= ${min}`) {
	return ValidateBy("Min", (value) => {
		if (!typeIs(value, "number")) return message;

		return (value as number) >= min ? undefined : message;
	});
}

/**
 * Validates that a numeric value is **less than or equal to** `max`.
 *
 * This validator is inclusive: `value <= max`.
 *
 * Rules:
 * - Value must be a number, otherwise fails with `message`.
 * - Passes if `(value as number) <= max`.
 *
 * ## Example
 * ```ts
 * class Vehicle {
 *   @IsNumber()
 *   @Max(1)
 *   throttle!: number; // 0..1
 * }
 * ```
 */
export function Max(max: number, message = `must be <= ${max}`) {
	return ValidateBy("Max", (value) => {
		if (!typeIs(value, "number")) return message;

		return (value as number) <= max ? undefined : message;
	});
}
