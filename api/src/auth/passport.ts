import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { User } from "../models/User.js";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const API_URL = process.env.API_URL || "http://localhost:3001";

passport.use(
    new LocalStrategy(
        { usernameField: "email", passwordField: "password" },
        async (email, password, done) => {
            try {
                const user = await User.findOne({ email }).select("+password");
                if (!user || !user.password) {
                    return done(null, false, { message: "Invalid email or password" });
                }
                const ok = await user.comparePassword(password);
                if (!ok) return done(null, false, { message: "Invalid email or password" });
                const { password: _, ...safe } = user.toObject();
                return done(null, safe);
            } catch (err) {
                return done(err as Error);
            }
        }
    )
);

if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
    passport.use(
        new GoogleStrategy(
            {
                clientID: GOOGLE_CLIENT_ID,
                clientSecret: GOOGLE_CLIENT_SECRET,
                callbackURL: `${API_URL}/auth/google/callback`,
            },
            async (_accessToken, _refreshToken, profile, done) => {
                try {
                    const email = profile.emails?.[0]?.value;
                    const providerAccountId = profile.id;
                    const name = profile.displayName;
                    const image = profile.photos?.[0]?.value;

                    // Find existing user by OAuth account or email
                    let user = await User.findOne({
                        $or: [
                            { "oauthAccounts.providerAccountId": providerAccountId, "oauthAccounts.provider": "google" },
                            { email },
                        ],
                    });

                    if (!user) {
                        user = await User.create({
                            email: email || `google-${providerAccountId}@temp.local`,
                            name,
                            image,
                            oauthAccounts: [
                                {
                                    provider: "google",
                                    providerAccountId,
                                    email,
                                    name,
                                    image,
                                },
                            ],
                        });
                    } else {
                        const hasGoogle = user.oauthAccounts.some(
                            (a) => a.provider === "google" && a.providerAccountId === providerAccountId
                        );
                        if (!hasGoogle) {
                            user.oauthAccounts.push({
                                provider: "google",
                                providerAccountId,
                                email,
                                name,
                                image,
                            });
                            await user.save();
                        }
                    }
                    return done(null, user.toObject());
                } catch (err) {
                    return done(err as Error);
                }
            }
        )
    );
}

passport.serializeUser((user: object, done) => {
    done(null, user);
});

passport.deserializeUser((user: object, done) => {
    done(null, user);
});
