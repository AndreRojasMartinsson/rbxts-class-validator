
<img width="100%" alt="@rbxts/class-validator banner" src="https://github.com/user-attachments/assets/975be317-efc4-41a9-af38-17d88b787e47" />

# @rbxts/class-validator



[![Tests](https://github.com/AndreRojasMartinsson/rbxts-class-validator/actions/workflows/test.yml/badge.svg?branch=main)](https://github.com/AndreRojasMartinsson/rbxts-class-validator/actions/workflows/test.yml)
[![Coverage Status](https://coveralls.io/repos/github/AndreRojasMartinsson/rbxts-class-validator/badge.svg)](https://coveralls.io/github/AndreRojasMartinsson/rbxts-class-validator)

A tiny, decorator-based validation + coercion + transform library for roblox-ts / Luau,
heavily inspired by how class-validator does validation and "Zod-ish" pipelines.
https://github.com/typestack/class-validator

It lets you define DTO-style classes with decorators like `@IsString()`, `@Min(0)`, `@Coerce.Number()`, `@Transform.Lowercase()`, then validate existing instances (`assertValid`) or safely parse plain objects into instances (`WithFrom.from()`).

--------------

## Features
* Decorators for validation rules (strings, numbers, arrays, objects, collections, literals)
* Coercion phase (pre-parse): convert incoming values into expected runtime shape
* Validation phase: collect constraint errors per property
* Transform phase (post-validate): normalize values after they’ve been proven valid
* `WithFrom()` mixin: `YourDto.from(plain)` -> parse + validate + transform without partial mutation
* Strict object parsing: rejects unknown keys during from() / parseInto()
* Union helpers:
    * @Union(...) (OR)
    * @ExclusiveUnion(...) (XOR)
    * @Intersect(...) (AND)
    * @DiscriminatedUnion("tag", { ... })
* Collection helpers:
    * @IsRecord(), @RecordEntries(...)
    * @IsMap(), @MapEntries(...)
    * @IsSet(), @SetElements(...)
    * @IsReadonly() (deep frozen tables)
* Type utilities:
    * XOR<T, U>
    * Discriminated<"tag", {...}>
    * AnyPlainOf<T> (deep “shape-preserving” input typing with any leaves)

--------------

## Install

This package is uses Flamework to handle reflections. You should refer to the Flamework documentation for installation steps.

Run:
```bash
$ npm install @rbxts/class-validator
```

```bash
$ bun add @rbxts/class-validator
```

```bash
$ pnpm add @rbxts/class-validator
```


--------------

## Quick start


```typescript
import { WithFrom, assertValid, Coerce, Transform, IsString, IsNumber, Min } from "@rbxts/class-validator";

export class UserDto extends WithFrom(class {}) {
  @IsString()
  @Transform.Trim()
  @Transform.Lowercase()
  username!: string;

  @Coerce.Number()
  @IsNumber()
  @Min(0)
  coins!: number;
}

// Parse from a plain object (safe: rejects unknown keys, doesn’t partially mutate on failure)
const user = await UserDto.from({
  username: "  TestUser  ",
  coins: "50",
});

// Validate an already-existing instance (mutates values as it validates/transforms)
// NOTE: Really not necessary in this case since *.from* already validates and transforms instance.
assertValid(user);
```

--------------

## Example use-case

### ORM-like datastoreservice.

src/users.entity.ts
```typescript
import {
	Coerce,
	IsBoolean,
	IsInteger,
	IsNumber,
	IsOptional,
	Max,
	Min,
} from "@rbxts/class-validator";
import { Entity, WithOrm } from "...";

@Entity("users")
export class Users extends WithOrm(class {}) {
	@IsNumber()
	@Max(50_000)
	@Min(-50_000)
	balance!: number;

	@IsInteger()
	@Max(3_000)
	@Min(0)
	cash!: number;

	@IsBoolean()
	@IsOptional()
	@Coerce.Default(false)
	banned?: boolean;
}
```

src/...some-file
```typescript
await Users.insert("test_key", {
   balance: 50.25,
	cash: 2,
	banned: true,
});

const userModel = await Users.select("test_key");
print("Result", userModel, userModel.balance);
```

Implementation:
```typescript
import { Reflect } from "@flamework/core";
import { AbstractCtor, assertParsed, assertValid, Ctor, parseInto } from "@rbxts/class-validator";
import { DataStoreService } from "@rbxts/services";

const META_ENTITY_KEY = "orm:entity"

/** @metadata reflect identifier flamework:parameters */
export function Entity(storeMappingName: string) {
	/** @metadata reflect identifier flamework:parameters */
	return (target: object) => {
		Reflect.defineMetadata(target, META_ENTITY_KEY, storeMappingName);
	};
}

export function WithOrm<TBase extends AbstractCtor<object>>(Base: TBase) {
	abstract class WithOrmClass extends Base {
		/**
         * Selects a key in the datastore and
         * validates against model *automagically*
         */
        static async select<TThis extends AbstractCtor<object>>(
			this: TThis,
			key: string,
		): Promise<InstanceType<TThis> | undefined> {
			const instance = new (this as unknown as Ctor<InstanceType<TThis>>)();

			const storeName = Reflect.getMetadata<string | undefined>(this, META_ENTITY_KEY);
			if (storeName === undefined) {
				return undefined;
			}

			const store = DataStoreService.GetDataStore(storeName);

			const [success, data] = pcall(() => {
				return store.GetAsync(key);
			});

			if (!success) {
				error(data);
			}

			const res = parseInto(instance, data as unknown as Record<string, unknown>);
			return assertParsed(res) as InstanceType<TThis>;
		}
        /**
         * Inserts a key in the datastore with the following payload and
         * validates against model *automagically*
         */
		static async insert<TThis extends AbstractCtor<object>>(
			this: TThis,
			key: string,
			payload: InstanceType<TThis>,
		): Promise<void> {
			const instance = new (this as unknown as Ctor<InstanceType<TThis>>)();

			const storeName = Reflect.getMetadata<string | undefined>(this, META_ENTITY_KEY);
			if (storeName === undefined) {
				return;
			}

			const props = Reflect.getProperties(payload);

			let data: InstanceType<TThis>;

			if (props.size() === 0) {
				// Plain object
                // Transforms into the Entity
                // to allow plain objects to be validated and inserted.
				const parsedInto = parseInto(instance, payload as unknown as Record<string, unknown>);
				const obj = assertParsed(parsedInto) as InstanceType<TThis>;

				data = obj;
			} else {
				assertValid(payload);
				data = payload as InstanceType<TThis>;
			}

			const store = DataStoreService.GetDataStore(storeName);

			const [success] = pcall(() => {
				return store.UpdateAsync(key, () => {
					return [{...data}] as LuaTuple<[InstanceType<TThis>]>;
				});
			});

			if (!success) {
				error(data);
			}
		}
	}
	return WithOrmClass as unknown as TBase & {
		select<TThis extends AbstractCtor<object>>(
			this: TThis,
			key: string,
		): Promise<InstanceType<TThis> | undefined>;

	
		insert<TThis extends AbstractCtor<object>>(
			this: TThis,
			key: string,
			payload: InstanceType<TThis>,
		): Promise<void>;
	};
}
```

--------------

## Pipeline model

Each decorated property can participate in up to three phases:
1. Coerce (optional): pre-parse conversion (e.g., "10" → 10)
2. Validate (optional): constraint checks (e.g., must be number, must be >= 0)
3. Transform (optional): post-validate normalization (e.g., trim/lowercase, map arrays)

### Important behavior notes

* Coerce.*() does not validate; it only attempts to convert.
* Transform.*() runs only after validation passes for that property.

* @IsOptional() causes nil/undefined to skip validation + transform for that property.
* WithFrom.from() uses parseInto() which:
    * rejects unknown keys (strict),
    * stages changes, and only commits to the instance if everything passes.

--------------

## API

### Validation entrypoints
`validate(obj) -> ValidationError[]`
Returns an array of { property, value, constraints: string[] }.

`assertValid(obj)`
Throws if validate(obj) returns errors.

`parseInto(target, plain) -> { ok: true, value } | { ok: false, errors }`
Parses a plain object into an existing instance without partial mutation.

`WithFrom(Base)`
Adds a typed `static from(plain)` constructor that uses parseInto() + assertParsed().

--------------

### Validators

#### Primitives
* @IsString()
* @IsNumber()
* @IsInteger()
* @IsBoolean()
* @IsOptional()
* @Min(n), @Max(n)
* @MinLength(n), @MaxLength(n)

#### Objects / arrays / tuples

* @Nested() - runs validate() on a nested DTO/table
* @IsArray()
* @ArrayMinSize(n), @ArrayMaxSize(n)
* @ArrayElements((value, index) => string | undefined)
* @IsTuple(...elementValidators)
* @TupleLength(n)

#### Literals / template-like strings

* @IsLiteral(...allowed)
* @IsTemplateLiteral("user:${int}:${string}")

#### Collections

* @IsRecord(), @RecordEntries(keyValidator?, valueValidator?, message?)
* @IsMap(), @MapEntries(keyValidator?, valueValidator?, message?)
* @IsSet(), @SetElements(elementValidator, message?)
* @IsReadonly() - validates deep frozen tables via table.isfrozen recursion

#### Unions

* @Union(A, B, ...) - passes if any schema matches
* @ExclusiveUnion(A, B, ...) - passes if exactly one schema matches
* @Intersect(A, B, ...) - passes if all schemas match
* @DiscriminatedUnion("tag", { car: CarDto, bike: BikeDto })

Schemas can be either:
* a DTO class `({ new(): object })`
* a predicate function `(value, ctx) => string | undefined`

--------------

#### Coercion

Coercers run before validators and can replace the incoming value.

Built-ins:
* @Coerce.String()
* @Coerce.Number()
* @Coerce.Boolean()
* @Coerce.Default(valueOrFactory) - only applies when property is optional and value is nil
* @Coerce.Readonly() - deep freezes tables (recursive table.freeze)

Example:
```typescript
export class Settings extends WithFrom(class {}) {
  @IsOptional()
  @Coerce.Default("en")
  @IsString()
  lang?: string;

  @Coerce.Boolean()
  @IsBoolean()
  enabled!: boolean;
}
```

--------------

#### Transforms

Transforms run after validation succeeds for a property.

Built-ins:
* @Transform.Map(fn)
* @Transform.Trim()
* @Transform.Lowercase()
* @Transform.Uppercase()
* @Transform.ArrayMap((value, index) => next)

Example:
```typescript
export class Profile extends WithFrom(class {}) {
  @IsString()
  @Transform.Trim()
  @Transform.Lowercase()
  email!: string;

  @IsArray()
  @Transform.ArrayMap((v) => tostring(v))
  tags!: string[];
}
```

--------------

#### Discriminated unions (example)
```typescript
import { Discriminated, DiscriminatedUnion, IsInteger, IsLiteral, IsNumber } from "@rbxts/class-validator";

export class CarDto extends WithFrom(class {}) {
  @IsNumber()
  hp!: number;

  @IsInteger()
  gear!: number;
}

export class BikeDto extends WithFrom(class {}) {
  @IsInteger()
  gear!: number;
}

export class Vehicle extends WithFrom(class {}) {
  @DiscriminatedUnion("tag", {
    car: CarDto,
    bike: BikeDto,
  })
  dto!: Discriminated<"tag", { car: CarDto; bike: BikeDto }>;
}

const v = await Vehicle.from({
  dto: { tag: "car", hp: 250, gear: 4 },
});
```

--------------

### Error output

`assertValid()` / `assertParsed()` throw with a readable message like:

```
Validation failed:
          coins: "nope" -> must be a number, must be >= 0
          username: "" -> must have length >= 3
```

(Formatting is currently JSON-based via HttpService.JSONEncode.)

--------------

### Extending

#### Add a custom validator
```typescript
import { ValidateBy } from "@rbxts/class-validator";

export function IsEven(message = "must be even") {
  return ValidateBy("IsEven", (value) => {
    if (!typeIs(value, "number")) return message;
    return (value as number) % 2 === 0 ? undefined : message;
  });
}
```

#### Add a custom coercer
```typescript
import { Coerce } from "@rbxts/class-validator";

export function CoerceJson(message = "could not parse json") {
  return Coerce.Custom((value) => {
    if (!typeIs(value, "string")) return { ok: false, message };
    const ok = pcall(() => game.GetService("HttpService").JSONDecode(value as string));
    if (!ok[0]) return { ok: false, message };
    return { ok: true, value: ok[1] };
  });
}
```
