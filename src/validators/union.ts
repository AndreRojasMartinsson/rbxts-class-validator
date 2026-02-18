import { Reflect } from "@flamework/core";
import { formatErrors } from "../helpers";
import { SchemaLike, ValidatorContext } from "../types";
import { validate } from "../validation";
import { isNil, ValidateBy } from "./primitives";

function validateAgainstSchema(
	schema: SchemaLike,
	value: unknown,
	ctx: ValidatorContext,
	opts?: { allowKeys?: string[] },
) {
	if (typeIs(schema, "function")) {
		const msg = schema(value, ctx);
		return msg === undefined ? { ok: true as const } : { ok: false as const, message: msg };
	}

	if (!typeIs(value, "table")) {
		return { ok: false as const, message: "must be an object" };
	}

	const Ctor = schema as unknown as { new (): object };
	const instance = new Ctor();

	const allow = new Set<string>(opts?.allowKeys ?? []);

	const allowed = new Set<string>();
	for (const p of Reflect.getProperties(instance)) allowed.add(p);

	const unknown: string[] = [];
	for (const [k, v] of pairs(value as object)) {
		const key = k as string;
		if (!allowed.has(key) && !allow.has(key)) {
			unknown.push(key);
			continue;
		}

		// Only assign keys that the instance actually has
		// (don’t assign discriminator onto the DTO instance)
		if (allowed.has(key)) {
			(instance as Record<never, never>)[key as never] = v as never;
		}
	}

	if (unknown.size() > 0) {
		return {
			ok: false as const,
			message: `unknown properties: ${unknown.sort().join(", ")}`,
		};
	}

	// for (const [k, v] of pairs(value as object)) {
	// 	(instance as Record<never, never>)[k as never] = v as never;
	// }

	const errs = validate(instance);
	if (errs.size() === 0) return { ok: true as const };

	return { ok: false as const, message: formatErrors(errs) };
}

/**
 * Union: passes if ANY schema matches.
 *
 * Usage:
 *  @Union(A, B)
 *  @Union(A, B, "must be A or B")
 *  @Union((v)=>..., SomeClass)
 */
export function Union(...schemas: SchemaLike[]) {
	return ValidateBy("Union", (value, ctx) => {
		if (isNil(value)) return undefined;

		const reasons: string[] = [];

		for (const s of schemas) {
			const res = validateAgainstSchema(s, value, ctx);
			if (res.ok) return undefined;
			reasons.push(res.message ?? "did not match");
		}

		return `must match one of the union variants (${reasons.join(" / ")})`;
	});
}

/**
 * Exclusive union (XOR): passes if EXACTLY ONE schema matches.
 *
 * Usage:
 *  @ExclusiveUnion(A, B)
 *  @ExclusiveUnion(A, B, "must be exactly one of A or B")
 */
export function ExclusiveUnion(...schemas: SchemaLike[]) {
	return ValidateBy("ExclusiveUnion", (value, ctx) => {
		if (isNil(value)) return undefined;

		let matches = 0;
		const reasons: string[] = [];

		for (const s of schemas) {
			const res = validateAgainstSchema(s, value, ctx);
			if (res.ok) matches += 1;
			else reasons.push(res.message ?? "did not match");
		}

		if (matches === 1) return undefined;

		if (matches === 0)
			return `must match exactly one variant (matched none: ${reasons.join(" / ")})`;
		return `must match exactly one variant (matched ${matches})`;
	});
}

/**
 * Intersect: passes if ALL schemas match.
 *
 * Usage:
 *  @Intersect(A, B)
 *  @Intersect(A, B, "must satisfy A and B")
 */
export function Intersect(...schemas: SchemaLike[]) {
	return ValidateBy("Intersect", (value, ctx) => {
		if (isNil(value)) return undefined;

		const reasons: string[] = [];

		for (const s of schemas) {
			const res = validateAgainstSchema(s, value, ctx);
			if (!res.ok) reasons.push(res.message ?? "did not match");
		}

		return reasons.size() === 0
			? undefined
			: `must satisfy all intersected schemas (${reasons.join(" / ")})`;
	});
}

/**
 * Discriminated union: chooses schema by `discriminator` field.
 *
 * Usage:
 *  @DiscriminatedUnion("type", {
 *    car: CarDto,
 *    bike: BikeDto,
 *  })
 *
 * Optional custom message as last param.
 */
export function DiscriminatedUnion(
	discriminator: string,
	map: Record<string, SchemaLike>,
	message = `invalid discriminator "${discriminator}"`,
) {
	return ValidateBy("DiscriminatedUnion", (value, ctx) => {
		if (isNil(value)) return undefined;
		if (!typeIs(value, "table")) return "must be an object";

		const discValue = (value as unknown as Record<string, unknown>)[discriminator];
		if (!typeIs(discValue, "string")) return message;

		const schema = map[discValue as string];
		if (schema === undefined) return message;

		const res = validateAgainstSchema(schema, value, ctx, { allowKeys: [discriminator] });
		return res.ok ? undefined : (res.message ?? message);
	});
}
