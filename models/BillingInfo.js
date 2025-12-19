const mongoose = require('mongoose');
const AutoIncrement = require('mongoose-sequence')(mongoose);

const billingInfoSchema = new mongoose.Schema({
    billingId: {
        type: Number,
        unique: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User',
        unique: true
    },
    companyName: { type: String },
    taxId: { type: String },
    billingEmail: { type: String, match: /.+\@.+\..+/ },
    phoneNumber: { type: String },
    address: {
        street: { type: String },
        city: { type: String },
        state: { type: String },
        postal_code: { type: String },
        country: { type: String }
    },
    bankDetail: {
        currency: { type: String },
        accountName: { type: String },
        accountNumber: { type: String },
        bankId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Bank',
            index: true  // Regular index, not unique
        },
    }
}, { timestamps: true });

// Add auto-increment plugin for billingId
billingInfoSchema.plugin(AutoIncrement, {
    inc_field: 'billingId',
    start_seq: 1000  // Start from 1000 for better readability
});

module.exports = mongoose.model('BillingInfo', billingInfoSchema);
