const STORAGE_ACCOUNT = 'wflowdev7273a083aue';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function readConfig(env = process.env) {
  const required = ['AZURE_TENANT_ID', 'WARD_API_AUDIENCE', 'WARD_ALLOWED_OBJECT_ID', 'AzureWebJobsStorage__accountName'];
  if (required.some(key => !env[key]?.trim())) throw new Error('Missing backend configuration');
  if (!UUID.test(env.AZURE_TENANT_ID) || !UUID.test(env.WARD_ALLOWED_OBJECT_ID))
    throw new Error('Invalid identity configuration');
  if (env.WARD_API_AUDIENCE !== '9b7b160d-9bc7-4712-b748-17ff3e70b706')
    throw new Error('Unapproved backend identity configuration');
  if (env.AzureWebJobsStorage__accountName !== STORAGE_ACCOUNT)
    throw new Error('Unapproved storage account');
  const origin = env.WARD_ALLOWED_ORIGIN || null;
  if (origin) {
    const url = new URL(origin);
    if (url.origin !== origin || !['https:', 'http:'].includes(url.protocol) ||
      (url.protocol === 'http:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))
      throw new Error('Invalid origin configuration');
  }
  const port = Number(env.PORT || 8787);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid port configuration');
  return {
    tenant: env.AZURE_TENANT_ID, audience: env.WARD_API_AUDIENCE,
    allowedObjectId: env.WARD_ALLOWED_OBJECT_ID, origin,
    host: env.HOST || '127.0.0.1', port,
    storage: { account: STORAGE_ACCOUNT, container: 'ward-flow-sessions' },
  };
}
