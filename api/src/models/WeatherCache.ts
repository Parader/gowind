import mongoose, { Schema, model } from "mongoose";

export interface IWeatherCache {
    _id: mongoose.Types.ObjectId;
    provider: string;
    lat: number;
    lng: number;
    forecastType: string;
    hoursAhead?: number;
    data: Record<string, unknown>;
    fetchedAt: Date;
    createdAt: Date;
    updatedAt: Date;
}

const WeatherCacheSchema = new Schema<IWeatherCache>(
    {
        provider: { type: String, required: true },
        lat: { type: Number, required: true },
        lng: { type: Number, required: true },
        forecastType: { type: String, required: true },
        hoursAhead: { type: Number },
        data: { type: Schema.Types.Mixed, required: true },
        fetchedAt: { type: Date, required: true, default: Date.now },
    },
    { timestamps: true }
);

WeatherCacheSchema.index({ provider: 1, forecastType: 1 });
WeatherCacheSchema.index({ fetchedAt: 1 }, { expireAfterSeconds: 3600 }); // TTL: delete 1h after fetchedAt
WeatherCacheSchema.index({ provider: 1, forecastType: 1, lat: 1, lng: 1 });

export const WeatherCache = model<IWeatherCache>("WeatherCache", WeatherCacheSchema);
