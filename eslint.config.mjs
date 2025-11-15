import js from "@eslint/js";
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import globals from "globals";
import prettierConfig from "eslint-config-prettier";

// List of files/directories to ignore
const ignores = [
	"**/.vscode/",
	"**/archive/",
	"**/dist/",
	"**/node_modules/",
	"**/bot.js",
];

export default [
	{
		ignores,
	},

	// Base JS rules
	js.configs.recommended,

	// TypeScript rules
	{
		files: ["**/*.ts", "**/*.tsx"],
		languageOptions: {
			parser: tsParser,
			parserOptions: {
				ecmaVersion: "latest",
				sourceType: "module",
			},
			globals: {
				...globals.node,
				NodeJS: true,
			},
		},
		plugins: {
			"@typescript-eslint": tsPlugin,
		},
		rules: {
			"no-case-declarations": "off",
			"no-unused-vars": "off",
			"@typescript-eslint/no-unused-vars": [
				"warn",
				{
					argsIgnorePattern: "^_",
					varsIgnorePattern: "^_",
				},
			],
		},
	},

	// Disable formatting rules that conflict with Prettier
	prettierConfig,
];
