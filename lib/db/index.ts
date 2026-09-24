import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL;
const client = connectionString
  ? postgres(connectionString, { max: 5, idle_timeout: 20, connect_timeout: 10 })
  : null;

export const db = client ? drizzle(client, { schema }) : null;
