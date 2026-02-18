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

export type XOR<T, U> = T | U extends object ? (Without<T, U> & U) | (Without<U, T> & T) : T | U;

export type Without<T, U> = {
	[K in Exclude<keyof T, keyof U>]?: never;
};

export type PropertyKey = string | number;

export type Discriminated<D extends PropertyKey, M extends Record<PropertyKey, object>> = {
	[K in keyof M]: M[K] & Record<D, K>;
}[keyof M];
