import { AbstractCtor, Ctor } from "./types";
import { assertParsed, parseInto } from "./validation";

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
