const mongoose = require('mongoose');

const billingInfoSchema = new mongoose.Schema({
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
            ref: 'Bank'
        },
    },
    payRate: {
        type: String,
        enum: ['hourly', 'weekly', 'monthly']
    }
}, { timestamps: true });

module.exports = mongoose.model('BillingInfo', billingInfoSchema);
