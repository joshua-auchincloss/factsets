import { defineConfig } from "drizzle-kit";

export default defineConfig({
	dialect: "sqlite",
	dbCredentials: { url: ".facts.db" },
	schema: "./src/db/schema.ts",
	out: "./src/db/migrations",
});
