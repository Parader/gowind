import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI || "";
const DB_NAME = process.env.DB_NAME || "gowind";

export async function connectDb(): Promise<void> {
    if (!MONGODB_URI) {
        throw new Error("MONGODB_URI is not set");
    }
    await mongoose.connect(MONGODB_URI, { dbName: DB_NAME });
}
