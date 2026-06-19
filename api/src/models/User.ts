import mongoose, { Schema, model, type Model } from "mongoose";
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

interface IUserMethods {
    comparePassword(candidate: string): Promise<boolean>;
}

type UserModel = Model<IUser, {}, IUserMethods>;

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

const UserSchema = new Schema<IUser, UserModel, IUserMethods>(
    {
        email: { type: String, required: true, unique: true },
        name: { type: String },
        password: { type: String, select: false },
        image: { type: String },
        oauthAccounts: { type: [OAuthAccountSchema], default: [] },
    },
    { timestamps: true }
);

/** Only index linked OAuth rows — email/password users have no oauth entries. */
UserSchema.index(
    { "oauthAccounts.provider": 1, "oauthAccounts.providerAccountId": 1 },
    {
        unique: true,
        partialFilterExpression: {
            "oauthAccounts.provider": { $type: "string" },
            "oauthAccounts.providerAccountId": { $type: "string" },
        },
    },
);

UserSchema.pre("save", async function (next) {
    if (!this.isModified("password") || !this.password) return next();
    this.password = await bcrypt.hash(this.password, 12);
    next();
});

UserSchema.methods.comparePassword = function (candidate: string): Promise<boolean> {
    return bcrypt.compare(candidate, this.password || "");
};

export const User = model<IUser, UserModel>("User", UserSchema);
