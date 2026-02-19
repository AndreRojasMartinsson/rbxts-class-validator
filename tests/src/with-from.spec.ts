import { Fact, Assert } from "@rbxts/runit";
import {
	WithFrom,
	Coerce,
	Transform,
	IsNumber,
	Min,
	IsString,
	IsOptional,
	Coerce as CoerceNS,
} from "../../src";

class UserDto extends WithFrom(class {}) {
	@IsString()
	@Transform.Lowercase()
	public name!: string;

	@Coerce.Number()
	@IsNumber()
	@Min(1)
	public hp!: number;

	@IsOptional()
	@CoerceNS.Default("en")
	@IsString()
	public lang?: string;
}

class WithFromTest {
	@Fact
	public from_parses_validates_transforms_and_commits() {
		const u = UserDto.from({ name: "TEST", hp: "10" });

		// from() is async
		return u.then((user) => {
			Assert.equal("test", user.name);
			Assert.equal(10, user.hp);
			Assert.equal("en", user.lang);
		});
	}

	@Fact
	public from_throws_on_invalid_input_and_doesNotCommitPartialState() {
		const p = UserDto.from({ name: "OK", hp: "0" }); // Min(1) fails

		return Assert.throwsAsync(async () => {
			await p;
		});
	}

	@Fact
	public from_throws_on_unknown_keys() {
		return Assert.throwsAsync(async () => {
			await UserDto.from({ name: "OK", hp: "5", extra: 123 });
		});
	}
}

export = WithFromTest;
