// TODO: In a full implementation, this calls the integration layer's HTTP API.
// For now, it logs to standard out as structured JSON.
export async function logAction(entry: any): Promise<void> {
  console.log(JSON.stringify({
    _audit: true,
    timestamp: new Date().toISOString(),
    ...entry
  }));
}
