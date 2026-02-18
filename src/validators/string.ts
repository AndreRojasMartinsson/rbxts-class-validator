import { ValidateBy } from "./primitives";

/**
 * Validates that a value is a Luau `string`.
 *
 * This is a strict type check:
 * - Works: `"hello"`, `""`
 * - Fails: `123`, `true`, `{}`, `nil`
 *
 * If you want to accept numbers/booleans and convert them to strings, pair with `@Coerce.String()`.
 *
 * ## Example
 * ```ts
 * class User {
 *   @IsString()
 *   name!: string;
 * }
 * ```
 *
 * ## Example: with coercion
 * ```ts
 * class User {
 *   @Coerce.String()
 *   @IsString()
 *   name!: string;
 * }
 *
 * // { name: 123 } -> "123"
 * ```
 */
export function IsString(message = "must be a string") {
	return ValidateBy("IsString", (value) => (typeIs(value, "string") ? undefined : message));
}

/**
 * Validates that a string has length **at least** `minLength`.
 *
 * Rules:
 * - Value must be a string, otherwise fails with `message`.
 * - Passes if `value.size() >= minLength`.
 *
 * ## Example
 * ```ts
 * class User {
 *   @IsString()
 *   @MinLength(3)
 *   username!: string;
 * }
 * ```
 *
 * ## Example: custom message
 * ```ts
 * class User {
 *   @MinLength(8, "password must be at least 8 characters")
 *   password!: string;
 * }
 * ```
 */
export function MinLength(minLength: number, message = `must have length >= ${minLength}`) {
	return ValidateBy("MinLength", (value) => {
		if (!typeIs(value, "string")) return message;

		return value.size() >= minLength ? undefined : message;
	});
}

/**
 * Validates that a string has length **at most** `maxLength`.
 *
 * Rules:
 * - Value must be a string, otherwise fails with `message`.
 * - Passes if `value.size() <= maxLength`.
 *
 * ## Example
 * ```ts
 * class User {
 *   @IsString()
 *   @MaxLength(20)
 *   nickname!: string;
 * }
 * ```
 */
export function MaxLength(maxLength: number, message = `must have length <= ${maxLength}`) {
	return ValidateBy("MaxLength", (value) => {
		if (!typeIs(value, "string")) return message;

		return value.size() <= maxLength ? undefined : message;
	});
}
