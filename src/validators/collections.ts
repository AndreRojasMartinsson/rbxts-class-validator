import { isEmptyTable, isNonArrayTable } from "../helpers";
import { isNil, ValidateBy } from "./primitives";

function isDeepFrozen<T extends object>(obj: T, seen?: Set<T>): boolean {
	seen ??= new Set();

	if (seen.has(obj)) {
		return true;
	}

	seen.add(obj);

	if (!table.isfrozen(obj)) {
		return false;
	}

	for (const [k, v] of pairs(obj)) {
		if (typeIs(k, "table")) {
			if (!isDeepFrozen(k, seen)) {
				return false;
			}
		}

		if (typeIs(v, "table")) {
			if (!isDeepFrozen(v, seen)) {
				return false;
			}
		}
	}

	return true;
}

/**
 * Validates that a value is a *deeply frozen* Luau table (recursively read-only).
 *
 * This validator is meant to pair nicely with `@Coerce.Readonly()`, which deep-freezes
 * a table during the coercion phase.
 *
 * Behavior:
 * - `nil` passes (no error) - use a required validator if you need it present.
 * - Non-table values fail.
 * - Tables pass only if `isDeepFrozen(value)` returns true.
 *
 * ## Common usage
 * ```ts
 * class Payload {
 *   @Coerce.Readonly()
 *   @IsReadonly()
 *   data!: Record<string, unknown>;
 * }
 * ```
 *
 * ## Notes
 * - `table.freeze()` in Luau is shallow; `isDeepFrozen()` should check recursively.
 * - If you only want *shallow* frozen validation, use `table.isfrozen()` directly.
 */
export function IsReadonly(message = "must be frozen") {
	return ValidateBy("IsReadonly", (value) => {
		if (isNil(value)) return undefined;
		if (!typeIs(value, "table")) return message;

		return isDeepFrozen(value) ? undefined : message;
	});
}

/**
 * Validates that a value is a "Record":
 * a **non-array** table whose keys are **strings**.
 *
 * Think of this as a JSON object / dictionary:
 * ```lua
 * { name = "Some name", role = "admin" }
 * ```
 *
 * Behavior:
 * - Fails if `value` is not a non-array table (arrays/tuples are rejected).
 * - Fails if any key is not a string.
 *
 * ## Example
 * ```ts
 * class User {
 *   @IsRecord()
 *   meta!: Record<string, unknown>;
 * }
 *
 * // Works: { meta: { name: "A", level: 3 } }
 * // Fails: { meta: [1,2,3] }           (array)
 * // Fails: { meta: { [1]: "nope" } }   (non-string key)
 * ```
 *
 * ## Tip
 * Combine with `@RecordEntries()` to validate each key/value entry.
 */
export function IsRecord(message = "must be a record") {
	return ValidateBy("IsRecord", (value) => {
		if (!typeIs(value, "table")) return message;
		if (!isEmptyTable(value) && !isNonArrayTable(value)) return message;

		for (const [k] of pairs(value as object)) {
			if (!typeIs(k, "string")) return message;
		}

		return undefined;
	});
}

/**
 * Validates every entry `(key, value)` of a Record (string keys only).
 *
 * A Record here is a non-array table with **string keys**.
 *
 * You can validate:
 * - keys via `keyValidator(key, value)` (useful for key formats like `"foo.bar"`),
 * - values via `valueValidator(value, key)` (useful for per-field validation),
 * - or both.
 *
 * The first failing entry returns an error message with context.
 *
 * Behavior:
 * - If the input is not a record, it fails with `"must be a record"`.
 * - If a key is not a string, it fails with `"must be a record"`.
 * - If `keyValidator` fails, you get: `${message} (key "<k>": <reason>)`
 * - If `valueValidator` fails, you get: `${message} (at "<k>": <reason>)`
 *
 * ## Example: validate keys + values
 * ```ts
 * class Config {
 *   @RecordEntries(
 *     (k) => (k.match("^[a-z][a-z0-9_]*$")[0] ? undefined : "bad key format"),
 *     (v, k) => (typeIs(v, "number") ? undefined : `expected number for ${k}`),
 *     "config invalid",
 *   )
 *   config!: Record<string, unknown>;
 * }
 *
 * // { config: { maxPlayers: 12 } } -> Success
 * // { config: { ["MaxPlayers"]: 12 } } -> Error: key format
 * // { config: { maxPlayers: "12" } } -> Error: value type
 * ```
 *
 * ## Example: value-only validation (common)
 * ```ts
 * class Labels {
 *   @RecordEntries(undefined, (v) => (typeIs(v, "string") ? undefined : "must be string"))
 *   labels!: Record<string, unknown>;
 * }
 * ```
 */
export function RecordEntries(
	keyValidator?: (key: string, value: unknown) => string | undefined,
	valueValidator?: (value: unknown, key: string) => string | undefined,
	message = "record entries invalid",
) {
	return ValidateBy("RecordEntries", (value) => {
		if (!typeIs(value, "table")) return message;
		if (!isEmptyTable(value) && !isNonArrayTable(value)) return message;

		for (const [k, v] of pairs(value as object)) {
			if (!typeIs(k, "string")) return "must be a record";

			if (keyValidator) {
				const msg = keyValidator(k as string, v);
				if (msg !== undefined) return `${message} (key "${k}": ${msg})`;
			}

			if (valueValidator) {
				const msg = valueValidator(v, k as string);
				if (msg !== undefined) return `${message} (at "${k}": ${msg})`;
			}
		}

		return undefined;
	});
}

