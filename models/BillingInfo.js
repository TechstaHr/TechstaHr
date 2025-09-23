const mongoose = require('mongoose');

const billingInfoSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User',
        unique: true
    },
    companyName: { type: String, required: true },
    taxId: { type: String, required: true },
    billingEmail: { type: String, required: true, match: /.+\@.+\..+/ },
    phoneNumber: { type: String, required: true },
    address: {
        street: { type: String, required: true },
        city: { type: String, required: true },
        state: { type: String, required: true },
        postalCode: { type: String, required: true },
        country: { type: String, required: true }
    }
}, { timestamps: true });

module.exports = mongoose.model('BillingInfo', billingInfoSchema);
