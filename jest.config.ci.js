const mainJestConfig = require('./jest.config');

module.exports = Object.assign({}, mainJestConfig, {
  collectCoverageFrom: ["build/lib/**/*.js"],
  moduleFileExtensions: ['js'],
  preset: null,
  roots: ['build/lib']
});
