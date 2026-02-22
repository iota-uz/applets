import { currentRequest } from './context';

export type CurrentUser = {
  id: string
  tenantId: string
  permissions: string[]
  requestId?: string
}

function requiredHeader(headers: Headers, name: string): string {
  const value = headers.get(name);
  if (!value || value.trim() === '') {
    throw new Error(`${name} header is required`);
  }
  return value;
}

export const auth = {
  async currentUser(): Promise<CurrentUser> {
    const request = currentRequest();
    const headers = request.headers;
    const id = requiredHeader(headers, 'x-iota-user-id');
    const tenantId = requiredHeader(headers, 'x-iota-tenant-id');
    const permissionsHeader = headers.get('x-iota-permissions') ?? '';
    const requestID = headers.get('x-iota-request-id') ?? undefined;
    const permissions = permissionsHeader
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    return {
      id,
      tenantId,
      permissions,
      requestId: requestID,
    };
  },
};

