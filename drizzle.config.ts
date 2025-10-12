import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: [
    './src/schema/index.ts',
    './src/modules/*/database/schema/*.schema.ts',
  ],
  out: './src/database/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
});
