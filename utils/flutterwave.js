const axios = require('axios');
const crypto = require('crypto');
const User = require('../models/User');

const FLW_CLIENT_ID = process.env.FLW_CLIENT_ID
const FLW_CLIENT_SECRET = process.env.FLW_CLIENT_SECRET
const FLW_BASE_URL = process.env.FLW_BASE_URL;
const shouldLogTokenStatus = process.env.FLW_DEBUG_LOGS === 'true';
let accessToken = null;
let expiresIn = 0;
let lastTokenRefreshTime = 0;
const generateId = () => crypto.randomUUID();

async function refreshToken() {
  try {
    const response = await axios.post(
      'https://idp.flutterwave.com/realms/flutterwave/protocol/openid-connect/token',
      new URLSearchParams({
        client_id: FLW_CLIENT_ID,
        client_secret: FLW_CLIENT_SECRET,
        grant_type: 'client_credentials'
      }),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      }
    );

    accessToken = response.data.access_token;
    expiresIn = response.data.expires_in;
    lastTokenRefreshTime = Date.now();
    // console.log('Expires in:', expiresIn, 'seconds');
  } catch (error) {
    console.error('Error refreshing token:', error.response ? error.response.data : error.message);
  }
}

async function ensureTokenIsValid() {
  const currentTime = Date.now();
  const timeSinceLastRefresh = (currentTime - lastTokenRefreshTime) / 1000; // convert to seconds
  const timeLeft = expiresIn - timeSinceLastRefresh;

  if (!accessToken || timeLeft < 60) { // refresh if less than 1 minute remains
    console.log('Refreshing token...');
    await refreshToken();
  } else if (shouldLogTokenStatus) {
    console.log(`Token is still valid for ${Math.floor(timeLeft)} seconds.`);
  }
}

setInterval(ensureTokenIsValid, 50000); // check roughly every 50 seconds


const directTransfer = async (data) => {
  try {
    payload = {
      action: 'instant',
      payment_instruction: {
        source_currency: data.currency,
        amount: {
          applies_to: 'destination_currency',
          value: data.paymentAmount
        },
        recipient: {
          bank: {
            account_number: data.bankDetail.accountNumber,
            code: data.bank.code
          }
        },
        destination_currency: data.currency,
      },
      type: 'bank',
      reference: data.reference,
    }

    const response = await axios.post(
      `${FLW_BASE_URL}/direct-transfers`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-Trace-Id': data.traceId,
          'X-Idempotency-Key': data.idempotencyKey
        }
      }
    );
    return {
      status: response.data.status,
      message: response.data.message,
    }
  } catch (err) {
    console.error('Transfer initiation error:', err.response.data);
    throw err.response.data;
  }
};

/**
 * Create a customer record in Flutterwave
 * @param {Object} data - Customer data
 * @param {Object} data.address - Customer address
 * @param {string} data.address.city
 * @param {string} data.address.country
 * @param {string} data.address.line1
 * @param {string} data.address.line2
 * @param {string} data.address.postal_code
 * @param {string} data.address.state
 * @param {Object} data.name - Customer name
 * @param {string} data.name.first
 * @param {string} data.name.middle
 * @param {string} data.name.last
 * @param {Object} data.phone - Customer phone
 * @param {string} data.phone.country_code
 * @param {string} data.phone.number
 * @param {string} data.email - Customer email
 * @param {string} data.traceId - Unique trace ID
 * @returns {Object} Customer creation response
 */
const createCustomer = async (data) => {
  try {
    await ensureTokenIsValid();

    const payload = {
      address: data.address,
      name: data.name,
      phone: data.phone,
      email: data.email
    };

    const response = await axios.post(
      `https://developer.flutterwave.com/reference/customers_create`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-Trace-Id': data.traceId
        }
      }
    );
    console.log('The response:', response.data);
    return {
      status: response.data.status,
      message: response.data.message,
      data: response.data.data
    };
  } catch (err) {
    console.log('The error response:', err);
    console.error('Customer creation error:', err.response ? err.response.data : err.message);
    throw err.response ? err.response.data : err;
  }
};

