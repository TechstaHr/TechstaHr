const axios = require('axios');
const crypto = require('crypto');
const User = require('../models/User');
const sendEmail = require('../services/send-email');
const { renderToStaticMarkup } = require('react-dom/server');
const React = require('react');
const OtpEmail = require('../emails/OtpEmail.jsx');

const FLW_CLIENT_ID = process.env.FLW_CLIENT_ID
const FLW_CLIENT_SECRET = process.env.FLW_CLIENT_SECRET
const DEFAULT_FLW_BASE_URL = 'https://developersandbox-api.flutterwave.com';
const configuredBaseUrl = process.env.FLW_BASE_URL;
const FLW_BASE_URL = configuredBaseUrl?.includes('api.flutterwave.cloud/developersandbox')
  ? DEFAULT_FLW_BASE_URL
  : configuredBaseUrl || DEFAULT_FLW_BASE_URL;

if (configuredBaseUrl && configuredBaseUrl !== FLW_BASE_URL) {
  console.warn(`FLW_BASE_URL override: using ${FLW_BASE_URL} instead of ${configuredBaseUrl}`);
}
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
  } catch (error) {
    console.error('Error refreshing token:', error.response ? error.response.data : error.message);
  }
}

async function ensureTokenIsValid() {
  const currentTime = Date.now();
  const timeSinceLastRefresh = (currentTime - lastTokenRefreshTime) / 1000;
  const timeLeft = expiresIn - timeSinceLastRefresh;

  if (!accessToken || timeLeft < 60) { // refresh if less than 1 minute remains
    console.log('Refreshing token...');
    await refreshToken();
  } else if (shouldLogTokenStatus) {
    console.log(`Token is still valid for ${Math.floor(timeLeft)} seconds.`);
  }
}

