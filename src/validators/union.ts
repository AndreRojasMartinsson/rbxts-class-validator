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

	const errs = validate(instance);
	if (errs.size() === 0) return { ok: true as const };

	return { ok: false as const, message: formatErrors(errs) };
}

/**
 * Union validator: passes if **ANY** provided schema matches.
 *
 * This is the logical **OR** of schemas.
 *
 * The validator tries each schema in order and stops at the first successful match.
 * If all variants fail, it returns a combined error describing why each variant failed.
 *
 * ## What counts as a "schema"?
 * `SchemaLike` is whatever `validateAgainstSchema(...)` supports, typically:
 * - a class (DTO) with validators
 * - a predicate-style function schema
 * - other schema adapters you’ve implemented
 *
 * ## Behavior
 * - `nil` passes (no error). Use required validators if needed.
 * - Runs `validateAgainstSchema(s, value, ctx)` for each schema `s`.
 * - If any schema returns `{ ok: true }`, the union passes.
 * - If none match, returns:
 *   `must match one of the union variants (reasonA / reasonB / ...)`
 *
 * ## Examples
 * ### Two DTO variants
 * ```ts
 * class CarDto { @IsNumber() hp!: number; }
 * class BikeDto { @IsInteger() gear!: number; }
 *
 * class Vehicle {
 *   @Union(CarDto, BikeDto)
 *   blud!: CarDto | BikeDto;
 * }
 * ```
 *
 * ### Mix predicate + DTO
 * ```ts
 * const IsHello = (v: unknown) =>
 *   typeIs(v, "string") && v === "hello" ? undefined : "must be 'hello'";
 *
 * class Wrapper {
 *   @Union(IsHello, CarDto)
 *   thing!: unknown;
 * }
 * ```
 *
 * ## Notes
 * - Union is *non-exclusive*: it’s fine if multiple variants would match; it passes on the first match.
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
 * Exclusive union (XOR) validator: passes if **EXACTLY ONE** schema matches.
 *
 * This is the logical **XOR** of schemas.
 *
 * ## Behavior
 * - `nil` passes (no error).
 * - Validates against each schema and counts how many match.
 * - If `matches === 1`, passes.
 * - If `matches === 0`, fails with combined reasons for why each variant failed.
 * - If `matches > 1`, fails with a message indicating how many matched.
 *
 * ## Examples
 * ### Prevent ambiguous matches
 * ```ts
 * class A { @IsString() kind!: string; }
 * class B { @IsString() kind!: string; }
 *
 * class Example {
 *   // Will fail if both A and B would validate successfully.
 *   @ExclusiveUnion(A, B)
 *   value!: XOR<A, B>;
 * }
 * ```
 *
 * ### Common pattern: “one of these shapes, but not both”
 * ```ts
 * class ById   { @IsString() id!: string; }
 * class ByName { @IsString() name!: string; }
 *
 * class Query {
 *   @ExclusiveUnion(ById, ByName)
 *   selector!: XOR<ById, ByName>;
 * }
 * ```
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
 * Intersection validator: passes if **ALL** schemas match.
 *
 * This is the logical **AND** of schemas.
 *
 * The validator checks every schema and accumulates failure reasons.
 * It only succeeds if *none* of the schemas report an error.
 *
 * ## Behavior
 * - `nil` passes (no error).
 * - Runs every schema; does not short-circuit on failure.
 * - If any schema fails, returns:
 *   `must satisfy all intersected schemas (reasonA / reasonB / ...)`
 *
 * ## Examples
 * ### Require multiple constraints at once
 * ```ts
 * class HasId   { @IsString() id!: string; }
 * class HasName { @IsString() name!: string; }
 *
 * class User {
 *   @Intersect(HasId, HasName)
 *   data!: unknown; // must satisfy both shapes
 * }
 * ```
 *
 * ### Combine predicate + DTO
 * ```ts
 * const IsNonEmpty = (v: unknown) =>
 *   typeIs(v, "string") && v.size() > 0 ? undefined : "must be non-empty";
 *
 * class NameField {
 *   @Intersect(IsNonEmpty, (v) => (typeIs(v, "string") ? undefined : "must be string"))
 *   name!: unknown;
 * }
 * ```
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
 * Discriminated union validator: selects a schema based on a discriminator field.
 *
 * You provide:
 * - `discriminator`: the property name to read (e.g. `"type"` or `"tag"`)
 * - `map`: a record mapping discriminator strings to schemas
 *
 * The validator:
 * 1) ensures the value is a table/object,
 * 2) reads `value[discriminator]`,
 * 3) picks the schema from `map`,
 * 4) validates against that schema.
 *
 * ## Behavior
 * - `nil` passes (no error).
 * - Non-table values fail with `"must be an object"`.
 * - If discriminator missing or not a string, fails with `message`.
 * - If discriminator string not found in `map`, fails with `message`.
 * - If schema validation fails, returns the underlying schema error if available, else `message`.
 *
 * ## Important: allowing the discriminator key
 * You call:
 * ```ts
 * validateAgainstSchema(schema, value, ctx, { allowKeys: [discriminator] })
 * ```
 * This is useful when the object validator rejects "unknown keys":
 * it ensures the discriminator itself doesn’t get flagged as an extra/unexpected key while validating the variant.
 *
 * ## Example
 * ```ts
 * class CarDto {
 *   @IsLiteral("car")
 *   type!: "car";
 *
 *   @IsNumber()
 *   hp!: number;
 * }
 *
 * class BikeDto {
 *   @IsLiteral("bike")
 *   type!: "bike";
 *
 *   @IsInteger()
 *   gear!: number;
 * }
 *
 * class Vehicle {
 *   @DiscriminatedUnion("type", {
 *     car: CarDto,
 *     bike: BikeDto,
 *   })
 *   dto!: Discriminated<"type", {car: CarDto, bike: BikeDto}>;
 * }
 * ```
 *
 * ## Example: custom message
 * ```ts
 * @DiscriminatedUnion("kind", { a: A, b: B }, 'kind must be "a" or "b"')
 * ```
 *
 * ## Notes
 * - This validator does not coerce the discriminator. If you want coercion (e.g. numbers to strings),
 *   handle it in coercion phase or via a custom coercer.
 * - If you also validate the discriminator inside the DTO (like `@IsLiteral("car")`),
 *   you get a stronger guarantee that the payload cannot “lie” about its tag.
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
