// In this file you can configure migrate-mongo
require('dotenv').config();

const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/landing_pad_ai_agents';

const config = {
  mongodb: {
    url: mongoURI,
    databaseName: "landing_pad_ai_agents",
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    }
  },

  // The migrations dir, can be an relative or absolute path. 
  // Only edit this if you specified a different directory when calling 
  // migrate-mongo create or migrate-mongo init
  migrationsDir: "migrations/scripts",

  // The mongodb collection where the applied changes are stored. 
  // Only edit this if you have a good reason to.
  changelogCollectionName: "migrations_changelog",
  
  // The file extension to create migrations and search for in migration directory 
  migrationFileExtension: ".js",
  
  // Enable the algorithm to create a checksum of the file contents and use that in the comparison to determine
  // if the file should be run.  Requires that scripts are coded to be run multiple times.
  useFileHash: false,
  
  // Don't change this, unless you know what you're doing
  moduleSystem: 'commonjs',
};

module.exports = config;