import { TransformFn } from "../types";
import { isNil, pushTransform } from "./primitives";

export namespace Transform {
	export function Custom(fn: TransformFn) {
		return (target: object, propertyKey: string) => pushTransform(target, propertyKey, fn);
	}

	/** Runs fn(value) and replaces the value. */
	export function Map(mapper: (value: unknown) => unknown) {
		return Custom((value) => ({ ok: true, value: mapper(value) }));
	}

	/** String transforms */
	export function Trim(message = "must be a string") {
		return Custom((value) => {
			if (isNil(value)) return { ok: true, value };
			if (!typeIs(value, "string")) return { ok: false, message };
			return { ok: true, value: (value as string).gsub("^%s+", "")[0].gsub("%s+$", "")[0] };
		});
	}

	export function Lowercase(message = "must be a string") {
		return Custom((value) => {
			if (isNil(value)) return { ok: true, value };
			if (!typeIs(value, "string")) return { ok: false, message };
			return { ok: true, value: (value as string).lower() };
		});
	}

	export function Uppercase(message = "must be a string") {
		return Custom((value) => {
			if (isNil(value)) return { ok: true, value };
			if (!typeIs(value, "string")) return { ok: false, message };
			return { ok: true, value: (value as string).upper() };
		});
	}

	/** Table/array transforms */
	export function ArrayMap(
		mapper: (value: unknown, index: number) => unknown,
		message = "must be an array",
	) {
		return Custom((value) => {
			if (isNil(value)) return { ok: true, value };
			if (!typeIs(value, "table")) return { ok: false, message };

			// assumes Luau array-like {1..n}
			const arr = value as unknown[];
			const out: defined[] = [];
			for (let i = 0; i < arr.size(); i += 1) {
				out[i] = mapper(arr[i], i + 1) as defined;
			}
			return { ok: true, value: out as unknown[] };
		});
	}
}
