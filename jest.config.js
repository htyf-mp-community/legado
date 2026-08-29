module.exports = {
  testEnvironment: 'node',
  watchman: false,
  transform: {'^.+\\.[jt]sx?$': 'babel-jest'},
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
};