/**
 * Update a customer record in Flutterwave
 * @param {string} customerId - Flutterwave customer ID
 * @param {Object} data - Customer data to update
 * @param {Object} data.address - Customer address (optional)
 * @param {Object} data.name - Customer name (optional)
 * @param {Object} data.phone - Customer phone (optional)
 * @param {Object} data.meta - Additional metadata (optional)
 * @param {string} data.traceId - Unique trace ID
 * @returns {Object} Customer update response
 */
const updateCustomer = async (customerId, data) => {
  try {
    await ensureTokenIsValid();

    const payload = {};
    if (data.address) payload.address = data.address;
    if (data.name) payload.name = data.name;
    if (data.phone) payload.phone = data.phone;
    if (data.meta) payload.meta = data.meta;

    const response = await axios.put(
      `${FLW_BASE_URL}/customers/${customerId}`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-Trace-Id': data.traceId
        }
      }
    );

    console.log('Customer update response:', response.data);

    return {
      status: response.data.status,
      message: response.data.message,
      data: response.data.data
    };
  } catch (err) {
    console.error('Customer update error:', err.response ? err.response.data : err.message);
    throw err.response ? err.response.data : err;
  }
};

/**
 * Search for a customer by email
 * @param {Object} searchData
 * @param {string} searchData.email - Customer email to search
 * @param {number} searchData.page - Page number (default: 1)
 * @param {number} searchData.size - Page size (default: 10)
 * @param {string} searchData.traceId - Unique trace ID
 * @returns {Object} Customer search results
 */
const searchCustomer = async (searchData) => {
  try {
    await ensureTokenIsValid();

    const page = searchData.page || 1;
    const size = searchData.size || 10;

    const response = await axios.post(
      `${FLW_BASE_URL}/customers/search?page=${page}&size=${size}`,
      {
        email: searchData.email
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-Trace-Id': searchData.traceId
        }
      }
    );

    return {
      status: response.data.status,
      message: response.data.message,
      data: response.data.data
    };
  } catch (err) {
    console.error('Customer search error:', err.response ? err.response.data : err.message);
    throw err.response ? err.response.data : err;
  }
};

/**
 * Add a payment method (card or bank) for a customer
 * @param {Object} data - Payment method data
 * @param {string} data.type - Payment method type: "card" or "bank"
 * @param {string} data.userId - MongoDB user ID to lookup flw_customer_id
 * @param {Object} data.card - Card details (for card payment method)
 * @param {Object} data.bank - Bank details (for bank payment method)
 * @param {Object} data.meta - Additional metadata (optional)
 * @param {string} data.traceId - Unique trace ID
 * @returns {Object} Payment method creation response
 */
const addPaymentMethod = async (data) => {
  try {
    await ensureTokenIsValid();

    const {
      type, // "card" or "bank"
      userId,
      card,
      bank,
      meta,
    } = data;

    if (!type || (type !== 'card' && type !== 'bank')) {
      throw new Error('addPaymentMethod: "type" is required and must be either "card" or "bank".');
    }

    if (!userId) {
      throw new Error('addPaymentMethod: "userId" is required.');
    }

    // Look up user and get their Flutterwave customer ID
    const user = await User.findById(userId).select('flw_customer_id email');
    if (!user) {
      throw new Error('addPaymentMethod: User not found.');
    }
    if (!user.flw_customer_id) {
      throw new Error('addPaymentMethod: User does not have a Flutterwave customer ID. Please update profile first.');
    }

    const payload = {
      type,
      customer_id: user.flw_customer_id
    };

    if (type === 'card' && card) {
      payload.card = card;
    }

    if (type === 'bank' && bank) {
      payload.bank = bank;
    }

    if (meta) {
      payload.meta = meta;
    }

    const headers = {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Trace-Id': generateId(),
      'X-Idempotency-Key': generateId()
    };

    const response = await axios.post(
      `${FLW_BASE_URL}/payment-methods`,
      payload,
      { headers }
    );

    return {
      status: response.data.status,
      message: response.data.message,
      data: response.data.data
    };
  } catch (err) {
    console.error(
      'Payment method creation error:',
      err?.response?.data || err.message
    );
    throw err?.response?.data || err;
  }
};

