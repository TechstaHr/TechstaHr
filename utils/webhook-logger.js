const fs = require('fs');
const path = require('path');

const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const logFilePath = path.join(logsDir, 'webhook.log');

const logWebhook = (message, data = null) => {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    message,
    data: data ? JSON.stringify(data, null, 2) : null
  };
  
  const logLine = `\n[${timestamp}] ${message}\n${data ? JSON.stringify(data, null, 2) : ''}\n${'='.repeat(80)}\n`;
  
  // Append to file
  fs.appendFileSync(logFilePath, logLine, 'utf8');
  
  console.log(logLine);
};

module.exports = { logWebhook };
