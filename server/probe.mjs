import { DatabaseSync } from "node:sqlite";
import process from "node:process";
const db = new DatabaseSync(":memory:");
console.log("node          :", process.version);
console.log("sqlite         :", db.prepare("select sqlite_version() v").get().v);
console.log("compile options:");
for (const r of db.prepare("pragma compile_options").all()) console.log("   ", r.compile_options);
