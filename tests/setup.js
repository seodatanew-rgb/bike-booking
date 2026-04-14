const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

let mongod;

// Start in-memory MongoDB before all tests
beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  process.env.MONGO_URI    = uri;
  process.env.JWT_SECRET   = 'test_secret_key_for_jest';
  process.env.JWT_EXPIRES_IN = '1d';
  process.env.NODE_ENV     = 'test';
  await mongoose.connect(uri);
});

// Clean all collections between each test file
afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

// Stop server after all tests
afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});
