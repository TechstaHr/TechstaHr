const crypto = require('crypto');

// Generate a random string of 64 bytes and convert it to base64
const jwtSecret = crypto.randomBytes(64).toString('base64');

console.log('Generated JWT Secret:');
console.log(jwtSecret);
console.log('\nMake sure to save this secret securely in your environment variables!');
