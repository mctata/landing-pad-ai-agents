/**
 * Test Database Setup
 * 
 * This file contains utilities for setting up and tearing down
 * an in-memory MongoDB database for testing.
 */

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongod = null;

/**
 * Connect to the in-memory database.
 */
module.exports.connect = async () => {
  if (!mongod) {
    mongod = await MongoMemoryServer.create();
  }
  
  const uri = mongod.getUri();

  const mongooseOpts = {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  };

  // Set the connection in the global space for tests
  global.__MONGO_URI__ = uri;
  
  // Connect mongoose
  await mongoose.connect(uri, mongooseOpts);
};

/**
 * Drop database, close the connection and stop mongod.
 */
module.exports.closeDatabase = async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
  }
  
  if (mongod) {
    await mongod.stop();
    mongod = null;
  }
};

/**
 * Remove all the data for all db collections.
 */
module.exports.clearDatabase = async () => {
  if (mongoose.connection.readyState !== 0) {
    const collections = mongoose.connection.collections;

    for (const key in collections) {
      const collection = collections[key];
      await collection.deleteMany();
    }
  }
};