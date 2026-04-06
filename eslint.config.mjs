import js from "@eslint/js";
import prettierConfig from "eslint-config-prettier";
import globals from "globals";

const nonJSPaths = [
  "bundle/**",
  "devTemp/**",
  "docs/**",
  "fonts/**",
  "icons/**",
  "lang/**",
  "lazy/**",
  "libs/**",
  "packs/**",
  "styles/**",
  "templates/**",
  "test/**",
  "tools/**",
  "node_modules/**",
  "modules/tables/source/**",
  "modules/tours/en/**",
  "modules/tours/de/**"
];

/** Foundry VTT globals provided at runtime. */
const foundryGlobals = [
  "_del",
  "_loc",
  "_replace",
  "ActiveEffect",
  "Actor",
  "ActorDelta",
  "Application",
  "AudioHelper",
  "canvas",
  "ChatMessage",
  "Combat",
  "Combatant",
  "CombatantGroup",
  "Compendium",
  "CONFIG",
  "CONST",
  "Dialog",
  "Folder",
  "foundry",
  "fromUuid",
  "fromUuidSync",
  "game",
  "getDocumentClass",
  "Handlebars",
  "Hooks",
  "Item",
  "JournalEntry",
  "JournalEntryPage",
  "Macro",
  "PIXI",
  "Playlist",
  "readTextFromFile",
  "Roll",
  "saveDataToFile",
  "Scene",
  "TextEditor",
  "Token",
  "TokenDocument",
  "ui",
  "User"
].reduce((obj, key) => {
  obj[key] = "readonly";
  return obj;
}, {});

export default [
  { ignores: nonJSPaths },
  js.configs.recommended,
  prettierConfig,
  {
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.jquery,
        ...foundryGlobals
      }
    },
    rules: {
      "no-unused-vars": ["warn", { args: "none", caughtErrors: "none", varsIgnorePattern: "^_" }],
      "no-case-declarations": "off",
      "no-template-curly-in-string": "warn",
      "no-unmodified-loop-condition": "warn",
      "no-unreachable-loop": "warn",
      "no-duplicate-imports": ["warn", { includeExports: true }],
      "no-self-compare": "warn",
      "prefer-const": ["warn", { destructuring: "all" }]
    }
  }
];
