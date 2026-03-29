module.exports = {
  testEnvironment: "node",
  testMatch: ["**/tests/**/*.test.js"],
  collectCoverage: false,
  collectCoverageFrom: [
    "server/**/*.js",
    "!server/public/**",
    "!server/data/**"
  ],
  coverageThreshold: {
    global: {
      statements: 50,
      branches: 25,
      functions: 30,
      lines: 50,
    },
  },
  coverageDirectory: "coverage",
  coverageProvider: "v8",
};
