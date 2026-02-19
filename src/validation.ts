import { Reflect } from "@flamework/core";
import { CoerceFn, TransformFn, ValidationError, ValidatorContext, ValidatorFn } from "./types";
import {
	META_COERCE_KEY,
	META_KEY,
	META_MARKER_KEY,
	META_OPT_KEY,
	META_TRANSFORM_KEY,
} from "./constants";
import { isNil } from "./validators/primitives";
import { HttpService } from "@rbxts/services";
import { getAllowedKeys } from "./helpers";

export function validate(obj: object): ValidationError[] {
	const errors: ValidationError[] = [];

	const props = Reflect.getProperties(obj);

	for (const property of props) {
		if (!Reflect.hasMetadata(obj, META_MARKER_KEY, property)) continue;

		let value = (obj as Record<never, never>)[property as never] as unknown;
		const ctx: ValidatorContext = { object: obj, property, value };

		// Coerce (pre-parse)
		const coercer = Reflect.getMetadata<CoerceFn>(obj, META_COERCE_KEY, property);
		if (coercer !== undefined) {
			const res = coercer(value, ctx);
			if (!res.ok) {
				errors.push({ property, value, constraints: [res.message] });
				continue;
			}

			value = res.value;
			(obj as Record<never, never>)[property as never] = value as never;

			ctx.value = value;
		}

		const optional = Reflect.getMetadata<boolean>(obj, META_OPT_KEY, property) ?? false;
		if (optional && isNil(value)) {
			continue;
		}

		// Validate
		const validators = Reflect.getMetadata<ValidatorFn[]>(obj, META_KEY, property) ?? [];
		const constraints: string[] = [];

		for (const fn of validators) {
			const msg = fn(value, ctx);
			if (msg !== undefined) constraints.push(msg);
		}

		if (constraints.size() > 0) {
			errors.push({ property, value, constraints });
			continue;
		}

		// Transform
		const transforms = Reflect.getMetadata<TransformFn[]>(obj, META_TRANSFORM_KEY, property) ?? [];
		for (const tf of transforms) {
			const res = tf(value, ctx);
			if (!res.ok) {
				errors.push({ property, value, constraints: [res.message] });
				break;
			}

			value = res.value;
			(obj as Record<never, never>)[property as never] = value as never;
			ctx.value = value;
		}
	}

	return errors;
}

/**
 * Parse + validate + transform from a plain object, but DON'T mutate target until success.
 * This is what WithFrom.from() should use.
 *
 * Keeps extra keys from `plain`
 * but ensures decorated props are coerced/validated/transformed before commit.
 */
export function parseInto<T extends object>(
	target: T,
	plain: Record<string, unknown>,
): { ok: true; value: T } | { ok: false; errors: ValidationError[] } {
	const errors: ValidationError[] = [];

	const allowed = getAllowedKeys(target);

	const staged: Record<string, unknown> = {};

	// Start with a copy of input (so extra keys survive)
	for (const [k, v] of pairs(plain as object)) {
		const key = k as string;
		if (!allowed.has(key)) {
			errors.push({ property: key, value: v, constraints: [`unknown property: "${key}"`] });
			continue;
		}

		staged[key] = v as unknown;
	}

	if (errors.size() > 0) return { ok: false, errors };

	const props = Reflect.getProperties(target);

	for (const property of props) {
		if (!Reflect.hasMetadata(target, META_MARKER_KEY, property)) continue;

		let value = staged[property] as unknown;
		const ctx: ValidatorContext = { object: target, property, value };

		const coercer = Reflect.getMetadata<CoerceFn>(target, META_COERCE_KEY, property);
		if (coercer !== undefined) {
			const res = coercer(value, ctx);
			if (!res.ok) {
				errors.push({ property, value, constraints: [res.message] });
				continue;
			}
			value = res.value;
			ctx.value = value;
		}

		const optional = Reflect.getMetadata<boolean>(target, META_OPT_KEY, property) ?? false;
		if (optional && isNil(value)) {
			staged[property] = undefined;
			continue;
		}

		// Validate (on coerced value)
		const validators = Reflect.getMetadata<ValidatorFn[]>(target, META_KEY, property) ?? [];
		const constraints: string[] = [];

		for (const fn of validators) {
			const msg = fn(value, ctx);
			if (msg !== undefined) constraints.push(msg);
		}

		if (constraints.size() > 0) {
			errors.push({ property, value, constraints });
			continue;
		}

		// Transform only after validation passes
		const transforms =
			Reflect.getMetadata<TransformFn[]>(target, META_TRANSFORM_KEY, property) ?? [];
		for (const tf of transforms) {
			const res = tf(value, ctx);
			if (!res.ok) {
				errors.push({ property, value, constraints: [res.message] });
				break;
			}
			value = res.value;
			ctx.value = value;
		}

		if (errors.size() > 0 && errors[errors.size() - 1].property === property) {
			continue;
		}

		staged[property] = value;
	}

	if (errors.size() > 0) return { ok: false, errors };

	for (const [k, v] of pairs(staged as object)) {
		(target as Record<string, unknown>)[k as string] = v as unknown;
	}

	return { ok: true, value: target };
}

export function assertValid(obj: object): void {
	const errs = validate(obj);
	if (errs.size() === 0) return;

	const lines = errs.map(
		(e) =>
			`${"\t".rep(5)}${e.property}: ${HttpService.JSONEncode(e.value)} -> ${e.constraints.join(", ")}`,
	);

	error(`Validation failed:\n${lines.join("\n")}`);
}

export function assertParsed<T extends object>(
	res: { ok: true; value: T } | { ok: false; errors: ValidationError[] },
): T {
	if (res.ok) return res.value;

	const lines = res.errors.map(
		(e) =>
			`${"\t".rep(5)}${e.property}: ${HttpService.JSONEncode(e.value)} -> ${e.constraints.join(", ")}`,
	);

	error(`Validation failed:\n${lines.join("\n")}`);
}
