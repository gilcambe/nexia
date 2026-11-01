'use strict';

const { createD1Driver } = require('../lib/firebase-lite/d1-backend');

function createD1Storage(env) {
  if (!env.NEXIA_D1_TOKEN || !env.NEXIA_D1_ACCOUNT_ID) {
    throw new Error('NEXIA_D1_TOKEN e NEXIA_D1_ACCOUNT_ID são necessários');
  }

  const driver = createD1Driver({
    token: env.NEXIA_D1_TOKEN,
    accountId: env.NEXIA_D1_ACCOUNT_ID
  });

  async function incrementUsage(key, { requests = 0, tokens = 0, errors = 0 }) {
    const doc = await driver.get([key]);
    const current = doc.get(key) || { requests: 0, tokens: 0, errors: 0 };
    const updated = {
      requests: current.requests + requests,
      tokens: current.tokens + tokens,
      errors: current.errors + errors
    };
    await driver.apply([{
      type: 'upsert',
      path: key,
      fields: updated
    }]);
  }

  async function getUsage(key) {
    const doc = await driver.get([key]);
    return doc.get(key) || { requests: 0, tokens: 0, errors: 0 };
  }

  return {
    incrementUsage,
    getUsage
  };
}

async function incrementUsage(providerId, { requests = 0, tokens = 0, errors = 0 }) {
  const date = new Date().toISOString().split('T')[0];
  const key = `${providerId}:${date}`;
  const d1Storage = createD1Storage(process.env);
  await d1Storage.incrementUsage(key, { requests, tokens, errors });
}

async function getUsage(providerId, date) {
  const key = `${providerId}:${date}`;
  const d1Storage = createD1Storage(process.env);
  return await d1Storage.getUsage(key);
}

module.exports = { createD1Storage, incrementUsage, getUsage };
