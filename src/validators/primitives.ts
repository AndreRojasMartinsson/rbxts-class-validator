import { Reflect } from "@flamework/core";
import { CoerceFn, TransformFn, ValidatorFn } from "../types";
import {
	META_COERCE_KEY,
	META_KEY,
	META_MARKER_KEY,
	META_OPT_KEY,
	META_TRANSFORM_KEY,
} from "../constants";

export function pushValidator(target: object, propertyKey: string, fn: ValidatorFn) {
	const current = Reflect.getMetadata<ValidatorFn[]>(target, META_KEY, propertyKey) ?? [];
	current.push(fn);

	Reflect.defineMetadata(target, META_KEY, current, propertyKey);
	Reflect.defineMetadata(target, META_MARKER_KEY, true, propertyKey);
}

export function pushTransform(target: object, propertyKey: string, fn: TransformFn) {
	const current = Reflect.getMetadata<TransformFn[]>(target, META_TRANSFORM_KEY, propertyKey) ?? [];
	current.push(fn);

	Reflect.defineMetadata(target, META_TRANSFORM_KEY, current, propertyKey);
	Reflect.defineMetadata(target, META_MARKER_KEY, true, propertyKey);
}

export function setOptional(target: object, propertyKey: string) {
	Reflect.defineMetadata(target, META_OPT_KEY, true, propertyKey);
	Reflect.defineMetadata(target, META_MARKER_KEY, true, propertyKey);
}

export function setCoercer(target: object, propertyKey: string, fn: CoerceFn) {
	Reflect.defineMetadata(target, META_COERCE_KEY, fn, propertyKey);
	Reflect.defineMetadata(target, META_MARKER_KEY, true, propertyKey);
}

export function isNil(v: unknown) {
	return v === undefined;
}

export function IsOptional() {
	return (target: object, propertyKey: string) => {
		setOptional(target, propertyKey);
	};
}

export function ValidateBy(name: string, fn: ValidatorFn) {
	return (target: object, propertyKey: string) => {
		pushValidator(target, propertyKey, (value, ctx) => fn(value, ctx));
		Reflect.defineMetadata(target, `app:validators:${name}`, true, propertyKey);
	};
}

export function IsBoolean(message = "must be a boolean") {
	return ValidateBy("IsBoolean", (value) => (typeIs(value, "boolean") ? undefined : message));
}
