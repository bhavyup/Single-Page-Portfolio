const crypto = require("crypto");
const { MongoClient } = require("mongodb");
const { config } = require("./config");

let client;
let db;
let initPromise;

function isDatabaseEnabled() {
  return config.storage.useDatabase;
}

function getDatabase() {
  if (!isDatabaseEnabled()) {
    throw new Error("Database storage is disabled");
  }

  if (!db) {
    throw new Error("Database is not initialized");
  }

  return db;
}

async function initDatabase() {
  if (!isDatabaseEnabled()) return;

  if (!initPromise) {
    initPromise = (async () => {
      client = new MongoClient(config.storage.mongoUri);
      await client.connect();
      db = client.db(config.storage.mongoDbName);

      await db.collection("content_store").createIndex(
        { _id: 1 },
        { unique: true },
      );
      await db.collection("audit_log").createIndex({ ts: -1 });
    })();
  }

  await initPromise;
}

async function getStoredContent() {
  await initDatabase();

  const activeDb = getDatabase();
  const doc = await activeDb.collection("content_store").findOne(
    { _id: "portfolio-content" },
    { projection: { payload: 1 } },
  );

  return doc?.payload || null;
}

async function saveContent(payload) {
  await initDatabase();

  const activeDb = getDatabase();
  await activeDb.collection("content_store").updateOne(
    { _id: "portfolio-content" },
    {
      $set: {
        payload,
        updatedAt: new Date(),
      },
    },
    { upsert: true },
  );
}

async function insertAudit(event) {
  await initDatabase();

  const activeDb = getDatabase();
  const entry = {
    id: crypto.randomUUID(),
    ts: new Date(),
    ...event,
  };

  await activeDb.collection("audit_log").insertOne({
    _id: entry.id,
    ts: entry.ts,
    actor: entry.actor || null,
    action: entry.action || null,
    ip: entry.ip || null,
    userAgent: entry.userAgent || null,
    metadata: entry.metadata || null,
  });

  return {
    ...entry,
    ts: entry.ts.toISOString(),
  };
}

async function listAudit(limit = 500) {
  await initDatabase();

  const activeDb = getDatabase();
  const docs = await activeDb
    .collection("audit_log")
    .find({})
    .sort({ ts: -1 })
    .limit(limit)
    .toArray();

  return docs.map((doc) => ({
    id: String(doc._id),
    ts: new Date(doc.ts).toISOString(),
    actor: doc.actor,
    action: doc.action,
    ip: doc.ip,
    userAgent: doc.userAgent,
    metadata: doc.metadata,
  }));
}

async function closeDatabaseConnections() {
  if (!client) return;
  await client.close();
  client = undefined;
  db = undefined;
  initPromise = undefined;
}

module.exports = {
  isDatabaseEnabled,
  initDatabase,
  getStoredContent,
  saveContent,
  insertAudit,
  listAudit,
  closeDatabaseConnections,
};