/**
 * Initiate a charge on a customer's payment method
 * @param {Object} data - Charge data
 * @param {string} data.userId - MongoDB user ID to lookup flw_customer_id
 * @param {string} data.reference - Unique payment reference
 * @param {string} data.currency - Currency code (e.g., USD, NGN)
 * @param {string} data.payment_method_id - Payment method ID
 * @param {string} data.redirect_url - URL to redirect after payment
 * @param {number} data.amount - Amount to charge
 * @param {Object} data.meta - Additional metadata (optional)
 * @returns {Object} Charge initiation response with next_action
 * next_action types: requires_pin, requires_otp, redirect_url, requires_additional_fields, payment_Instructions
 */
const initiateCharge = async (data) => {
  try {
    await ensureTokenIsValid();

    const {
      userId,
      reference,
      currency,
      payment_method_id,
      redirect_url,
      amount,
      meta
    } = data;

    if (!userId) {
      throw new Error('initiateCharge: "userId" is required.');
    }

    if (!reference || !currency || !payment_method_id || !redirect_url || !amount) {
      throw new Error('initiateCharge: reference, currency, payment_method_id, redirect_url, and amount are required.');
    }

    // Look up user and get their Flutterwave customer ID
    const user = await User.findById(userId).select('flw_customer_id email');
    if (!user) {
      throw new Error('initiateCharge: User not found.');
    }
    if (!user.flw_customer_id) {
      throw new Error('initiateCharge: User does not have a Flutterwave customer ID. Please update profile first.');
    }

    const payload = {
      reference,
      currency,
      customer_id: user.flw_customer_id,
      payment_method_id,
      redirect_url,
      amount
    };

    if (meta) payload.meta = meta;

    const response = await axios.post(
      `${FLW_BASE_URL}/charges`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-Trace-Id': generateId(),
          'X-Idempotency-Key': generateId()
        }
      }
    );

    return {
      status: response.data.status,
      message: response.data.message,
      data: response.data.data
    };
  } catch (err) {
    console.error('Charge initiation error:', err.response ? err.response.data : err.message);
    throw err.response ? err.response.data : err;
  }
};

/**
 * Authorize a charge with additional authentication details (PIN, OTP, etc.)
 * @param {string} chargeId - The charge ID to authorize
 * @param {Object} data - Authorization data
 * @param {string} data.pin - Card PIN (if next_action was requires_pin)
 * @param {string} data.otp - One-time password (if next_action was requires_otp)
 * @param {Object} data.additional_fields - Additional fields (if next_action was requires_additional_fields)
 * @param {string} data.traceId - Unique trace ID
 * @returns {Object} Charge authorization response
 */
const authorizeCharge = async (chargeId, data) => {
  try {
    await ensureTokenIsValid();

    const payload = {};
    if (data.pin) payload.pin = data.pin;
    if (data.otp) payload.otp = data.otp;
    if (data.additional_fields) payload.additional_fields = data.additional_fields;

    const response = await axios.post(
      `${FLW_BASE_URL}/charges/${chargeId}/authorize`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-Trace-Id': data.traceId
        }
      }
    );

    return {
      status: response.data.status,
      message: response.data.message,
      data: response.data.data
    };
  } catch (err) {
    console.error('Charge authorization error:', err.response ? err.response.data : err.message);
    throw err.response ? err.response.data : err;
  }
};

module.exports = {
  directTransfer,
  createCustomer,
  updateCustomer,
  searchCustomer,
  addPaymentMethod,
  initiateCharge,
  authorizeCharge
}
