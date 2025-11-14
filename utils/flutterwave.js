const axios = require('axios');

const FLW_CLIENT_ID = process.env.FLW_CLIENT_ID
const FLW_CLIENT_SECRET = process.env.FLW_CLIENT_SECRET
const FLW_BASE_URL = process.env.FLW_BASE_URL;
let accessToken = null;
let expiresIn = 0; // token expiry time in seconds
let lastTokenRefreshTime = 0;

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
    console.log('Expires in:', expiresIn, 'seconds');
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
  } else {
    console.log(`Token is still valid for ${Math.floor(timeLeft)} seconds.`);
  }
}

setInterval(ensureTokenIsValid, 5000); // check every 5 seconds


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

module.exports = {
  directTransfer,
}
