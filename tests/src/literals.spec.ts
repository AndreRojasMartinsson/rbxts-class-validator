import { Fact, Assert } from "@rbxts/runit";
import { IsLiteral, IsTemplateLiteral, validate } from "../../src";

class LiteralDto {
	@IsLiteral("car", "bike")
	public kind!: string;

	@IsLiteral(0, 1)
	public bit!: number;

	@IsTemplateLiteral("user:${number}")
	public key!: string;

	@IsTemplateLiteral("zone:${int}:${string}")
	public zone!: string;
}

class LiteralsTest {
	// --- isLiteral_strings (formerly @Theory) ---

	@Fact
	public isLiteral_strings_ok_car() {
		const dto = new LiteralDto();
		dto.kind = "car" as never;
		dto.bit = 0 as never;
		dto.key = "user:1" as never;
		dto.zone = "zone:1:Downtown" as never;

		const errs = validate(dto);
		Assert.empty(errs);
	}

	@Fact
	public isLiteral_strings_ok_bike() {
		const dto = new LiteralDto();
		dto.kind = "bike" as never;
		dto.bit = 0 as never;
		dto.key = "user:1" as never;
		dto.zone = "zone:1:Downtown" as never;

		const errs = validate(dto);
		Assert.empty(errs);
	}

	@Fact
	public isLiteral_strings_fail_plane() {
		const dto = new LiteralDto();
		dto.kind = "plane" as never;
		dto.bit = 0 as never;
		dto.key = "user:1" as never;
		dto.zone = "zone:1:Downtown" as never;

		const errs = validate(dto);
		Assert.notEmpty(errs);
	}

	// --- isLiteral_numbers (formerly @Theory) ---

	@Fact
	public isLiteral_numbers_ok_0() {
		const dto = new LiteralDto();
		dto.kind = "car" as never;
		dto.bit = 0 as never;
		dto.key = "user:1" as never;
		dto.zone = "zone:1:Downtown" as never;

		const errs = validate(dto);
		Assert.empty(errs);
	}

	@Fact
	public isLiteral_numbers_ok_1() {
		const dto = new LiteralDto();
		dto.kind = "car" as never;
		dto.bit = 1 as never;
		dto.key = "user:1" as never;
		dto.zone = "zone:1:Downtown" as never;

		const errs = validate(dto);
		Assert.empty(errs);
	}

	@Fact
	public isLiteral_numbers_fail_2() {
		const dto = new LiteralDto();
		dto.kind = "car" as never;
		dto.bit = 2 as never;
		dto.key = "user:1" as never;
		dto.zone = "zone:1:Downtown" as never;

		const errs = validate(dto);
		Assert.notEmpty(errs);
	}

	// --- templateLiteral_userNumber (formerly @Theory) ---

	@Fact
	public templateLiteral_userNumber_ok_user_123() {
		const dto = new LiteralDto();
		dto.kind = "car" as never;
		dto.bit = 0 as never;
		dto.key = "user:123" as never;
		dto.zone = "zone:1:Downtown" as never;

		const errs = validate(dto);
		Assert.empty(errs);
	}

	@Fact
	public templateLiteral_userNumber_ok_user_minus5_5() {
		const dto = new LiteralDto();
		dto.kind = "car" as never;
		dto.bit = 0 as never;
		dto.key = "user:-5.5" as never;
		dto.zone = "zone:1:Downtown" as never;

		const errs = validate(dto);
		Assert.empty(errs);
	}

	@Fact
	public templateLiteral_userNumber_fail_user_abc() {
		const dto = new LiteralDto();
		dto.kind = "car" as never;
		dto.bit = 0 as never;
		dto.key = "user:abc" as never;
		dto.zone = "zone:1:Downtown" as never;

		const errs = validate(dto);
		Assert.notEmpty(errs);
	}

	@Fact
	public templateLiteral_userNumber_fail_xuser_1() {
		const dto = new LiteralDto();
		dto.kind = "car" as never;
		dto.bit = 0 as never;
		dto.key = "xuser:1" as never;
		dto.zone = "zone:1:Downtown" as never;

		const errs = validate(dto);
		Assert.notEmpty(errs);
	}

	// --- templateLiteral_zone (formerly @Theory) ---

	@Fact
	public templateLiteral_zone_ok_zone_12_downtown() {
		const dto = new LiteralDto();
		dto.kind = "car" as never;
		dto.bit = 0 as never;
		dto.key = "user:1" as never;
		dto.zone = "zone:12:Downtown" as never;

		const errs = validate(dto);
		Assert.empty(errs);
	}

	@Fact
	public templateLiteral_zone_ok_zone_minus1_west() {
		const dto = new LiteralDto();
		dto.kind = "car" as never;
		dto.bit = 0 as never;
		dto.key = "user:1" as never;
		dto.zone = "zone:-1:West" as never;

		const errs = validate(dto);
		Assert.empty(errs);
	}

	@Fact
	public templateLiteral_zone_fail_zone_1_missingSegment() {
		const dto = new LiteralDto();
		dto.kind = "car" as never;
		dto.bit = 0 as never;
		dto.key = "user:1" as never;
		dto.zone = "zone:1" as never;

		const errs = validate(dto);
		Assert.notEmpty(errs);
	}

	@Fact
	public templateLiteral_zone_fail_zone_x_downtown() {
		const dto = new LiteralDto();
		dto.kind = "car" as never;
		dto.bit = 0 as never;
		dto.key = "user:1" as never;
		dto.zone = "zone:x:Downtown" as never;

		const errs = validate(dto);
		Assert.notEmpty(errs);
	}

	@Fact
	public templateLiteral_rejectsNonString() {
		const dto = new LiteralDto();
		dto.kind = "car" as never;
		dto.bit = 0 as never;
		dto.key = 123 as never;
		dto.zone = "zone:1:X" as never;

		const errs = validate(dto);
		Assert.notEmpty(errs);
		Assert.equal("key", errs[0].property);
	}
}

export = LiteralsTest;
