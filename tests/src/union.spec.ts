import { Fact, Assert } from "@rbxts/runit";
import {
	Union,
	ExclusiveUnion,
	Intersect,
	DiscriminatedUnion,
	IsString,
	IsNumber,
	Min,
	validate,
} from "../../src";

class ADto {
	@IsString()
	public a!: string;
}

class BDto {
	@IsNumber()
	@Min(1)
	public b!: number;
}

class UnionHost {
	@Union(ADto, BDto)
	public u!: unknown;

	@ExclusiveUnion(ADto, BDto)
	public x!: unknown;

	@Intersect(
		(v) => (typeIs(v, "table") ? undefined : "must be table"),
		(v) => ((v as Record<string, unknown>).ok === true ? undefined : "ok must be true"),
	)
	public both!: unknown;

	@DiscriminatedUnion("tag", {
		a: ADto,
		b: BDto,
	})
	public disc!: unknown;
}

class UnionTest {
	@Fact
	public union_acceptsEitherVariant() {
		const host = new UnionHost();

		host.u = { a: "hello" } as never;
		let errs = validate(host);
		Assert.empty(errs);

		host.u = { b: 5 } as never;
		errs = validate(host);
		Assert.empty(errs);
	}

	@Fact
	public union_rejectsWhenNoVariantMatches() {
		const host = new UnionHost();
		host.u = { b: 0 } as never; // fails Min(1)

		const errs = validate(host);
		Assert.notEmpty(errs);
		Assert.equal("u", errs[0].property);
	}

	@Fact
	public exclusiveUnion_rejectsWhenBothMatch() {
		// If both DTOs could match, XOR should fail.
		// Here they *don't* overlap, so we simulate overlap by giving both required keys.
		class OverlapA {
			@IsString()
			public x!: string;
		}
		class OverlapB {
			@IsString()
			public x!: string;
		}
		class Host {
			@ExclusiveUnion(OverlapA, OverlapB)
			public v!: unknown;
		}

		const h = new Host();
		h.v = { x: "hi" } as never;

		const errs = validate(h);
		Assert.notEmpty(errs);
	}

	@Fact
	public intersect_requiresAllSchemas() {
		const host = new UnionHost();

		host.both = { ok: true } as never;
		let errs = validate(host);
		Assert.empty(errs);

		host.both = { ok: false } as never;
		errs = validate(host);
		Assert.notEmpty(errs);
		Assert.equal("both", errs[0].property);
	}

	@Fact
	public discriminatedUnion_selectsByTag_andAllowsTagKey() {
		const host = new UnionHost();

		host.disc = { tag: "a", a: "hello" } as never;
		let errs = validate(host);
		Assert.empty(errs);

		host.disc = { tag: "b", b: 2 } as never;
		errs = validate(host);
		Assert.empty(errs);
	}

	@Fact
	public discriminatedUnion_rejectsUnknownKeysWithinVariant() {
		const host = new UnionHost();
		host.disc = { tag: "a", a: "hello", extra: 1 } as never;

		const errs = validate(host);
		Assert.notEmpty(errs);
		Assert.equal("disc", errs[0].property);
	}
}

export = UnionTest;
