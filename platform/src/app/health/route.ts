/**
 * Liveness probe used by hosting platforms and local dev tooling.
 * Kept dependency-free so it works before the database is reachable.
 */
export function GET() {
  return Response.json({
    status: 'ok',
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
}
