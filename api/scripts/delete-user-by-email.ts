/**
 * One-off: delete all DB records for a user by email.
 * Usage: npx tsx scripts/delete-user-by-email.ts user@example.com
 */
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "..", ".env") });
dotenv.config({ path: join(__dirname, "..", "..", ".env") });

const email = process.argv[2]?.trim().toLowerCase();
if (!email) {
    console.error("Usage: npx tsx scripts/delete-user-by-email.ts <email>");
    process.exit(1);
}

const { connectDb } = await import("../src/db.js");
const { User } = await import("../src/models/User.js");
const { UserData } = await import("../src/models/UserData.js");
const { GoTimeShare } = await import("../src/models/GoTimeShare.js");
const mongoose = (await import("mongoose")).default;

async function main() {
    await connectDb();

    const user = await User.findOne({
        email: new RegExp(`^${email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"),
    });
    if (!user) {
        console.log(`No user found for email: ${email}`);
        await mongoose.disconnect();
        return;
    }

    const userId = user._id;
    console.log(`Found user ${userId.toString()} (${user.email})`);

    const userDataResult = await UserData.deleteMany({ userId });
    const sharesResult = await GoTimeShare.deleteMany({ createdBy: userId });
    const userResult = await User.deleteOne({ _id: userId });

    console.log(`Deleted UserData: ${userDataResult.deletedCount}`);
    console.log(`Deleted GoTimeShare: ${sharesResult.deletedCount}`);
    console.log(`Deleted User: ${userResult.deletedCount}`);

    await mongoose.disconnect();
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
