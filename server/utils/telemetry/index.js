// Anonymous telemetry has been removed in UsingOpen. This is a no-op
// kept so boot order and imports remain unchanged. Nothing is collected,
// no IDs are created, and no network calls are made.
async function setupTelemetry() {
  console.log(`UsingOpen telemetry: removed - no events will send.`);
  return true;
}

module.exports = setupTelemetry;
