# @rbxts/class-validator

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
