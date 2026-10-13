const config = require('../config');

/**
 * Firebase Cloud Messaging adapter.
 * Falls back to a no-op (logged) when Firebase is not configured, so the
 * rest of the app works with the in-app notification feed alone.
 */
function createPush() {
  if (!config.firebaseEnabled) {
    return {
      enabled: false,
      async send() {
        if (config.env !== 'test') console.log('[push] Firebase not configured – notification stored in-app only');
        return { sent: 0, skipped: true };
      },
    };
  }

  // Lazy require keeps startup fast and avoids init when not configured.
  const admin = require('firebase-admin');
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: config.firebase.projectId,
        clientEmail: config.firebase.clientEmail,
        privateKey: config.firebase.privateKey,
      }),
    });
  }

  return {
    enabled: true,
    async send(tokens, payload) {
      const valid = (tokens || []).filter(Boolean);
      if (!valid.length) return { sent: 0, skipped: true };
      try {
        const res = await admin.messaging().sendEachForMulticast({
          tokens: valid,
          notification: { title: payload.title, body: payload.body || '' },
          data: stringifyData(payload.data),
          android: { priority: 'high' },
          apns: { payload: { aps: { sound: 'default' } } },
        });
        return { sent: res.successCount, failed: res.failureCount };
      } catch (err) {
        console.error('[push] send failed', err.message);
        return { sent: 0, error: err.message };
      }
    },
  };
}

function stringifyData(data = {}) {
  return Object.fromEntries(
    Object.entries(data).map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)])
  );
}

module.exports = { createPush };
