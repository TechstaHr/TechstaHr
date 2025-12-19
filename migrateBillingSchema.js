/**
 * Migration Script: Remove Unique Index on bankDetail.bankId
 * 
 * This script:
 * 1. Drops the unique index on bankDetail.bankId in the billinginfos collection
 * 2. Creates a regular (non-unique) index on bankDetail.bankId for performance
 * 3. Adds billingId field to existing documents (auto-increment will handle new ones)
 * 
 * Run this script once to fix the database schema.
 * Usage: node migrateBillingSchema.js
 * 
 * IMPORTANT: Stop the server (pnpm serve) before running this migration!
 */

require('dotenv').config();
const mongoose = require('mongoose');

const DATABASE_URL = process.env.DATABASE_URL;
const DATABASE_NAME = process.env.DATABASE_NAME || 'test';

async function migrate() {
    try {
        console.log('🔄 Connecting to MongoDB...');
        await mongoose.connect(DATABASE_URL, {
            dbName: DATABASE_NAME
        });
        console.log('✅ Connected to MongoDB');


        const db = mongoose.connection.db;
        const collection = db.collection('billinginfos');

        // Step 1: Get all existing indexes
        console.log('\n📋 Current indexes:');
        const indexes = await collection.indexes();
        indexes.forEach(index => {
            console.log(`  - ${index.name}:`, JSON.stringify(index.key), index.unique ? '(UNIQUE)' : '');
        });

        // Step 2: Drop the unique index on bankDetail.bankId if it exists
        console.log('\n🗑️  Dropping unique index on bankDetail.bankId...');
        try {
            await collection.dropIndex('bankDetail.bankId_1');
            console.log('✅ Unique index dropped successfully');
        } catch (error) {
            if (error.code === 27 || error.codeName === 'IndexNotFound') {
                console.log('ℹ️  Index bankDetail.bankId_1 does not exist (already removed or never created)');
            } else {
                throw error;
            }
        }

        // Step 3: Create a regular (non-unique) index on bankDetail.bankId for performance
        console.log('\n📊 Creating regular index on bankDetail.bankId...');
        try {
            await collection.createIndex({ 'bankDetail.bankId': 1 }, { unique: false, name: 'bankDetail.bankId_1' });
            console.log('✅ Regular index created successfully');
        } catch (error) {
            if (error.code === 85 || error.codeName === 'IndexOptionsConflict') {
                console.log('ℹ️  Index already exists - attempting to drop and recreate...');
                try {
                    await collection.dropIndex('bankDetail.bankId_1');
                    await collection.createIndex({ 'bankDetail.bankId': 1 }, { unique: false, name: 'bankDetail.bankId_1' });
                    console.log('✅ Index recreated successfully');
                } catch (retryError) {
                    console.log('⚠️  Could not recreate index:', retryError.message);
                }
            } else {
                throw error;
            }
        }

        // Step 4: Add billingId to existing documents
        console.log('\n🔢 Adding billingId to existing documents...');
        const docsWithoutBillingId = await collection.countDocuments({ billingId: { $exists: false } });

        if (docsWithoutBillingId > 0) {
            console.log(`   Found ${docsWithoutBillingId} documents without billingId`);

            // Get all documents without billingId
            const docs = await collection.find({ billingId: { $exists: false } }).toArray();

            // Update each document with an auto-incrementing billingId
            let startId = 1000;
            for (const doc of docs) {
                await collection.updateOne(
                    { _id: doc._id },
                    { $set: { billingId: startId++ } }
                );
            }
            console.log(`✅ Added billingId to ${docsWithoutBillingId} documents`);
        } else {
            console.log('ℹ️  All documents already have billingId');
        }

        // Step 5: Verify the changes
        console.log('\n📋 Updated indexes:');
        const updatedIndexes = await collection.indexes();
        updatedIndexes.forEach(index => {
            console.log(`  - ${index.name}:`, JSON.stringify(index.key), index.unique ? '(UNIQUE)' : '');
        });

        // Step 6: Show sample document
        console.log('\n📄 Sample document:');
        const sampleDoc = await collection.findOne({});
        if (sampleDoc) {
            console.log({
                _id: sampleDoc._id,
                billingId: sampleDoc.billingId,
                userId: sampleDoc.userId,
                'bankDetail.bankId': sampleDoc.bankDetail?.bankId
            });
        }

        console.log('\n✅ Migration completed successfully!');
        console.log('\n📝 Summary:');
        console.log('   - Removed unique constraint on bankDetail.bankId');
        console.log('   - Created regular index on bankDetail.bankId');
        console.log('   - Added billingId field to existing documents');
        console.log('   - Multiple users can now use the same bank');
        console.log('\n⚠️  Remember to restart your server (pnpm serve)');

    } catch (error) {
        console.error('\n❌ Migration failed:', error);
        console.error('\nError details:', error.message);
        throw error;
    } finally {
        await mongoose.connection.close();
        console.log('\n🔌 Disconnected from MongoDB');
    }
}

// Run the migration
migrate()
    .then(() => {
        console.log('\n🎉 All done!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n💥 Fatal error:', error.message);
        process.exit(1);
    });
