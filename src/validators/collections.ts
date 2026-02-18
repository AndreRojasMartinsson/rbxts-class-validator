import { isNonArrayTable } from "../helpers";
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

export function IsReadonly(message = "must be frozen") {
	return ValidateBy("IsReadonly", (value) => {
		if (isNil(value)) return undefined;
		if (!typeIs(value, "table")) return message;

		return isDeepFrozen(value) ? undefined : message;
	});
}

/**
 * Record = non-array table with string keys.
 * (Think "object/dictionary" in JSON terms.)
 */
export function IsRecord(message = "must be a record") {
	return ValidateBy("IsRecord", (value) => {
		if (!isNonArrayTable(value)) return message;

		for (const [k] of pairs(value as object)) {
			if (!typeIs(k, "string")) return message;
		}

		return undefined;
	});
}

/**
 * Validate every (key, value) entry of a Record (string keys only).
 *
 * keyValidator: (key, value) => string | undefined
 * valueValidator: (value, key) => string | undefined
 */
export function RecordEntries(
	keyValidator?: (key: string, value: unknown) => string | undefined,
	valueValidator?: (value: unknown, key: string) => string | undefined,
	message = "record entries invalid",
) {
	return ValidateBy("RecordEntries", (value) => {
		if (!isNonArrayTable(value)) return "must be a record";

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
 * Map = non-array table with any key type.
 * Useful if you want number keys, instance keys, etc.
 */
export function IsMap(message = "must be a map") {
	return ValidateBy("IsMap", (value) => {
		if (!isNonArrayTable(value)) return message;
		return undefined;
	});
}

/**
 * Validate every (key, value) entry of a Map (any key type).
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
 * Set = non-array table where keys are elements and values are true (or 1).
 * Example:
 *  tags = { admin = true, mod = true }
 *  ids  = { [123] = true, [456] = true }
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
