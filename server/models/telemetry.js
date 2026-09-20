/**
 * UsingOpen: anonymous telemetry has been fully removed.
 * This module is kept as a no-op stub so that any remaining internal
 * call sites continue to work without sending anything, anywhere.
 * No network calls. No IDs. No PostHog. No data collection of any kind.
 */

const Telemetry = {
  sendTelemetry: async function () {
    return;
  },

  flush: async function () {
    return;
  },

  findOrCreateId: async function () {
    return null;
  },

  setUid: async function () {
    return null;
  },

  id: async function () {
    return null;
  },

  isDev: function () {
    return true;
  },

  client: function () {
    return null;
  },

  connect: async function () {
    return { client: null, distinctId: null };
  },
};

module.exports = { Telemetry };
