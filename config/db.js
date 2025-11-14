const mongoose = require("mongoose");
require("dotenv").config();

const ConnectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.DATABASE_URL, {
            dbName: process.env.DATABASE_NAME || undefined,
        });
        console.log(`MongoDB connected: ${conn.connection.host}/${conn.connection.name}`);
    } catch (error) {
        console.error("MongoDB connection error:", error);
        process.exit(1);
    }
};

module.exports = ConnectDB;
