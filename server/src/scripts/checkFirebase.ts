import { env } from "../config/env.js";
import { bucket, db } from "../store/firestore.js";

const ok = (msg: string) => console.log(`\x1b[32m[OK]\x1b[0m   ${msg}`);
const fail = (msg: string) => console.log(`\x1b[31m[FAIL]\x1b[0m ${msg}`);
const info = (msg: string) => console.log(`        ${msg}`);

async function checkConfig(): Promise<boolean> {
  console.log("Configuration:");
  let allSet = true;

  const hasCreds = !!(env.FIREBASE_SERVICE_ACCOUNT_JSON || env.GOOGLE_APPLICATION_CREDENTIALS);
  console.log(`  FIREBASE_PROJECT_ID     = ${env.FIREBASE_PROJECT_ID ?? "(missing)"}`);
  console.log(`  FIREBASE_STORAGE_BUCKET = ${env.FIREBASE_STORAGE_BUCKET ?? "(missing)"}`);
  console.log(
    `  credentials             = ${
      env.FIREBASE_SERVICE_ACCOUNT_JSON
        ? "inline JSON"
        : env.GOOGLE_APPLICATION_CREDENTIALS
          ? env.GOOGLE_APPLICATION_CREDENTIALS
          : "(missing)"
    }`,
  );
  console.log("");

  if (!env.FIREBASE_PROJECT_ID) {
    fail("FIREBASE_PROJECT_ID is not set in .env");
    allSet = false;
  }
  if (!env.FIREBASE_STORAGE_BUCKET) {
    fail("FIREBASE_STORAGE_BUCKET is not set in .env");
    allSet = false;
  }
  if (!hasCreds) {
    fail("No credentials set (GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_SERVICE_ACCOUNT_JSON)");
    allSet = false;
  }
  return allSet;
}

async function checkFirestore(): Promise<boolean> {
  try {
    const ref = db().collection("_healthcheck").doc("ping");
    await ref.set({ ts: Date.now(), source: "check:firebase" });
    const snap = await ref.get();
    if (!snap.exists) throw new Error("document not found after write");
    await ref.delete();
    ok("Firestore: write / read / delete succeeded");
    return true;
  } catch (err) {
    fail(`Firestore: ${err instanceof Error ? err.message : String(err)}`);
    info("Hints: enable Firestore (Build -> Firestore Database -> Create database),");
    info("and make sure the service-account key belongs to FIREBASE_PROJECT_ID.");
    return false;
  }
}

async function checkStorage(): Promise<boolean> {
  try {
    const b = bucket();
    const [exists] = await b.exists();
    if (!exists) {
      throw new Error(`bucket "${b.name}" does not exist`);
    }
    const file = b.file(`_healthcheck/ping-${Date.now()}.txt`);
    await file.save(Buffer.from("ok"), { resumable: false, contentType: "text/plain" });
    const [buf] = await file.download();
    await file.delete();
    if (buf.toString() !== "ok") throw new Error("downloaded content did not match");
    ok(`Storage: upload / download / delete succeeded (bucket = ${b.name})`);
    return true;
  } catch (err) {
    fail(`Storage: ${err instanceof Error ? err.message : String(err)}`);
    info("Hints: enable Storage (Build -> Storage -> Get started), and check that");
    info("FIREBASE_STORAGE_BUCKET matches the gs:// bucket name shown in the console");
    info("(newer projects look like <project-id>.firebasestorage.app).");
    return false;
  }
}

async function main(): Promise<void> {
  console.log("\nChecking Firebase connectivity for lachishBusinesses...\n");

  const configOk = await checkConfig();
  if (!configOk) {
    console.log("\nFix the configuration above in server/.env and re-run `npm run check:firebase`.\n");
    process.exit(1);
  }

  const firestoreOk = await checkFirestore();
  const storageOk = await checkStorage();

  console.log("");
  if (firestoreOk && storageOk) {
    console.log("\x1b[32mAll checks passed.\x1b[0m You're ready to run `npm run dev` and link WhatsApp.\n");
    process.exit(0);
  } else {
    console.log("\x1b[31mSome checks failed.\x1b[0m See the hints above.\n");
    process.exit(1);
  }
}

main().catch((err) => {
  fail(String(err));
  process.exit(1);
});
