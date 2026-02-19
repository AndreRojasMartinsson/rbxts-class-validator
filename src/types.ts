export type ValidatorFn = (value: unknown, ctx: ValidatorContext) => string | undefined;

export type CoerceFn = (
	value: unknown,
	ctx: ValidatorContext,
) => { ok: true; value: unknown } | { ok: false; message: string };

export interface ValidatorContext {
	object: object;
	property: string;
	value: unknown;
}

export type TransformFn = (
	value: unknown,
	ctx: ValidatorContext,
) => { ok: true; value: unknown } | { ok: false; message: string };

export interface ValidationError {
	property: string;
	value: unknown;
	constraints: string[];
}

export type Placeholder = "string" | "number" | "int" | "boolean";

export type TupleElementValidator = (value: unknown, index: number) => string | undefined;

export type SchemaLike =
	| ((value: unknown, ctx: ValidatorContext) => string | undefined)
	| { new (): object };

/**
 * Builds an **exclusive-or (XOR)** type between two object types `T` and `U`.
 *
 * XOR means:
 * - You can have **T** *or* **U**
 * - but you cannot have **both at the same time**
 *
 * This is commonly used for API inputs where you want *exactly one* of two shapes:
 * - `{ id: string }` XOR `{ name: string }`
 * - `{ token: string }` XOR `{ username: string; password: string }`
 *
 * ## How it works (conceptually)
 * For object types, XOR is implemented as:
 * - `(Without<T, U> & U) | (Without<U, T> & T)`
 *
 * Where `Without<A, B>` removes keys from `A` that also exist in `B`,
 * typically by making them `never` (so they can’t be provided).
 *
 * That produces two valid branches:
 * 1) "U-only" branch: `U` plus “forbid keys from T that collide with U”
 * 2) "T-only" branch: `T` plus “forbid keys from U that collide with T”
 *
 * For non-object types, XOR falls back to a simple union (`T | U`).
 *
 * ## Required helper: `Without`
 * A typical `Without` looks like:
 * ```ts
 * type Without<T, U> = { [P in Exclude<keyof T, keyof U>]?: never };
 * ```
 * (Or equivalently: keys in `T` that are not in `U` become optional `never`.)
 *
 * ## Examples
 * ### Auth payload
 * ```ts
 * type PasswordAuth = { email: string; password: string };
 * type TokenAuth = { token: string };
 *
 * type Auth = XOR<PasswordAuth, TokenAuth>;
 * ```
 *
 * ## Notes / gotchas
 * - XOR is best for **object** types. For primitives, it becomes `T | U`.
 * - Optional properties can sometimes make "neither" accidentally allowed.
 *   Example: `XOR<{ a?: string }, { b?: string }>` allows `{}` because each side is satisfiable.
 *   If you need “exactly one *present*”, make at least one distinguishing key required.
 * - Intersections and index signatures can interact in surprising ways; test with real call sites.
 */
export type XOR<T, U> = T | U extends object ? (Without<T, U> & U) | (Without<U, T> & T) : T | U;

export type Without<T, U> = {
	[K in Exclude<keyof T, keyof U>]?: never;
};

export type PropertyKey = string | number;

/**
 * Builds a **tagged / discriminated union** type from:
 * - a discriminator key `D` (property name), and
 * - a map `M` of variant names -> variant object shapes.
 *
 * It produces a union where each variant:
 * - keeps its original fields (`M[K]`), and
 * - is augmented with the discriminator property `D` whose value is exactly the variant key `K`.
 *
 * In other words, for each key `K` in `M`, you get:
 * ```ts
 * M[K] & Record<D, K>
 * ```
 * and then all of those are unioned together.
 *
 * ## Why this is useful
 * - Enables TypeScript to narrow using `if (x.type === "car") { ... }`.
 * - Ensures each variant *must* carry the correct discriminator value.
 * - Keeps the "variant map" as the single source of truth.
 *
 * ## Example: classic vehicle union
 * ```ts
 * type Vehicle = Discriminated<"type", {
 *   car:  { hp: number; wheels: 4 };
 *   bike: { gear: number; pedalling: boolean };
 * }>;
 *
 * // Vehicle is:
 * // | { hp: number; wheels: 4; type: "car" }
 * // | { gear: number; pedalling: boolean; type: "bike" }
 *
 * function describe(v: Vehicle) {
 *   if (v.type === "car") {
 *     // v is narrowed to the car variant here
 *     return v.hp;
 *   }
 *   // v is narrowed to the bike variant here
 *   return v.gear;
 * }
 * ```
 *
 * ## Example: using `as const` keys for stronger inference
 * ```ts
 * const variants = {
 *   create: { name: "" as string },
 *   delete: { id: "" as string },
 * } as const;
 *
 * type Cmd = Discriminated<"op", typeof variants>;
 *
 * // Cmd:
 * // | { name: string; op: "create" }
 * // | { id: string;   op: "delete" }
 * ```
 *
 * ## Notes / gotchas
 * - `D extends PropertyKey` allows `"type"`, `symbol`, or numeric keys, but in practice
 *   discriminators are almost always string keys.
 * - `M extends Record<PropertyKey, object>` requires each variant payload to be an object.
 * - If a variant already defines the discriminator property `D`, the intersection will
 *   combine them. If the existing type for `D` is incompatible with `K`, it becomes `never`
 *   (which is usually what you want: it forces correctness).
 */
export type Discriminated<D extends PropertyKey, M extends Record<PropertyKey, object>> = {
	[K in keyof M]: M[K] & Record<D, K>;
}[keyof M];

export type Ctor<T = object> = new (...args: any[]) => T;
export type AbstractCtor<T = object> = abstract new (...args: any[]) => T;
export type Primitive = string | number | boolean | bigint | symbol | null | undefined;

// Treat these as terminal leaves (=> any)
export type TerminalObject =
	| Map<any, any>
	| ReadonlyMap<any, any>
	| Set<any>
	| ReadonlySet<any>
	| WeakMap<any, any>
	| WeakSet<any>
	| Promise<any>;

export type DeepAnyLeaves<T> =
	// Leaves -> any
	T extends Primitive
		? any
		: // terminal objects -> any
			T extends TerminalObject
			? any
			: // Keep functions
				T extends (...args: any[]) => any
				? T
				: // Arrays/tuples -> recurse element type
					T extends readonly (infer U)[]
					? DeepAnyLeaves<U>[]
					: // Objects -> recurse props
						T extends object
						? { [K in keyof T]?: DeepAnyLeaves<T[K]> }
						: // Fallback
							any;

export type AnyPlainOf<T extends object> = DeepAnyLeaves<T>;