setInterval(ensureTokenIsValid, 5000);


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

    console.log('Initiating direct transfer with payload:', JSON.stringify(payload, null, 2));
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
      email: data.email,
      address: data.address
    };

    if (data.name) payload.name = data.name;
    if (data.phone) payload.phone = data.phone;
    
    const response = await axios.post(
      `${FLW_BASE_URL}/customers`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'X-Trace-Id': data.traceId || generateId()
        }
      }
    );
    return {
      status: response.data.status,
      message: response.data.message,
      data: response.data.data
    };
  } catch (err) {
    // If customer already exists, try to fetch and return it instead of failing hard
    if (err?.response?.status === 409 && err?.response?.data?.error?.message?.toLowerCase().includes('already exists')) {
      try {
        const existing = await searchCustomer({
          email: data.email,
          traceId: data.traceId || generateId(),
          page: 1,
          size: 1
        });

        if (existing?.data?.length) {
          return {
            status: 'success',
            message: 'Customer already exists',
            data: existing.data[0]
          };
        }
      } catch (searchErr) {
        console.error('Customer exists but lookup failed:', searchErr?.response?.data || searchErr.message);
      }
    }

    console.error('Customer creation error:', err?.response?.data || err.message);
    throw err?.response?.data || err;
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
          'Accept': 'application/json',
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

    const response = await axios.get(`${FLW_BASE_URL}/customers`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Trace-Id': searchData.traceId
      }
    });

    const customers = response.data.data || [];
    const filtered = searchData.email
      ? customers.filter((cust) => cust?.email?.toLowerCase() === searchData.email.toLowerCase())
      : customers;

    return {
      status: response.data.status,
      message: response.data.message,
      data: filtered
    };
  } catch (err) {
    if (err?.response?.status === 404 || err?.response?.data?.error?.code === '1201404') {
      return {
        status: 'success',
        message: 'Customer not found',
        data: []
      };
    }
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

    let {
      type, // "card" or "bank_account"
      customer_id,
      card,
      bank_account,
      meta,
    } = data;

    // Auto-detect type if not provided based on what data is present
    if (!type) {
      if (bank_account) {
        type = 'bank_account';
      } else if (card) {
        type = 'card';
      }
    }

    if (!type || !['card', 'bank_account'].includes(type)) {
      throw new Error('addPaymentMethod: "type" is required and must be either "card" or "bank_account".');
    }

    if (!customer_id) {
      throw new Error('addPaymentMethod: "customer_id" is required.');
    }

    const payload = {
      type,
      customer_id
    };

    if (type === 'card') {
      if (!card || !card.nonce || !card.encrypted_card_number || !card.encrypted_expiry_month || 
          !card.encrypted_expiry_year || !card.encrypted_cvv) {
        throw new Error('addPaymentMethod: Card requires nonce, encrypted_card_number, encrypted_expiry_month, encrypted_expiry_year, and encrypted_cvv');
      }
      payload.card = card;
    }

    if (type === 'bank_account') {
      if (!bank_account || !bank_account.name || !bank_account.number || !bank_account.bank_code) {
        throw new Error('addPaymentMethod: Bank account requires name, number, and bank_code');
      }
      payload.bank_account = bank_account;
    }

    if (meta) {
      payload.meta = meta;
    }

    console.log('Adding payment method with payload:', JSON.stringify({ ...payload, card: payload.card ? '***ENCRYPTED***' : undefined }, null, 2));

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

    console.log('Payment method created:', response.data);

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
 * @param {number} data.amount - Amount to charge (must be greater than 200)
 * @param {Object} data.meta - Additional metadata (optional)
 * @param {Object} data.authorization - Optional authorization block (e.g., { otp: { code }, type: "otp" })
 * @param {boolean} data.recurring - Whether this charge is recurring (optional)
 * @param {string} data.order_id - Order identifier (auto-generated if not provided)
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
      meta,
      authorization,
      recurring,
      order_id
    } = data;

    if (!userId) {
      throw new Error('initiateCharge: "userId" is required.');
    }

    if (!reference || !currency || !payment_method_id || !redirect_url || !amount) {
      throw new Error('initiateCharge: reference, currency, payment_method_id, redirect_url, and amount are required.');
    }

    // Validate amount is greater than 200
    if (amount <= 200) {
      throw new Error('initiateCharge: amount must be greater than 200.');
    }

    // Look up user and get their Flutterwave customer ID
    const user = await User.findById(userId).select('flw_customer_id email');
    if (!user) {
      throw new Error('initiateCharge: User not found.');
    }
    if (!user.flw_customer_id) {
      throw new Error('initiateCharge: User does not have a Flutterwave customer ID. Please update profile first.');
    }

    // Auto-generate order_id if not provided
    const generatedOrderId = order_id || `ord_${crypto.randomBytes(6).toString('hex')}`;

    // Format reference: replace spaces with hyphens
    const formattedReference = reference.replace(/\s+/g, '-');

    const payload = {
      reference: formattedReference,
      currency,
      customer_id: user.flw_customer_id,
      payment_method_id,
      redirect_url,
      amount,
      order_id: generatedOrderId
    };

    if (meta) payload.meta = meta;
    
    // Handle authorization - auto-generate OTP code if type is otp and code not provided
    if (authorization) {
      const auth = { ...authorization };
      if (auth.type === 'otp' && auth.otp) {
        // Auto-generate OTP code if not provided
        if (!auth.otp.code) {
          const codeLength = Math.floor(Math.random() * 5) + 4; // Random between 4 and 8
          auth.otp.code = crypto.randomInt(10 ** (codeLength - 1), 10 ** codeLength).toString();
          console.log('Auto-generated OTP code (length:', codeLength, ', code:', auth.otp.code, ')');
        }
        try {
          const otpEmailHtml = renderToStaticMarkup(
            React.createElement(OtpEmail, {
              full_name: user.full_name.split(' ')[0] || user.email.split('@')[0],
              otp: auth.otp.code
            })
          );
          
          await sendEmail({
            to: user.email,
            subject: 'Your Payment Authorization Code',
            html: otpEmailHtml
          });
          
          console.log('OTP email sent successfully to:', user.email);
        } catch (emailError) {
          console.error('Failed to send OTP email:', emailError.message);
          // Don't throw - continue with charge even if email fails
        }
      }
      payload.authorization = auth;
    }
    
    if (typeof recurring === 'boolean') payload.recurring = recurring;

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
 * Authorize/update a charge with auth data (PIN, OTP, external_3ds, etc.)
 * @param {string} chargeId - The charge ID to authorize
 * @param {Object} data - Authorization data
 * @param {Object} data.authorization - Authorization block e.g. { type: 'otp', otp: { code } } or { type: 'pin', pin: { nonce, encrypted_pin } } or { type: 'external_3ds', external_3ds: { transaction_status } }
 * @param {Object} data.meta - Optional meta payload
 * @param {string} data.traceId - Unique trace ID
 * @returns {Object} Charge authorization response
 */
const updateCharge = async (chargeId, data) => {
  try {
    await ensureTokenIsValid();

    const payload = {};

    if (data.authorization) {
      payload.authorization = data.authorization;
    }

    if (data.pin && !payload.authorization) payload.pin = data.pin;
    if (data.otp && !payload.authorization) payload.otp = data.otp;
    if (data.additional_fields && !payload.authorization) payload.additional_fields = data.additional_fields;

    if (data.meta) payload.meta = data.meta;

    const response = await axios.post(
      `${FLW_BASE_URL}/charges/${chargeId}`,
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
  updateCharge,
}
