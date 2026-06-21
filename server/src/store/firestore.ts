import admin from "firebase-admin";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";

let app: admin.app.App | null = null;

export function getFirebaseApp(): admin.app.App {
  if (app) return app;

  const options: admin.AppOptions = {};

  if (env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
      const parsed = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON);
      options.credential = admin.credential.cert(parsed);
    } catch (err) {
      throw new Error(`FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON: ${String(err)}`);
    }
  } else if (env.GOOGLE_APPLICATION_CREDENTIALS) {
    // admin.credential.applicationDefault() reads GOOGLE_APPLICATION_CREDENTIALS from the env.
    options.credential = admin.credential.applicationDefault();
  } else {
    logger.warn(
      "No Firebase credentials configured (set FIREBASE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS). Firestore/Storage calls will fail.",
    );
  }

  if (env.FIREBASE_PROJECT_ID) options.projectId = env.FIREBASE_PROJECT_ID;
  if (env.FIREBASE_STORAGE_BUCKET) options.storageBucket = env.FIREBASE_STORAGE_BUCKET;

  app = admin.initializeApp(options);
  logger.info({ projectId: env.FIREBASE_PROJECT_ID }, "Firebase initialized");
  return app;
}

let firestore: admin.firestore.Firestore | null = null;

export function db(): admin.firestore.Firestore {
  if (!firestore) {
    firestore = getFirebaseApp().firestore();
    // Optional extraction fields (phone, description, etc.) are often absent;
    // drop undefined values instead of failing the whole write.
    firestore.settings({ ignoreUndefinedProperties: true });
  }
  return firestore;
}

export function bucket() {
  return getFirebaseApp().storage().bucket();
}

export const FieldValue = admin.firestore.FieldValue;
