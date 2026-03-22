import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { appendFileSync, existsSync, readFileSync } from "fs";
import path from "path";

const DB_PATH = process.env.DB_PATH ?? "sapling.db";
const GITIGNORE_PATH = path.join(process.cwd(), ".gitignore");

function ensureGitignored(dbPath: string) {
	const entry = path.relative(process.cwd(), path.resolve(dbPath));
	if (!existsSync(GITIGNORE_PATH)) return;
	const lines = readFileSync(GITIGNORE_PATH, "utf-8")
		.split("\n")
		.map((l) => l.trim());
	if (!lines.includes(entry)) {
		appendFileSync(GITIGNORE_PATH, `\n# local database\n${entry}\n`);
	}
}

const isNew = !existsSync(DB_PATH);
const sqlite = new Database(DB_PATH);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite);

migrate(db, { migrationsFolder: "./db/migrations" });

if (isNew) {
	ensureGitignored(DB_PATH);
}
