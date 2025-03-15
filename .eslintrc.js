module.exports = {
  env: {
    node: true,
    commonjs: true,
    es2021: true,
    jest: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:security/recommended',
    'plugin:node/recommended'
  ],
  parser: "@babel/eslint-parser",
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
    requireConfigFile: false,
    babelOptions: {
      plugins: [
        "@babel/plugin-proposal-class-properties"
      ]
    }
  },
  plugins: [
    'security',
    'node'
  ],
  rules: {
    // Allow unused parameters in specific methods
    'no-unused-vars': ['error', { 
      'argsIgnorePattern': '^_', 
      'varsIgnorePattern': '^_'
    }],
    
    // Security specific rules
    'security/detect-object-injection': 'warn',
    'security/detect-non-literal-require': 'warn',
    'security/detect-non-literal-fs-filename': 'warn',
    'security/detect-eval-with-expression': 'error',
    'security/detect-buffer-noassert': 'error',
    'security/detect-child-process': 'warn',
    'security/detect-disable-mustache-escape': 'error',
    'security/detect-new-buffer': 'error',
    'security/detect-no-csrf-before-method-override': 'error',
    'security/detect-possible-timing-attacks': 'warn',
    'security/detect-pseudoRandomBytes': 'warn',
    'security/detect-unsafe-regex': 'warn',
    
    // Node.js specific security rules
    'node/no-unsupported-features/es-syntax': 'off', // Allow modern JS syntax
    'node/no-missing-require': 'error',
    'node/no-unpublished-require': 'off', // Allow dev dependencies
    'node/no-deprecated-api': 'error',
    'node/no-extraneous-require': 'error',
    
    // General code quality rules
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-unsafe-negation': 'error',
    // This is replaced by a more general rule above
    'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
    'curly': ['error', 'all'],
    'eqeqeq': ['error', 'always'],
    'no-return-await': 'error',
    'require-await': 'error',
    
    // Regular expressions
    'no-control-regex': 'error',
    'no-div-regex': 'error',
    'no-regex-spaces': 'error',
    
    // Error handling
    'no-throw-literal': 'error',
    'prefer-promise-reject-errors': 'error',
    
    // Other good practices
    'no-var': 'error',
    'prefer-const': 'error',
    'max-depth': ['warn', 4],
    'max-nested-callbacks': ['warn', 4],
    'max-params': ['warn', 5],
  },
  overrides: [
    {
      files: ['**/*.test.js', '**/tests/**', '**/__tests__/**'],
      env: {
        jest: true,
      },
      rules: {
        'security/detect-non-literal-fs-filename': 'off',
        'node/no-unpublished-require': 'off',
      },
    },
  ],
};