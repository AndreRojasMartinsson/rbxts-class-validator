import { Fact, Assert } from "@rbxts/runit";
import {
	Coerce,
	IsReadonly,
	IsRecord,
	RecordEntries,
	IsMap,
	MapEntries,
	IsSet,
	SetElements,
	validate,
	parseInto,
} from "../../src";

class CollectionsDto {
	@IsRecord()
	public rec!: Record<string, unknown>;

	@RecordEntries(
		(k) => (k.match("^[a-z_]+$")[0] ? undefined : "bad key"),
		(v) => (typeIs(v, "number") ? undefined : "must be number"),
		"rec invalid",
	)
	public rec2!: Record<string, unknown>;

	@IsMap()
	public map!: object;

	@MapEntries(
		(k) => (typeIs(k, "string") ? undefined : "key must be string"),
		(v) => (typeIs(v, "number") ? undefined : "value must be number"),
		"map invalid",
	)
	public map2!: object;

	@IsSet()
	public set!: object;

	@SetElements((el) => (typeIs(el, "string") ? undefined : "must be string"), "set invalid")
	public set2!: object;

	@Coerce.Readonly()
	@IsReadonly()
	public frozen!: object;
}

class CollectionsTest {
	@Fact
	public isRecord_rejectsArrays() {
		const dto = new CollectionsDto();
		dto.rec = [1, 2, 3] as never;

		const errs = validate(dto);
		Assert.notEmpty(errs);
		Assert.equal("rec", errs[1].property);
	}

	@Fact
	public recordEntries_reportsBadKeyOrValue() {
		const dto = new CollectionsDto();
		dto.rec2 = { ["BadKey"]: 1 } as never;

		const errs = validate(dto);
		Assert.notEmpty(errs);
		Assert.equal("rec2", errs[5].property);
	}

	@Fact
	public mapEntries_validatesKeyAndValue() {
		const dto = new CollectionsDto();
		dto.map2 = { ["x"]: "ok" } as never;

		const errs = validate(dto);
		Assert.notEmpty(errs);
		Assert.equal("map2", errs[4].property);
	}

	@Fact
	public isSet_rejectsNonTrueValues() {
		const dto = new CollectionsDto();
		dto.set = { admin: "yes" } as never;

		const errs = validate(dto);
		Assert.notEmpty(errs);
		Assert.equal("set", errs[2].property);
	}

	@Fact
	public setElements_validatesKeys() {
		const dto = new CollectionsDto();
		dto.set2 = { [123]: true } as never;

		const errs = validate(dto);
		Assert.notEmpty(errs);
		Assert.equal("set2", errs[3].property);
	}
}

export = CollectionsTest;
