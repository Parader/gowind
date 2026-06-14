import mongoose, { Schema, model } from "mongoose";

/**
 * Example model for user-associated data.
 * Replace or extend this with your actual domain models (locations, preferences, etc.)
 */
export interface IUserData {
    _id: mongoose.Types.ObjectId;
    userId: mongoose.Types.ObjectId;
    type: string;
    data: Record<string, unknown>;
    createdAt: Date;
    updatedAt: Date;
}

const UserDataSchema = new Schema<IUserData>(
    {
        userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
        type: { type: String, required: true },
        data: { type: Schema.Types.Mixed, default: {} },
    },
    { timestamps: true }
);

UserDataSchema.index({ userId: 1, type: 1 });

export const UserData = model<IUserData>("UserData", UserDataSchema);
