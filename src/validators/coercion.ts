import { Reflect } from "@flamework/core";
import { CoerceFn } from "../types";
import { isNil, setCoercer } from "./primitives";

function deepFreeze<T extends object>(obj: T, seen?: Set<T>): T {
	seen ??= new Set();

	if (seen.has(obj)) {
		return obj;
	}

	seen.add(obj);

	for (const [, v] of pairs(obj)) {
		if (!typeIs(v, "table")) {
			continue;
		}

		deepFreeze(v, seen);
	}

	return table.freeze(obj);
}

/**
 * These decorators **do not validate** — they only attempt to *convert* incoming values
 * into the expected runtime shape *before* validators run.
 *
 * ## Mental model
 * - A `Coerce.*()` decorator registers a *coercer function* for a property.
 * - Coerce functions run before validation pipeline.
 * - If a coercer returns `{ ok: false }`, you surface a validation/coercion error.
 * - If it returns `{ ok: true }`, you replace the value with the coerced one.
 *
 * ## Coercer function contract
 * A coercer is a function like:
 * ```ts
 * type CoerceFn = (value: unknown, ctx: { object: object; property: string }) =>
 *   | { ok: true; value: unknown }
 *   | { ok: false; message: string };
 * ```
 *
 * ## `nil` handling
 * All built-in coercers treat `nil` specially: if the incoming value is `nil`,
 * they typically return `{ ok: true, value }` (i.e., they do nothing).
 *
 * Use `Coerce.Default()` to *actively replace* `nil` values (but only for optional fields).
 */
export namespace Coerce {
	/**
	 * Registers a custom coercer for a property.
	 *
	 * This is the primitive building block for all other `Coerce.*` helpers.
	 * Provide a `CoerceFn` and it gets associated with the decorated property via `setCoercer`.
	 */
	export function Custom(fn: CoerceFn) {
		return (target: object, propertyKey: string) => setCoercer(target, propertyKey, fn);
	}

	/**
	 * Coerces values into a string.
	 *
	 * Behavior:
	 * - `nil` -> unchanged (`nil`)
	 * - `string` -> unchanged
	 * - `number | boolean` -> `tostring(value)`
	 * - anything else -> error
	 *
	 * ## Example
	 * ```ts
	 * class Settings {
	 *   @Coerce.String()
	 *   region!: string;
	 * }
	 *
	 * // Accepts:
	 * // { region: "eu" }   -> "eu"
	 * // { region: 123 }    -> "123"
	 * // { region: true }   -> "true"
	 * // { region: {} }     -> error
	 * ```
	 */
	export function String(message = "could not coerce to string") {
		return Custom((value) => {
			if (isNil(value)) {
				return { ok: true, value };
			}

			if (typeIs(value, "string")) {
				return { ok: true, value };
			}

			if (typeIs(value, "number") || typeIs(value, "boolean")) {
				return { ok: true, value: tostring(value) };
			}

			return { ok: false, message };
		});
	}

	/**
	 * Applies a default value **only if**:
	 * 1) the property is marked optional (`@IsOptional()` / your optional marker), **and**
	 * 2) the incoming value is `nil`.
	 *
	 * This is intentionally conservative:
	 * - Required fields do **not** get silently defaulted.
	 * - Non-`nil` values pass through unchanged.
	 *
	 * ## Why "optional-only"?
	 * It prevents accidental masking of missing required data.
	 *
	 * ## Factory vs value
	 * - Pass a value (`Coerce.Default(123)`) for simple defaults.
	 * - Pass a function (`Coerce.Default(() => new Map())`) for *fresh instances* per object.
	 *
	 * ## Example: simple value default
	 * ```ts
	 * class UserPrefs {
	 *   @IsOptional()
	 *   @Coerce.Default("en")
	 *   language?: string;
	 * }
	 *
	 * // { } -> language becomes "en"
	 * // { language: "sv" } -> "sv"
	 * ```
	 *
	 * ## Example: factory default
	 * ```ts
	 * class UserState {
	 *   @IsOptional()
	 *   @Coerce.Default(() => new Map<string, number>())
	 *   counters?: Map<string, number>;
	 * }
	 * ```
	 */
	export function Default<T>(valueOrFactory: T | (() => T)) {
		return Custom((value, ctx) => {
			// Only apply to optional fields
			const optional =
				Reflect.getMetadata<boolean>(ctx.object, "app:validators:optional", ctx.property) ?? false;

			if (!optional) return { ok: true, value };
			if (!isNil(value)) return { ok: true, value };

			const _next = typeIs(valueOrFactory, "function")
				? (valueOrFactory as unknown as () => T)()
				: (valueOrFactory as T);

			return { ok: true, value: _next };
		});
	}

