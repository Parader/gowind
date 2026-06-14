import mongoose, { Schema, model } from "mongoose";
import bcrypt from "bcryptjs";

export interface IOAuthAccount {
    provider: string;
    providerAccountId: string;
    email?: string;
    name?: string;
    image?: string;
}

export interface IUser {
    _id: mongoose.Types.ObjectId;
    email: string;
    name?: string;
    password?: string;
    image?: string;
    oauthAccounts: IOAuthAccount[];
    createdAt: Date;
    updatedAt: Date;
}

const OAuthAccountSchema = new Schema<IOAuthAccount>(
    {
        provider: { type: String, required: true },
        providerAccountId: { type: String, required: true },
        email: String,
        name: String,
        image: String,
    },
    { _id: false }
);

const UserSchema = new Schema<IUser>(
    {
        email: { type: String, required: true, unique: true },
        name: { type: String },
        password: { type: String, select: false },
        image: { type: String },
        oauthAccounts: { type: [OAuthAccountSchema], default: [] },
    },
    { timestamps: true }
);

UserSchema.index({ "oauthAccounts.provider": 1, "oauthAccounts.providerAccountId": 1 }, { unique: true });

UserSchema.pre("save", async function (next) {
    if (!this.isModified("password") || !this.password) return next();
    this.password = await bcrypt.hash(this.password, 12);
    next();
});

UserSchema.methods.comparePassword = function (candidate: string): Promise<boolean> {
    return bcrypt.compare(candidate, this.password || "");
};

export const User = model<IUser>("User", UserSchema);
