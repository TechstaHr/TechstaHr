/**
 * Fix Script: Resync BillingId Counter
 * 
 * This script:
 * 1. Finds the maximum billingId in the billinginfos collection
 * 2. Updates the mongoose-sequence counter in the 'counters' collection
 * 3. Ensures future inserts don't cause duplicate key errors
 */

require('dotenv').config();
const mongoose = require('mongoose');

const DATABASE_URL = process.env.DATABASE_URL;
const DATABASE_NAME = process.env.DATABASE_NAME || 'test';

async function fixCounter() {
    try {
        console.log('🔄 Connecting to MongoDB...');
        await mongoose.connect(DATABASE_URL, {
            dbName: DATABASE_NAME
        });
        console.log('✅ Connected to MongoDB');

        const db = mongoose.connection.db;
        const billingInfos = db.collection('billinginfos');
        const counters = db.collection('counters');

        // Step 1: Find max billingId
        console.log('\n🔍 Finding maximum billingId...');
        const maxDoc = await billingInfos.find({ billingId: { $exists: true } }).sort({ billingId: -1 }).limit(1).toArray();

        let maxId = 1000; // Default start
        if (maxDoc.length > 0) {
            maxId = maxDoc[0].billingId;
            console.log(`📊 Current maximum billingId: ${maxId}`);
        } else {
            console.log('ℹ️  No documents with billingId found.');
        }

        // Step 2: Check counters collection
        // mongoose-sequence uses { id: "billingId", seq: X } by default
        // The 'id' is usually 'modelName_fieldName' if not specified, 
        // but let's check what's there.
        console.log('\n📋 Checking counters collection...');
        const allCounters = await counters.find({}).toArray();
        console.log('Current counters:', JSON.stringify(allCounters, null, 2));

        // Attempt to find the specific counter for billingId
        // In models/BillingInfo.js: inc_field: 'billingId'
        // The default id is the model name pluralized or the collection name? 
        // Usually it's the field name if no 'id' provided in options.
        const counterId = 'billingId';

        const currentCounter = await counters.findOne({ id: counterId });

        if (currentCounter) {
            console.log(`📍 Found counter for "${counterId}": ${currentCounter.seq}`);
            if (currentCounter.seq <= maxId) {
                console.log(`🆙 Updating counter to ${maxId}...`);
                await counters.updateOne(
                    { id: counterId },
                    { $set: { seq: maxId } }
                );
                console.log('✅ Counter updated successfully');
            } else {
                console.log('✅ Counter is already higher than maxId');
            }
        } else {
            console.log(`⚠️  Counter for "${counterId}" not found. Creating it at ${maxId}...`);
            await counters.insertOne({ id: counterId, seq: maxId });
            console.log('✅ Counter created successfully');
        }

        // Also check if it might be 'billinginfos_billingId'
        const altCounterId = 'billinginfos_billingId';
        const altCounter = await counters.findOne({ id: altCounterId });
        if (altCounter) {
            console.log(`📍 Found alternative counter for "${altCounterId}": ${altCounter.seq}`);
            if (altCounter.seq <= maxId) {
                await counters.updateOne({ id: altCounterId }, { $set: { seq: maxId } });
                console.log('✅ Alternative counter updated');
            }
        }

        console.log('\n🚀 Fix completed!');
        console.log('New documents should now get unique IDs starting from:', maxId + 1);

    } catch (error) {
        console.error('\n❌ Fix failed:', error.message);
    } finally {
        await mongoose.connection.close();
        console.log('\n🔌 Disconnected from MongoDB');
    }
}

fixCounter();
