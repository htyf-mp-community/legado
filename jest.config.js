module.exports = {
  testEnvironment: 'node',
  watchman: false,
  transform: {'^.+\\.[jt]sx?$': 'babel-jest'},
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  moduleNameMapper: {'^cheerio$': '<rootDir>/node_modules/cheerio/dist/commonjs/load-parse.js'},
};
