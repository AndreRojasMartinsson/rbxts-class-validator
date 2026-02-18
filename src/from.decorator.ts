import { assertParsed, parseInto } from "./validation";

type Ctor<T = object> = new (...args: any[]) => T;
type AbstractCtor<T = object> = abstract new (...args: any[]) => T;
type Primitive = string | number | boolean | bigint | symbol | null | undefined;

// Treat these as terminal leaves (=> any)
type TerminalObject =
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

export function WithFrom<TBase extends AbstractCtor<object>>(Base: TBase) {
	abstract class WithFromClass extends Base {
		static async from<TThis extends AbstractCtor<object>>(
			this: TThis,
			plain: any,
		): Promise<InstanceType<TThis>> {
			const instance = new (this as unknown as Ctor<InstanceType<TThis>>)();

			const res = parseInto(instance, plain as unknown as Record<string, unknown>);

			return assertParsed(res) as InstanceType<TThis>;
		}
	}
	return WithFromClass as unknown as TBase & {
		from<TThis extends AbstractCtor<object>>(this: TThis, plain: any): Promise<InstanceType<TThis>>;
	};
}
