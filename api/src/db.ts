import mongoose from "mongoose";
import { User } from "./models/User.js";

const MONGODB_URI = process.env.MONGODB_URI || "";
const DB_NAME = process.env.DB_NAME || "gowind";

const LEGACY_OAUTH_INDEX = "oauthAccounts.provider_1_oauthAccounts.providerAccountId_1";

export async function connectDb(): Promise<void> {
    if (!MONGODB_URI) {
        throw new Error("MONGODB_URI is not set");
    }
    await mongoose.connect(MONGODB_URI, { dbName: DB_NAME });
    await ensureUserIndexes();
}

async function ensureUserIndexes(): Promise<void> {
    try {
        await User.collection.dropIndex(LEGACY_OAUTH_INDEX);
        console.log(`Dropped legacy index ${LEGACY_OAUTH_INDEX}`);
    } catch (err) {
        const code = (err as { code?: number }).code;
        if (code !== 27 && code !== 26) {
            // 27 = IndexNotFound, 26 = NamespaceNotFound
            console.warn("Could not drop legacy OAuth index:", err);
        }
    }
    await User.syncIndexes();
}
