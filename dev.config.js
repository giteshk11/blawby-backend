// Development configuration for optimized HMR
export default {
  // Enable faster file watching
  watch: {
    // Watch specific directories for faster startup
    include: ['src/**/*.ts', 'src/**/*.js', 'src/**/*.json'],
    // Ignore node_modules and other unnecessary files
    exclude: [
      'node_modules/**',
      'dist/**',
      '.git/**',
      '*.log',
      'coverage/**',
      'test/**',
    ],
    // Use polling for better compatibility
    usePolling: false,
    // Ignore initial file scan for faster startup
    ignoreInitial: true,
  },

  // TypeScript compilation options for dev
  typescript: {
    // Skip type checking in dev for faster startup
    skipLibCheck: true,
    // Use incremental compilation
    incremental: true,
    // Faster compilation
    transpileOnly: true,
  },

  // Environment variables for dev
  env: {
    NODE_ENV: 'development',
    // Enable debug logging
    DEBUG: 'app:*',
    // Faster database connections
    DATABASE_POOL_SIZE: '5',
  },
};



