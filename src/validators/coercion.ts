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

export namespace Coerce {
	export function Custom(fn: CoerceFn) {
		return (target: object, propertyKey: string) => setCoercer(target, propertyKey, fn);
	}

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

	export function Readonly(message = "could not coerce to readonly") {
		return Custom((value) => {
			// Only apply to tables
			if (isNil(value)) return { ok: true, value };
			if (!typeIs(value, "table")) return { ok: false, message };

			return { ok: true, value: deepFreeze(value) };
		});
	}

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
