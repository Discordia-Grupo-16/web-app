// Jest has no native AsyncStorage: every test uses the in-memory mock the library ships.
module.exports = require('@react-native-async-storage/async-storage/jest/async-storage-mock');