	/**
	 * Deep-freezes a table value to make it effectively read-only at runtime.
	 *
	 * Behavior:
	 * - `nil` -> unchanged
	 * - `table` -> `deepFreeze(value)` (recursive freeze)
	 * - anything else -> error
	 *
	 * ## Notes
	 * - This enforces immutability by converting the table (and nested tables)
	 *   into frozen tables.
	 * - Use this when you want "data objects" that should not be mutated after validation.
	 *
	 * ## Example
	 * ```ts
	 * class Payload {
	 *   @Coerce.Readonly()
	 *   tags!: string[];
	 * }
	 *
	 * const p = await Payload.from({ tags: ["a", "b"] });
	 * // p.tags[0] = "x" -> runtime error (frozen)
	 * ```
	 */
	export function Readonly(message = "could not coerce to readonly") {
		return Custom((value) => {
			// Only apply to tables
			if (isNil(value)) return { ok: true, value };
			if (!typeIs(value, "table")) return { ok: false, message };

			return { ok: true, value: deepFreeze(value) };
		});
	}

	/**
	 * Coerces values into a number.
	 *
	 * Behavior:
	 * - `nil` -> unchanged
	 * - `number` -> unchanged
	 * - `string` -> trims leading/trailing whitespace, then `tonumber(trimmed)`
	 * - anything else -> error
	 *
	 * ## Example
	 * ```ts
	 * class Stats {
	 *   @Coerce.Number()
	 *   hp!: number;
	 * }
	 *
	 * // { hp: 10 }      -> 10
	 * // { hp: " 10 " }  -> 10
	 * // { hp: "nope" }  -> error
	 * ```
	 */
	export function Number(message = "could not coerce to number") {
		return Custom((value) => {
			if (isNil(value)) {
				return { ok: true, value };
			}

			if (typeIs(value, "number")) {
				return { ok: true, value };
			}

			if (typeIs(value, "string")) {
				const s = (value as string).gsub("^%s+", "")[0].gsub("%s+$", "")[0];
				const n = tonumber(s);
				return n !== undefined ? { ok: true, value: n } : { ok: false, message };
			}

			return { ok: false, message };
		});
	}

	/**
	 * Coerces values into a boolean.
	 *
	 * Behavior:
	 * - `nil` -> unchanged
	 * - `boolean` -> unchanged
	 * - `string` -> case-insensitive trim then:
	 *   - `"true"` or `"1"`  -> `true`
	 *   - `"false"` or `"0"` -> `false`
	 *   - otherwise -> error
	 * - anything else -> error
	 *
	 * ## Example
	 * ```ts
	 * class Flags {
	 *   @Coerce.Boolean()
	 *   enabled!: boolean;
	 * }
	 *
	 * // { enabled: true }       -> true
	 * // { enabled: " TRUE " }   -> true
	 * // { enabled: "0" }        -> false
	 * // { enabled: "yes" }      -> error (by design)
	 * ```
	 */
	export function Boolean(message = "could not coerce to boolean") {
		return Custom((value) => {
			if (isNil(value)) {
				return { ok: true, value };
			}

			if (typeIs(value, "boolean")) {
				return { ok: true, value };
			}

			if (typeIs(value, "string")) {
				const s = (value as string).lower().gsub("^%s+", "")[0].gsub("%s+$", "")[0];
				if (s === "true" || s === "1") return { ok: true, value: true };
				if (s === "false" || s === "0") return { ok: true, value: false };

				return { ok: false, message };
			}

			return { ok: false, message };
		});
	}
}
