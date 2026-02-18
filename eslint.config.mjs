// @ts-check
import eslint from "@eslint/js";
import roblox from "eslint-plugin-roblox-ts";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier/flat";

export default defineConfig(
	{
		ignores: [
			"node_modules",
			"out",
			"include",
			".git",
			"bun.lock",
			"eslint.config.mjs",
			"**/*.luau",
			"**/*.lua",
			"**/*.rbxl",
			"**/*.rbxlx",
		],
	},
	prettier,
	roblox.configs.recommended,
	eslint.configs.recommended,
	tseslint.configs.strictTypeChecked,
	{
		languageOptions: {
			parserOptions: {
				projectService: true,
			},
		},
	},
	{
		files: ["**/*.js", "**/*.mjs"],
		extends: [tseslint.configs.disableTypeChecked],
	},
	{
		rules: {
			"roblox-ts/no-any": ["error", { fixToUnknown: true }],
		},
	},
);
