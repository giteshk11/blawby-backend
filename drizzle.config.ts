import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: ['./src/schema/index.ts', './features/*/database/schema/index.ts'],
  out: './src/database/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
