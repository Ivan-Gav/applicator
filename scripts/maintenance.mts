/**
 * Maintenance that needs the service role key. Run by hand from a developer's
 * machine, never deployed. Acts on the project in NEXT_PUBLIC_SUPABASE_URL
 * with SUPABASE_SERVICE_ROLE_KEY, from the environment or .env.local.
 *
 *   npm run maintenance -- delete-user <email>
 *     Removes the user's files, then the user; the database deletes their rows.
 *
 *   npm run maintenance -- remove-unreferenced-files
 *     Removes files no document version names, such as those a failed
 *     deletion left behind. Files younger than an hour are left alone: their
 *     upload may not have stored its row yet.
 *
 * Each mode lists what it would remove and removes nothing until "yes" is typed.
 */
import { createInterface } from "node:readline/promises";
// CommonJS: no named exports under ESM.
import nextEnv from "@next/env";
import {
  deleteUser,
  findUserId,
  maintenanceTarget,
  referencedStorageKeys,
  storageOfAllUsers,
} from "@/adapters/supabase/maintenance";
import { unreferencedFileGracePeriodMs, unreferencedFiles } from "@/domain/document/rules";
import type { StoredFile } from "@/domain/document/storage";

const Mode = {
  DeleteUser: "delete-user",
  RemoveUnreferencedFiles: "remove-unreferenced-files",
} as const;

const usage = `Usage:
  npm run maintenance -- ${Mode.DeleteUser} <email>
  npm run maintenance -- ${Mode.RemoveUnreferencedFiles}`;

function printFiles(files: readonly StoredFile[]) {
  for (const file of files) {
    console.log(`  ${file.key}  created ${file.createdAt.toISOString()}`);
  }
}

async function confirmed(question: string): Promise<boolean> {
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await prompt.question(`${question} Type "yes" to go ahead: `);
  prompt.close();
  return answer.trim() === "yes";
}

async function deleteUserWithFiles(email: string): Promise<void> {
  const userId = await findUserId(email);
  if (userId === null) {
    console.log(`No user has the address ${email}.`);
    return;
  }
  const storage = storageOfAllUsers();
  const files = await storage.listOwnedBy(userId);
  console.log(`User ${email} (${userId}) has ${files.length} file(s):`);
  printFiles(files);
  if (!(await confirmed(`Remove these files, then the user and all their data?`))) {
    console.log("Nothing removed.");
    return;
  }
  // Files first: once the user is gone, nothing names them any more.
  await storage.remove(files.map((file) => file.key));
  console.log(`Removed ${files.length} file(s).`);
  await deleteUser(userId);
  console.log(`Deleted user ${email}.`);
}

async function removeUnreferencedFiles(): Promise<void> {
  const storage = storageOfAllUsers();
  // Files before keys: a row stored in between only adds a key.
  const files = await storage.listAll();
  const referenced = await referencedStorageKeys();
  const removable = unreferencedFiles(files, referenced, new Date());
  const hours = unreferencedFileGracePeriodMs / (60 * 60 * 1000);
  console.log(
    `Storage holds ${files.length} file(s); ${referenced.size} are named by a document version.`,
  );
  if (removable.length === 0) {
    console.log(`No file older than ${hours} hour(s) is unreferenced. Nothing to remove.`);
    return;
  }
  console.log(`${removable.length} file(s) older than ${hours} hour(s) are unreferenced:`);
  printFiles(removable);
  if (!(await confirmed("Remove them?"))) {
    console.log("Nothing removed.");
    return;
  }
  await storage.remove(removable.map((file) => file.key));
  console.log(`Removed ${removable.length} file(s).`);
}

nextEnv.loadEnvConfig(process.cwd());
const [mode, argument] = process.argv.slice(2);
console.log(`Target: ${maintenanceTarget()}`);

if (mode === Mode.DeleteUser && argument) {
  await deleteUserWithFiles(argument);
} else if (mode === Mode.RemoveUnreferencedFiles) {
  await removeUnreferencedFiles();
} else {
  console.error(usage);
  process.exitCode = 1;
}
