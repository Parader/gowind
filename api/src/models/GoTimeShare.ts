import mongoose, { Schema, model } from "mongoose";

export interface IGoTimeShare {
    _id: mongoose.Types.ObjectId;
    shareId: string;
    createdBy: mongoose.Types.ObjectId;
    snapshot: Record<string, unknown>;
    expiresAt: Date;
    createdAt: Date;
    updatedAt: Date;
}

const GoTimeShareSchema = new Schema<IGoTimeShare>(
    {
        shareId: { type: String, required: true, unique: true },
        createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
        snapshot: { type: Schema.Types.Mixed, required: true },
        expiresAt: { type: Date, required: true },
    },
    { timestamps: true }
);

GoTimeShareSchema.index({ shareId: 1 }, { unique: true });
GoTimeShareSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const GoTimeShare = model<IGoTimeShare>("GoTimeShare", GoTimeShareSchema);
