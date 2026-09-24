import { OpenAPIRegistry, OpenApiGeneratorV31, extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import {
  signInSchema, refreshSchema, changePasswordSchema, signInResponseSchema, tokensResponseSchema,
  meResponseSchema, settingsSchema, settingsPatchSchema, onboardingAdvanceSchema, onboardingStateSchema, devicesResponseSchema,
} from '../accounts/schemas';
import { spacesResponseSchema, channelDetailSchema, muteResponseSchema, readResponseSchema } from '../spaces/schemas';
import { institutionLookupResponseSchema, configResponseSchema } from '../config/schemas';

extendZodWithOpenApi(z);

const errorEnvelopeSchema = z.object({
  error: z.object({
    code: z.enum(['VALIDATION_FAILED', 'INVALID_CREDENTIALS', 'TOKEN_EXPIRED', 'SESSION_INVALIDATED', 'ACCOUNT_DEACTIVATED', 'FORBIDDEN', 'NOT_FOUND', 'GONE', 'UPDATE_REQUIRED', 'COOLDOWN', 'INSTITUTION_PAUSED', 'INTERNAL']),
    message: z.string(),
  }).passthrough(),
});

type Method = 'get' | 'post' | 'put' | 'patch' | 'delete';
interface RouteDef {
  /** Becomes the Dart method name on the generated `MobileApi` class. */
  operationId: string;
  method: Method; path: string; summary: string; auth: boolean;
  body?: z.ZodTypeAny; response?: z.ZodTypeAny; status?: number; params?: string[]; errors: number[]; multipart?: boolean;
}

const json = (schema: z.ZodTypeAny) => ({ content: { 'application/json': { schema } } });

export function buildOpenApiDocument(): Record<string, unknown> {
  const registry = new OpenAPIRegistry();
  const bearerAuth = registry.registerComponent('securitySchemes', 'bearerAuth', { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' });

  // Every schema is a named component so the generated Dart models have stable class names
  // (SignInRequest, Me, Spaces, ChannelDetail, …) instead of derived inline names.
  const C = {
    ErrorEnvelope: registry.register('ErrorEnvelope', errorEnvelopeSchema),
    InstitutionLookup: registry.register('InstitutionLookup', institutionLookupResponseSchema),
    Config: registry.register('Config', configResponseSchema),
    SignInRequest: registry.register('SignInRequest', signInSchema),
    SignInResponse: registry.register('SignInResponse', signInResponseSchema),
    RefreshRequest: registry.register('RefreshRequest', refreshSchema),
    Tokens: registry.register('Tokens', tokensResponseSchema),
    ChangePasswordRequest: registry.register('ChangePasswordRequest', changePasswordSchema),
    Me: registry.register('Me', meResponseSchema),
    Settings: registry.register('Settings', settingsSchema),
    SettingsPatch: registry.register('SettingsPatch', settingsPatchSchema),
    OnboardingAdvance: registry.register('OnboardingAdvance', onboardingAdvanceSchema),
    OnboardingState: registry.register('OnboardingState', onboardingStateSchema),
    Devices: registry.register('Devices', devicesResponseSchema),
    RevokedCount: registry.register('RevokedCount', z.object({ revoked: z.number().int() })),
    PhotoResult: registry.register('PhotoResult', z.object({ photoUrl: z.string().nullable() })),
    Spaces: registry.register('Spaces', spacesResponseSchema),
    ChannelDetail: registry.register('ChannelDetail', channelDetailSchema),
    MuteResult: registry.register('MuteResult', muteResponseSchema),
    ReadResult: registry.register('ReadResult', readResponseSchema),
  };

  const routes: RouteDef[] = [
    { operationId: 'lookupInstitution', method: 'get', path: '/institutions/{code}', summary: 'Resolve an institution code for sign-in', auth: false, params: ['code'], response: C.InstitutionLookup, errors: [404, 429] },
    { operationId: 'getConfig', method: 'get', path: '/config', summary: 'Institution configuration for the signed-in user', auth: true, response: C.Config, errors: [401, 503] },
    { operationId: 'signIn', method: 'post', path: '/auth/sign-in', summary: 'Sign in with institution, identifier and password', auth: false, body: C.SignInRequest, response: C.SignInResponse, errors: [400, 401, 403, 429, 503] },
    { operationId: 'refresh', method: 'post', path: '/auth/refresh', summary: 'Rotate the refresh token', auth: false, body: C.RefreshRequest, response: C.Tokens, errors: [400, 401] },
    { operationId: 'signOut', method: 'post', path: '/auth/sign-out', summary: 'Revoke this session', auth: true, status: 204, errors: [401] },
    { operationId: 'changePassword', method: 'post', path: '/auth/change-password', summary: 'Change password; revokes other sessions', auth: true, body: C.ChangePasswordRequest, status: 204, errors: [400, 401] },
    { operationId: 'getMe', method: 'get', path: '/me', summary: 'Identity card, account state, settings, institution', auth: true, response: C.Me, errors: [401, 403, 426, 503] },
    { operationId: 'getSettings', method: 'get', path: '/me/settings', summary: 'Notification and language settings', auth: true, response: C.Settings, errors: [401] },
    { operationId: 'updateSettings', method: 'patch', path: '/me/settings', summary: 'Update settings', auth: true, body: C.SettingsPatch, response: C.Settings, errors: [400, 401] },
    { operationId: 'advanceOnboarding', method: 'post', path: '/me/onboarding/advance', summary: 'Complete the current onboarding step', auth: true, body: C.OnboardingAdvance, response: C.OnboardingState, errors: [400, 401] },
    { operationId: 'listDevices', method: 'get', path: '/me/devices', summary: 'Signed-in devices', auth: true, response: C.Devices, errors: [401] },
    { operationId: 'revokeDevice', method: 'delete', path: '/me/devices/{id}', summary: 'Sign out one device', auth: true, params: ['id'], status: 204, errors: [401, 404] },
    { operationId: 'revokeOtherDevices', method: 'post', path: '/me/devices/revoke-others', summary: 'Sign out every other device', auth: true, response: C.RevokedCount, errors: [401] },
    { operationId: 'uploadPhoto', method: 'post', path: '/me/photo', summary: 'Upload a profile photo (multipart field "file")', auth: true, multipart: true, response: C.PhotoResult, errors: [400, 401, 503] },
    { operationId: 'listSpaces', method: 'get', path: '/spaces', summary: 'Grouped channel list', auth: true, response: C.Spaces, errors: [401] },
    { operationId: 'getChannel', method: 'get', path: '/channels/{id}', summary: 'Channel header and About', auth: true, params: ['id'], response: C.ChannelDetail, errors: [400, 401, 404] },
    { operationId: 'muteChannel', method: 'put', path: '/channels/{id}/mute', summary: 'Mute a channel', auth: true, params: ['id'], response: C.MuteResult, errors: [400, 401, 404] },
    { operationId: 'unmuteChannel', method: 'delete', path: '/channels/{id}/mute', summary: 'Unmute a channel', auth: true, params: ['id'], response: C.MuteResult, errors: [400, 401, 404] },
    { operationId: 'markChannelRead', method: 'post', path: '/channels/{id}/read', summary: 'Mark a channel read', auth: true, params: ['id'], response: C.ReadResult, errors: [400, 401, 404] },
  ];

  for (const r of routes) {
    const responses: Record<string, unknown> = {};
    const okStatus = r.status ?? 200;
    responses[String(okStatus)] = r.response ? { description: 'OK', ...json(r.response) } : { description: 'No content' };
    for (const code of r.errors) responses[String(code)] = { description: `Error ${code}`, ...json(C.ErrorEnvelope) };
    registry.registerPath({
      operationId: r.operationId,
      tags: ['mobile'],                    // one tag → one generated class, `MobileApi`
      method: r.method, path: r.path, summary: r.summary,
      ...(r.auth ? { security: [{ [bearerAuth.name]: [] }] } : {}),
      request: {
        ...(r.params ? { params: z.object(Object.fromEntries(r.params.map((p) => [p, z.string()]))) } : {}),
        ...(r.body ? { body: json(r.body) } : {}),
        ...(r.multipart ? { body: { content: { 'multipart/form-data': { schema: z.object({ file: z.string().openapi({ format: 'binary' }) }) } } } } : {}),
      },
      responses: responses as never,
    });
  }

  const generator = new OpenApiGeneratorV31(registry.definitions);
  return generator.generateDocument({
    openapi: '3.1.0',
    info: { title: 'Juvi Mobile API', version: '1.0.0', description: 'Contract for the Juvi Flutter app. Generated from the backend Zod schemas; do not edit by hand.' },
    servers: [{ url: '/api/juvi-app/v1' }],
  }) as unknown as Record<string, unknown>;
}

/** JSON with recursively sorted object keys and two-space indentation, so diffs are meaningful. */
export function stableStringify(value: unknown): string {
  const sort = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(sort);
    if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v as object).sort().map((k) => [k, sort((v as Record<string, unknown>)[k])]));
    return v;
  };
  return JSON.stringify(sort(value), null, 2);
}
