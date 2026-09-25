import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildOpenApiDocument, stableStringify } from '../document';

const EXPECTED_PATHS = [
  '/institutions/{code}', '/config',
  '/auth/sign-in', '/auth/refresh', '/auth/sign-out', '/auth/change-password',
  '/me', '/me/settings', '/me/onboarding/advance', '/me/devices', '/me/devices/{id}', '/me/devices/revoke-others', '/me/photo',
  '/spaces', '/channels/{id}', '/channels/{id}/mute', '/channels/{id}/read',
];

describe('mobile OpenAPI document', () => {
  const doc = buildOpenApiDocument() as any;

  it('is OpenAPI 3.1 served under the v1 prefix with bearer auth', () => {
    expect(doc.openapi).toBe('3.1.0');
    expect(doc.servers).toEqual([{ url: '/api/juvi-app/v1' }]);
    expect(doc.components.securitySchemes.bearerAuth).toMatchObject({ type: 'http', scheme: 'bearer' });
  });

  it('declares every v1 route and nothing else', () => {
    expect(Object.keys(doc.paths).sort()).toEqual([...EXPECTED_PATHS].sort());
    expect(doc.paths['/auth/sign-in'].post.security).toBeUndefined();
    expect(doc.paths['/me'].get.security).toEqual([{ bearerAuth: [] }]);
    expect(doc.paths['/auth/sign-in'].post.responses['401']).toBeDefined();
    expect(doc.components.schemas.ErrorEnvelope).toBeDefined();
  });

  it('names every component and operation so the Dart client is predictable', () => {
    expect(Object.keys(doc.components.schemas).sort()).toEqual([
      'ChangePasswordRequest', 'ChannelDetail', 'Config', 'Devices', 'ErrorEnvelope', 'InstitutionLookup', 'Me', 'MuteResult',
      'OnboardingAdvance', 'OnboardingState', 'PhotoResult', 'ReadResult', 'RefreshRequest', 'RevokedCount', 'SettingsPatch',
      'Settings', 'SignInRequest', 'SignInResponse', 'Spaces', 'Tokens',
    ].sort());
    expect(doc.paths['/auth/sign-in'].post.operationId).toBe('signIn');
    expect(doc.paths['/channels/{id}/mute'].delete.operationId).toBe('unmuteChannel');
    expect(doc.paths['/me'].get.tags).toEqual(['mobile']);
  });

  it('stableStringify orders keys so the file is deterministic', () => {
    expect(stableStringify({ b: 1, a: { d: 2, c: [3, { f: 1, e: 2 }] } })).toBe('{\n  "a": {\n    "c": [\n      3,\n      {\n        "e": 2,\n        "f": 1\n      }\n    ],\n    "d": 2\n  },\n  "b": 1\n}');
  });

  it('matches the committed mobile/api/openapi.json (run npm run openapi:mobile -w backend if this fails)', () => {
    const file = resolve(__dirname, '../../../../../../mobile/api/openapi.json');
    expect(existsSync(file)).toBe(true);
    expect(readFileSync(file, 'utf8')).toBe(stableStringify(doc) + '\n');
  });
});
