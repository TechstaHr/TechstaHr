/**
 * Migration Script: Remove Unique Index on bankId in Payrolls
 * 
 * This script:
 * 1. Drops the unique index on bankId in the payrolls collection
 * 2. Creates a regular (non-unique) index on bankId for performance
 * 3. Adds payrollId field to existing documents
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
        const collection = db.collection('payrolls');

        // Step 1: Get all existing indexes
        console.log('\n📋 Current indexes:');
        const indexes = await collection.indexes();
        indexes.forEach(index => {
            console.log(`  - ${index.name}:`, JSON.stringify(index.key), index.unique ? '(UNIQUE)' : '');
        });

        // Step 2: Drop the unique index on bankId if it exists
        console.log('\n🗑️  Dropping unique index on bankId...');
        try {
            // Usually indexes are named like field_name_1
            await collection.dropIndex('bankId_1');
            console.log('✅ Unique index bankId_1 dropped successfully');
        } catch (error) {
            if (error.code === 27 || error.codeName === 'IndexNotFound') {
                console.log('ℹ️  Index bankId_1 does not exist');
            } else {
                throw error;
            }
        }

        // Step 3: Create a regular (non-unique) index on bankId
        console.log('\n📊 Creating regular index on bankId...');
        try {
            await collection.createIndex({ 'bankId': 1 }, { unique: false, name: 'bankId_1' });
            console.log('✅ Regular index created successfully');
        } catch (error) {
            console.error('⚠️  Error creating index:', error.message);
        }

        // Step 4: Add payrollId to existing documents
        console.log('\n🔢 Adding payrollId to existing documents...');
        const docsWithoutPayrollId = await collection.countDocuments({ payrollId: { $exists: false } });

        if (docsWithoutPayrollId > 0) {
            console.log(`   Found ${docsWithoutPayrollId} documents without payrollId`);
            const docs = await collection.find({ payrollId: { $exists: false } }).sort({ createdAt: 1 }).toArray();

            let startId = 10000;
            for (const doc of docs) {
                await collection.updateOne(
                    { _id: doc._id },
                    { $set: { payrollId: startId++ } }
                );
            }
            console.log(`✅ Added payrollId to ${docsWithoutPayrollId} documents`);
        } else {
            console.log('ℹ️  All documents already have payrollId');
        }

        console.log('\n✅ Migration completed successfully!');

    } catch (error) {
        console.error('\n❌ Migration failed:', error.message);
        throw error;
    } finally {
        await mongoose.connection.close();
        console.log('\n🔌 Disconnected from MongoDB');
    }
}

migrate()
    .then(() => {
        console.log('\n🎉 All done!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n💥 Fatal error:', error.message);
        process.exit(1);
    });
