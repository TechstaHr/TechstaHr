const fs = require('fs');
const path = require('path');
const ConnectDB = require('../config/db');
const Bank = require('../models/Bank');

const defaultFile = path.join(__dirname, '..', 'data', 'banks.json');
const filePath = process.argv[2] ? path.resolve(process.argv[2]) : defaultFile;
const DEFAULT_COUNTRY = 'Nigeria';
const DEFAULT_CURRENCY = 'NGN';

async function parseBanksFromFile(fp) {
  const raw = fs.readFileSync(fp, 'utf8');
  const json = JSON.parse(raw);

  const banksArray = Array.isArray(json)
    ? json
    : json && Array.isArray(json.data)
      ? json.data
      : null;

  if (!banksArray) {
    throw new Error('Unknown JSON format for banks (expect array or { data: [...] })');
  }

  return banksArray
    .map((bank) => {
      const code = bank.code && String(bank.code).trim();
      const bankName = (bank.bankName || bank.name || '').trim();

      if (!code || !bankName) {
        return null;
      }

      return {
        bankName,
        code,
        country: bank.country || DEFAULT_COUNTRY,
        currency: bank.currency || DEFAULT_CURRENCY,
      };
    })
    .filter(Boolean);
}

async function run() {
  try {
    if (!fs.existsSync(filePath)) {
      console.error('File not found:', filePath);
      process.exit(1);
    }

    const banks = await parseBanksFromFile(filePath);

    await ConnectDB();

    let inserted = 0;
    let updated = 0;

    for (const bank of banks) {
      if (!bank.bankName || !bank.code) {
        console.warn('Skipping invalid entry', bank);
        continue;
      }

      const filter = { code: bank.code };
      const update = {
        bankName: bank.bankName,
        code: bank.code,
        country: bank.country || 'Nigeria',
        currency: bank.currency || 'NGN',
      };

      const result = await Bank.findOneAndUpdate(filter, update, {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      });

      // simple heuristic: treat newly created docs as inserted
      if (result && result.createdAt && result.createdAt.getTime() === result.updatedAt.getTime()) {
        inserted++;
      } else {
        updated++;
      }
    }

    console.log(`Banks processed. inserted: ${inserted}, updated: ${updated}`);
    process.exit(0);
  } catch (err) {
    console.error('Populate banks failed:', err.message);
    process.exit(1);
  }
}

run();
