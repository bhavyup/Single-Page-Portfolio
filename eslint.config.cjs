module.exports = [
  {
    files: ["server/**/*.js", "tests/**/*.js"],
    ignores: ["server/public/admin/**"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "commonjs",
      globals: {
        Buffer: "readonly",
        __dirname: "readonly",
        console: "readonly",
        module: "readonly",
        process: "readonly",
        require: "readonly",
      },
    },
    rules: {
      "no-undef": "error",
      "no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],
      eqeqeq: ["error", "always"],
    },
  },
  {
    files: ["tests/**/*.js"],
    languageOptions: {
      globals: {
        afterEach: "readonly",
        afterAll: "readonly",
        beforeEach: "readonly",
        beforeAll: "readonly",
        describe: "readonly",
        expect: "readonly",
        jest: "readonly",
        test: "readonly",
      },
    },
  },
  {
    files: ["server/public/admin/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",
      globals: {
        FormData: "readonly",
        HTMLElement: "readonly",
        atob: "readonly",
        btoa: "readonly",
        clearTimeout: "readonly",
        document: "readonly",
        fetch: "readonly",
        setTimeout: "readonly",
        window: "readonly",
      },
    },
    rules: {
      "no-undef": "error",
      "no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],
      eqeqeq: ["error", "always"],
    },
  },
];
