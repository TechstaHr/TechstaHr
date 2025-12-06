const mongoose = require('mongoose');

const PaymentMethodSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    provider: {
        type: String,
        enum: ['flutterwave', 'paystack', 'stripe', 'paypal'],
        default: 'flutterwave',
        required: true
    },
    provider_payment_method_id: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ['card', 'bank', 'bank_account', 'mobile_money', 'ussd', 'opay'],
        required: true
    },
    card: {
        last4: String,              // Last 4 digits
        brand: String,              // Visa, Mastercard, etc.
        expiry_month: String,
        expiry_year: String,
        card_holder_name: String
    },
    bank: {
        account_number_last4: String,
        bank_name: String,
        account_name: String,
        bank_code: String
    },
    
    is_default: {
        type: Boolean,
        default: false
    },
    
    is_active: {
        type: Boolean,
        default: true
    },
    
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    
    // Track usage
    last_used_at: Date,
    usage_count: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

// Index for faster queries
PaymentMethodSchema.index({ user: 1, is_active: 1 });
PaymentMethodSchema.index({ user: 1, is_default: 1 });
PaymentMethodSchema.index({ provider: 1, provider_payment_method_id: 1 }, { unique: true });

// Ensure only one default payment method per user
PaymentMethodSchema.pre('save', async function(next) {
    if (this.is_default && this.isModified('is_default')) {
        // Remove default flag from other payment methods for this user
        await this.constructor.updateMany(
            { user: this.user, _id: { $ne: this._id } },
            { $set: { is_default: false } }
        );
    }
    next();
});

// Helper method to get the provider-specific ID
PaymentMethodSchema.methods.getProviderMethodId = function() {
    return this.provider_payment_method_id;
};

module.exports = mongoose.model('PaymentMethod', PaymentMethodSchema);
