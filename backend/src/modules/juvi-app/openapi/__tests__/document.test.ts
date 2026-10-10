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
  '/me/devices/current/push-token', '/notifications/receipts', '/events',
  '/today', '/teaching', '/me/academics',
  // 011 §3.6 — the in-app delete and the explicit cancellation
  '/me/account', '/me/account/deletion-request',
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
      'AckRequest', 'AckResult', 'Attention', 'AttentionItem', 'ChangePasswordRequest', 'ChannelDetail', 'Config',
      'CoursesTaughtItem', 'DayClass', 'DayView', 'Devices', 'DismissResult', 'DueInvoiceItem', 'ErrorEnvelope', 'EventsRequest', 'EventsResult',
      'FacultyCourses', 'InstitutionLookup', 'Me', 'MeAcademics', 'MuteResult', 'NoticeAttachment', 'NoticeAttachmentUrl', 'NoticeCard',
      'NoticeDetail', 'NoticeList', 'NoticePending', 'NoticeReach', 'NoticeReminders', 'OnboardingAdvance', 'OnboardingState',
      'PendingPerson', 'PhotoResult', 'PushTokenRequest', 'ReachComment', 'ReachGroup', 'ReachPerson', 'ReadResult', 'ReceiptsRequest', 'ReceiptsResult',
      'RefreshRequest', 'RemindResult', 'RevokedCount', 'SeenResult', 'SettingsPatch', 'Settings', 'SignInRequest', 'SignInResponse', 'Spaces',
      'StudentAcademics', 'StudentDues', 'Teaching', 'Today', 'Tokens',
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
    const errorProps = doc.components.schemas.ErrorEnvelope.properties.error;
    expect(errorProps.properties.ack).toMatchObject({ type: 'object', properties: { ackAt: { type: 'string' } } });
    expect(errorProps.properties.reminders).toMatchObject({ type: 'object', properties: { used: { type: 'integer' } } });
    expect(errorProps.required).toEqual(['code', 'message']);
    for (const name of ['NoticeDetail', 'ReachComment', 'NoticeReach']) expect(doc.components.schemas[name].allOf, name).toBeUndefined();
    expect(doc.components.schemas.ChannelDetail.properties.notices.items).toEqual({ $ref: '#/components/schemas/NoticeCard' });
  });

  it('describes the notification endpoints: the receipts route has no session', () => {
    expect(doc.paths['/notifications/receipts'].post.security).toBeUndefined();
    expect(doc.paths['/notifications/receipts'].post.operationId).toBe('postNotificationReceipts');
    expect(doc.paths['/me/devices/current/push-token'].put.operationId).toBe('registerPushToken');
    expect(doc.paths['/me/devices/current/push-token'].delete.responses['204']).toBeDefined();
    expect(doc.paths['/events'].post.security).toEqual([{ bearerAuth: [] }]);
    expect(doc.components.schemas.ErrorEnvelope.properties.error.properties.code.enum).toContain('RECEIPT_INVALID');
    expect(doc.components.schemas.EventsRequest.properties.events.items.properties.props).toMatchObject({ type: 'object', additionalProperties: {} });
  });

  it('Reach carries the delivery block, and each pending member its delivery state', () => {
    expect(doc.components.schemas.NoticeReach.required).toContain('delivery');
    expect(doc.components.schemas.NoticeReach.properties.delivery.properties.suppressed.required).toEqual(['muted', 'tierOff', 'noDevice']);
    expect(doc.components.schemas.PendingPerson.properties.delivery.enum).toEqual(
      ['not_delivered', 'delivered', 'opened', 'muted', 'tier_off', 'no_device', 'scheduled', 'none'],
    );
  });

  it('names the Today, Teaching and MeAcademics endpoints (§7.1-§7.3)', () => {
    expect(doc.paths['/today'].get.operationId).toBe('getToday');
    expect(doc.paths['/teaching'].get.operationId).toBe('getTeaching');
    expect(doc.paths['/me/academics'].get.operationId).toBe('getMeAcademics');
    expect(doc.paths['/today'].get.responses['403']).toBeDefined();
    expect(doc.components.schemas.Today.properties.glance).toBeDefined();
    const refTargets = JSON.stringify(doc.components.schemas.MeAcademics);
    expect(refTargets).toContain('#/components/schemas/StudentAcademics');
    expect(refTargets).toContain('#/components/schemas/FacultyCourses');
  });

  it('documents attention kinds=all and the timeline event names (§7.4, §7.5)', () => {
    expect(doc.paths['/attention'].get.parameters?.map((p: { name: string }) => p.name)).toContain('kinds');
    expect(doc.components.schemas.EventsRequest.properties.events.items.properties.name.enum).toEqual(
      expect.arrayContaining(['timeline.class_opened', 'glance.opened', 'post_class_prompt.shown', 'post_class_prompt.opened']),
    );
  });

  it('declares the two account-deletion deletes and the Me deletion fields (011 §3.6)', () => {
    const del = doc.paths['/me/account'].delete;
    expect(del.operationId).toBe('deleteAccount');
    expect(del.security).toEqual([{ bearerAuth: [] }]);
    expect(del.responses['204']).toBeDefined();
    expect(del.responses['401']).toBeDefined();
    // Bodyless on purpose: a schema here would give the generated Dart method a return type
    // for a body that never arrives (`signOut` and `clearPushToken` are the same shape).
    expect(del.responses['204'].content).toBeUndefined();

    const cancel = doc.paths['/me/account/deletion-request'].delete;
    expect(cancel.operationId).toBe('cancelAccountDeletion');
    expect(cancel.responses['204']).toBeDefined();
    expect(cancel.responses['409']).toBeDefined();
    expect(doc.components.schemas.ErrorEnvelope.properties.error.properties.code.enum).toContain('DELETION_NOT_CANCELLABLE');

    // The R61 fields: nullable **and** required — an absent key and a null value are different
    // states, and the app renders "a deletion is pending" only for the latter.
    const me = doc.components.schemas.Me;
    expect(me.required).toEqual(expect.arrayContaining(['deletionRequestedAt', 'deletionRequestedVia']));
    for (const f of ['deletionRequestedAt', 'deletionRequestedVia'] as const) {
      expect(me.properties[f].type, f).toEqual(expect.arrayContaining(['null']));
    }
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