/**
 * Validates that a value is a "Map":
 * a **non-array** table (keys can be any type).
 *
 * This is useful when you intentionally want:
 * - number keys: `{ [123] = "a", [456] = "b" }`
 * - instance keys (Roblox objects) as keys
 * - mixed keys
 *
 * Behavior:
 * - Fails if `value` is not a non-array table.
 * - Does not validate key/value shapes - use `@MapEntries()` for that.
 *
 * ## Example
 * ```ts
 * class Store {
 *   @IsMap()
 *   counts!: { [key: number]: number }; // runtime: non-array table
 * }
 *
 * // Success: { counts: { [1]: 10, [2]: 20 } }
 * // Fails: { counts: [10, 20] } (array)
 * ```
 */
export function IsMap(message = "must be a map") {
	return ValidateBy("IsMap", (value) => {
		if (!isNonArrayTable(value)) return message;
		return undefined;
	});
}

/**
 * Validates every entry `(key, value)` of a Map (any key type allowed).
 *
 * Provide:
 * - `keyValidator(key, value)` to validate keys,
 * - `valueValidator(value, key)` to validate values,
 * - or both.
 *
 * The first failing entry returns an error message with context.
 *
 * Behavior:
 * - If input is not a non-array table, fails with `"must be a map"`.
 * - If `keyValidator` fails, you get: `${message} (bad key: <reason>)`
 * - If `valueValidator` fails, you get: `${message} (at <key>: <reason>)`
 *
 * ## Example: numeric keys, numeric values
 * ```ts
 * class Heatmap {
 *   @MapEntries(
 *     (k) => (typeIs(k, "number") ? undefined : "expected numeric key"),
 *     (v) => (typeIs(v, "number") ? undefined : "expected number value"),
 *     "heatmap invalid",
 *   )
 *   heat!: object; // runtime map table
 * }
 * ```
 *
 * ## Example: instance keys (Roblox objects)
 * ```ts
 * class Ownership {
 *   @MapEntries(
 *     (k) => (typeIs(k, "Instance") ? undefined : "expected Instance key"),
 *     (v) => (typeIs(v, "string") ? undefined : "expected string owner id"),
 *   )
 *   ownerByPart!: object;
 * }
 * ```
 */
export function MapEntries(
	keyValidator?: (key: unknown, value: unknown) => string | undefined,
	valueValidator?: (value: unknown, key: unknown) => string | undefined,
	message = "map entries invalid",
) {
	return ValidateBy("MapEntries", (value) => {
		if (!isNonArrayTable(value)) return "must be a map";

		for (const [k, v] of pairs(value as object)) {
			if (keyValidator) {
				const msg = keyValidator(k, v);
				if (msg !== undefined) return `${message} (bad key: ${msg})`;
			}

			if (valueValidator) {
				const msg = valueValidator(v, k);
				if (msg !== undefined) return `${message} (at ${tostring(k)}: ${msg})`;
			}
		}

		return undefined;
	});
}

/**
 * Validates that a value is a Set:
 * a **non-array** table where the **keys are the elements** and
 * the values are `true` (or `1`).
 *
 * Example set tables:
 * ```lua
 * { admin = true, mod = true }
 * { [123] = true, [456] = 1 }
 * ```
 *
 * Behavior:
 * - Fails if input is not a non-array table.
 * - Fails if any value is not `true` and not `1`.
 *
 * ## Example
 * ```ts
 * class Access {
 *   @IsSet()
 *   roles!: object; // runtime set table
 * }
 *
 * // Success: { roles: { admin: true, mod: true } }
 * // Success: { roles: { [123]: 1 } }
 * // Error: { roles: { admin: "yes" } }
 * // Error: { roles: ["admin", "mod"] } (array)
 * ```
 */
export function IsSet(message = "must be a set") {
	return ValidateBy("IsSet", (value) => {
		if (!isNonArrayTable(value)) return message;

		for (const [, v] of pairs(value as object)) {
			// allow true or 1 (handy if people build sets from counts)
			if (v !== true && v !== 1) return message;
		}

		return undefined;
	});
}

/**
 * Validates each element in a Set (the *keys*).
 *
 * A Set is a non-array table where values are `true` (or `1`) and keys are elements.
 * This validator applies `elementValidator(element)` to each key.
 *
 * Behavior:
 * - If input is not a set-like table, fails with `"must be a set"`.
 * - If any element fails `elementValidator`, returns:
 *   `${message} (at <element>: <reason>)`
 *
 * ## Example: require string elements matching a pattern
 * ```ts
 * class Tags {
 *   @SetElements((el) => {
 *     if (!typeIs(el, "string")) return "must be a string";
 *     return (el as string).match("^[a-z_]+$")[0] ? undefined : "bad tag";
 *   })
 *   tags!: object; // runtime set table
 * }
 * ```
 *
 * ## Example: numeric id set
 * ```ts
 * class Group {
 *   @SetElements((el) => (typeIs(el, "number") ? undefined : "id must be number"))
 *   memberIds!: object;
 * }
 * ```
 */
export function SetElements(
	elementValidator: (element: unknown) => string | undefined,
	message = "set elements invalid",
) {
	return ValidateBy("SetElements", (value) => {
		if (!isNonArrayTable(value)) return "must be a set";

		for (const [k, v] of pairs(value as object)) {
			if (v !== true && v !== 1) return "must be a set";

			const msg = elementValidator(k);
			if (msg !== undefined) return `${message} (at ${tostring(k)}: ${msg})`;
		}

		return undefined;
	});
}
