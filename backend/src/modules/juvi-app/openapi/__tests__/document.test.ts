import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildOpenApiDocument, stableStringify } from '../document';

const EXPECTED_PATHS = [
  '/institutions/{code}', '/config',
  '/auth/sign-in', '/auth/refresh', '/auth/sign-out', '/auth/change-password',
  '/me', '/me/settings', '/me/onboarding/advance', '/me/devices', '/me/devices/{id}', '/me/devices/revoke-others', '/me/photo',
  '/spaces', '/channels/{id}', '/channels/{id}/mute', '/channels/{id}/read',
  '/attention', '/notices', '/notices/{id}', '/notices/{id}/seen', '/notices/{id}/ack', '/notices/{id}/dismiss',
  '/notices/{id}/attachments/{key}', '/notices/{id}/reach', '/notices/{id}/reach/pending', '/notices/{id}/remind',
  '/onboarding/first-notice',
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
      'AckRequest', 'AckResult', 'Attention', 'ChangePasswordRequest', 'ChannelDetail', 'Config', 'Devices', 'DismissResult',
      'ErrorEnvelope', 'InstitutionLookup', 'Me', 'MuteResult', 'NoticeAttachment', 'NoticeAttachmentUrl', 'NoticeCard',
      'NoticeDetail', 'NoticeList', 'NoticePending', 'NoticeReach', 'NoticeReminders', 'OnboardingAdvance', 'OnboardingState',
      'PendingPerson', 'PhotoResult', 'ReachComment', 'ReachGroup', 'ReachPerson', 'ReadResult', 'RefreshRequest', 'RemindResult',
      'RevokedCount', 'SeenResult', 'SettingsPatch', 'Settings', 'SignInRequest', 'SignInResponse', 'Spaces', 'Tokens',
    ].sort());
    expect(doc.paths['/auth/sign-in'].post.operationId).toBe('signIn');
    expect(doc.paths['/channels/{id}/mute'].delete.operationId).toBe('unmuteChannel');
    expect(doc.paths['/me'].get.tags).toEqual(['mobile']);
    expect(doc.paths['/notices/{id}/ack'].post.operationId).toBe('acknowledgeNotice');
    expect(doc.paths['/notices/{id}/reach/pending'].get.operationId).toBe('listNoticePending');
    expect(doc.paths['/onboarding/first-notice'].get.operationId).toBe('getFirstNotice');
  });

  it('describes the notice endpoints: query parameters, error codes and flat components', () => {
    const listParams = doc.paths['/notices'].get.parameters.map((p: { name: string; in: string }) => `${p.in}:${p.name}`).sort();
    expect(listParams).toEqual(['query:cursor', 'query:limit', 'query:office', 'query:segment']);
    expect(doc.paths['/notices/{id}/attachments/{key}'].get.parameters.map((p: { name: string }) => p.name).sort()).toEqual(['id', 'key']);
    expect(doc.paths['/notices/{id}/ack'].post.responses['409']).toBeDefined();
    expect(doc.paths['/notices/{id}/reach'].get.responses['403']).toBeDefined();
    expect(doc.components.schemas.ErrorEnvelope.properties.error.properties.code.enum).toEqual(expect.arrayContaining([
      'NOTICE_NOT_FOUND', 'ALREADY_ACKNOWLEDGED', 'NOTICE_ARCHIVED', 'NOT_PUBLISHER', 'REMINDER_LIMIT', 'ACK_REQUIRED', 'ACK_NOT_REQUIRED',
    ]));
    for (const name of ['NoticeDetail', 'ReachComment', 'NoticeReach']) expect(doc.components.schemas[name].allOf, name).toBeUndefined();
    expect(doc.components.schemas.ChannelDetail.properties.notices.items).toEqual({ $ref: '#/components/schemas/NoticeCard' });
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
