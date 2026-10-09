import { OpenAPIRegistry, OpenApiGeneratorV31, extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import {
  signInSchema, refreshSchema, changePasswordSchema, signInResponseSchema, tokensResponseSchema,
  meResponseSchema, settingsSchema, settingsPatchSchema, onboardingAdvanceSchema, onboardingStateSchema, devicesResponseSchema,
} from '../accounts/schemas';
import { spacesResponseSchema, channelDetailSchema, muteResponseSchema, readResponseSchema } from '../spaces/schemas';
import {
  coursesTaughtItemSchema, dayClassSchema, dayViewSchema, dueInvoiceItemSchema,
  studentAcademicsSchema, studentDuesSchema, teachingSchema, todaySchema,
} from '../home/schemas';
import { institutionLookupResponseSchema, configResponseSchema } from '../config/schemas';
import {
  noticeAttachmentSchema, noticeCardSchema, noticeDetailSchema, attentionItemSchema, attentionResponseSchema, noticeListQuerySchema, noticeListResponseSchema,
  seenResponseSchema, attachmentUrlResponseSchema, ackRequestSchema, ackResponseSchema, dismissResponseSchema,
  remindersSchema, reachPersonSchema, reachCommentSchema, reachGroupSchema, reachResponseSchema,
  pendingQuerySchema, pendingPersonSchema, pendingResponseSchema, remindResponseSchema,
} from '../notices/schemas';
import {
  pushTokenRequestSchema, receiptsRequestSchema, receiptsResponseSchema, eventsRequestSchema, eventsResponseSchema,
} from '../notifications/schemas';

extendZodWithOpenApi(z);

const errorEnvelopeSchema = z.object({
  error: z.object({
    code: z.enum([
      'VALIDATION_FAILED', 'INVALID_CREDENTIALS', 'TOKEN_EXPIRED', 'SESSION_INVALIDATED', 'ACCOUNT_DEACTIVATED', 'FORBIDDEN', 'NOT_FOUND', 'GONE', 'UPDATE_REQUIRED', 'COOLDOWN', 'INSTITUTION_PAUSED', 'INTERNAL',
      // Juvi notices
      'NOTICE_NOT_FOUND', 'ALREADY_ACKNOWLEDGED', 'NOTICE_ARCHIVED', 'NOT_PUBLISHER', 'REMINDER_LIMIT', 'ACK_REQUIRED', 'ACK_NOT_REQUIRED',
      // Juvi notifications
      'RECEIPT_INVALID',
    ]),
    message: z.string(),
    // Optional, never null (the Dart generator cannot parse an object-or-null field).
    /** ALREADY_ACKNOWLEDGED: the existing acknowledgement. */
    ack: ackResponseSchema.optional(),
    /** REMINDER_LIMIT: the notice's reminders. */
    reminders: remindersSchema.optional(),
  }).passthrough(),
});

type Method = 'get' | 'post' | 'put' | 'patch' | 'delete';
interface RouteDef {
  /** Becomes the Dart method name on the generated `MobileApi` class. */
  operationId: string;
  method: Method; path: string; summary: string; auth: boolean;
  body?: z.ZodTypeAny; response?: z.ZodTypeAny; status?: number; params?: string[]; query?: z.AnyZodObject; errors: number[]; multipart?: boolean;
}

const json = (schema: z.ZodTypeAny) => ({ content: { 'application/json': { schema } } });

export type OpenApiDocument = ReturnType<OpenApiGeneratorV31['generateDocument']>;

export function buildOpenApiDocument(): OpenApiDocument {
  const registry = new OpenAPIRegistry();
  const bearerAuth = registry.registerComponent('securitySchemes', 'bearerAuth', { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' });

  // Registered ahead of `C` so ChannelDetail.notices below can reference the component
  // instance itself: zod-to-openapi only $refs a nested schema when it is literally the
  // object `.register()` returned, not merely the same schema used elsewhere by value.
  const NoticeCardComponent = registry.register('NoticeCard', noticeCardSchema);

  // §7.1–§7.4: item schemas are registered first; every consumer of them re-registers
  // with the registered component in place of the raw nested schema — same pattern as
  // ChannelDetail's rebuild below, since zod-to-openapi only $refs the instance that
  // `.register()` returned, never a plain equal-valued schema.
  const AttentionItemComponent = registry.register('AttentionItem', attentionItemSchema);
  const Attention = registry.register('Attention', z.object({ ...attentionResponseSchema.shape, items: z.array(AttentionItemComponent) }));
  const DayClassComponent = registry.register('DayClass', dayClassSchema);
  const DayView = registry.register('DayView', z.object({ ...dayViewSchema.shape, classes: z.array(DayClassComponent) }));
  const DueInvoiceItemComponent = registry.register('DueInvoiceItem', dueInvoiceItemSchema);
  const StudentDues = registry.register('StudentDues', z.object({ ...studentDuesSchema.shape, invoices: z.array(DueInvoiceItemComponent) }));
  const StudentAcademics = registry.register('StudentAcademics', z.object({ ...studentAcademicsSchema.shape, dues: StudentDues }));
  const CoursesTaughtItemComponent = registry.register('CoursesTaughtItem', coursesTaughtItemSchema);
  const FacultyCourses = registry.register('FacultyCourses', z.object({ coursesTaught: z.array(CoursesTaughtItemComponent) }));
  const MeAcademics = registry.register('MeAcademics', z.union([StudentAcademics, FacultyCourses]));
  const Today = registry.register('Today', z.object({ ...todaySchema.shape, today: DayView, tomorrow: DayView }));
  const Teaching = registry.register('Teaching', z.object({ ...teachingSchema.shape, today: DayView, tomorrow: DayView }));

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
    // Rebuilt with the registered NoticeCard component in place of the raw array item
    // schema, so `notices` $refs NoticeCard instead of inlining a duplicate object.
    ChannelDetail: registry.register('ChannelDetail', z.object({ ...channelDetailSchema.shape, notices: z.array(NoticeCardComponent) })),
    MuteResult: registry.register('MuteResult', muteResponseSchema),
    ReadResult: registry.register('ReadResult', readResponseSchema),
    NoticeAttachment: registry.register('NoticeAttachment', noticeAttachmentSchema),
    NoticeReminders: registry.register('NoticeReminders', remindersSchema),
    ReachPerson: registry.register('ReachPerson', reachPersonSchema),
    ReachComment: registry.register('ReachComment', reachCommentSchema),
    ReachGroup: registry.register('ReachGroup', reachGroupSchema),
    PendingPerson: registry.register('PendingPerson', pendingPersonSchema),
    NoticeCard: NoticeCardComponent,
    NoticeDetail: registry.register('NoticeDetail', noticeDetailSchema),
    Attention,
    AttentionItem: AttentionItemComponent,
    CoursesTaughtItem: CoursesTaughtItemComponent,
    DayClass: DayClassComponent,
    DayView,
    DueInvoiceItem: DueInvoiceItemComponent,
    FacultyCourses,
    MeAcademics,
    StudentAcademics,
    StudentDues,
    Teaching,
    Today,
    NoticeList: registry.register('NoticeList', noticeListResponseSchema),
    SeenResult: registry.register('SeenResult', seenResponseSchema),
    AckRequest: registry.register('AckRequest', ackRequestSchema),
    AckResult: registry.register('AckResult', ackResponseSchema),
    DismissResult: registry.register('DismissResult', dismissResponseSchema),
    NoticeAttachmentUrl: registry.register('NoticeAttachmentUrl', attachmentUrlResponseSchema),
    NoticeReach: registry.register('NoticeReach', reachResponseSchema),
    NoticePending: registry.register('NoticePending', pendingResponseSchema),
    RemindResult: registry.register('RemindResult', remindResponseSchema),
    PushTokenRequest: registry.register('PushTokenRequest', pushTokenRequestSchema),
    ReceiptsRequest: registry.register('ReceiptsRequest', receiptsRequestSchema),
    ReceiptsResult: registry.register('ReceiptsResult', receiptsResponseSchema),
    EventsRequest: registry.register('EventsRequest', eventsRequestSchema),
    EventsResult: registry.register('EventsResult', eventsResponseSchema),
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
    { operationId: 'getAttention', method: 'get', path: '/attention', summary: 'Due items: the notice stack, or every attention item with kinds=all', auth: true, query: z.object({ kinds: z.literal('all').optional() }), response: C.Attention, errors: [400, 401] },
    { operationId: 'getToday', method: 'get', path: '/today', summary: 'Student today: today + tomorrow class lists and the glance', auth: true, response: C.Today, errors: [401, 403] },
    { operationId: 'getTeaching', method: 'get', path: '/teaching', summary: 'Faculty today: today + tomorrow classes, next teaching day, faculty kind', auth: true, response: C.Teaching, errors: [401, 403] },
    { operationId: 'getMeAcademics', method: 'get', path: '/me/academics', summary: 'Attendance and dues (student) or courses taught (faculty)', auth: true, response: C.MeAcademics, errors: [401, 403] },
    { operationId: 'listNotices', method: 'get', path: '/notices', summary: 'Notice cards by segment (due, done, all, published), cursor-paged', auth: true, query: noticeListQuerySchema, response: C.NoticeList, errors: [400, 401] },
    { operationId: 'getNotice', method: 'get', path: '/notices/{id}', summary: 'Notice detail with my state (does not mark it seen)', auth: true, params: ['id'], response: C.NoticeDetail, errors: [401, 404] },
    { operationId: 'markNoticeSeen', method: 'post', path: '/notices/{id}/seen', summary: 'Mark a notice seen (once)', auth: true, params: ['id'], response: C.SeenResult, errors: [401, 404] },
    { operationId: 'acknowledgeNotice', method: 'post', path: '/notices/{id}/ack', summary: 'Acknowledge a notice; 409 ALREADY_ACKNOWLEDGED carries the existing record', auth: true, params: ['id'], body: C.AckRequest, response: C.AckResult, errors: [400, 401, 404, 409] },
    { operationId: 'dismissNotice', method: 'post', path: '/notices/{id}/dismiss', summary: 'Dismiss a notice that needs no acknowledgement', auth: true, params: ['id'], response: C.DismissResult, errors: [401, 404, 409] },
    { operationId: 'getNoticeAttachmentUrl', method: 'get', path: '/notices/{id}/attachments/{key}', summary: 'A 5-minute download URL for one attachment (key URL-encoded)', auth: true, params: ['id', 'key'], response: C.NoticeAttachmentUrl, errors: [401, 404, 503] },
    { operationId: 'getNoticeReach', method: 'get', path: '/notices/{id}/reach', summary: 'Reach for the publisher', auth: true, params: ['id'], response: C.NoticeReach, errors: [401, 403, 404] },
    { operationId: 'listNoticePending', method: 'get', path: '/notices/{id}/reach/pending', summary: 'Pending members for the publisher, grouped and searchable', auth: true, params: ['id'], query: pendingQuerySchema, response: C.NoticePending, errors: [400, 401, 403, 404] },
    { operationId: 'remindNotice', method: 'post', path: '/notices/{id}/remind', summary: 'Send a reminder (at most two)', auth: true, params: ['id'], response: C.RemindResult, errors: [401, 403, 404, 409] },
    { operationId: 'registerPushToken', method: 'put', path: '/me/devices/current/push-token', summary: 'Register this device\'s FCM token (cleared from any other session first)', auth: true, body: C.PushTokenRequest, status: 204, errors: [400, 401] },
    { operationId: 'clearPushToken', method: 'delete', path: '/me/devices/current/push-token', summary: 'Remove this device\'s FCM token', auth: true, status: 204, errors: [401] },
    { operationId: 'postNotificationReceipts', method: 'post', path: '/notifications/receipts', summary: 'Delivered and opened receipts; each item is authorised by its HMAC receipt, not a session', auth: false, body: C.ReceiptsRequest, response: C.ReceiptsResult, errors: [400, 401, 429] },
    { operationId: 'postEvents', method: 'post', path: '/events', summary: 'Product analytics: allow-listed names, id-like props; invalid events are dropped one by one', auth: true, body: C.EventsRequest, response: C.EventsResult, errors: [400, 401] },
    { operationId: 'getFirstNotice', method: 'get', path: '/onboarding/first-notice', summary: 'Onboarding step 4: the welcome notice', auth: true, response: C.NoticeDetail, errors: [401] },
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
        ...(r.query ? { query: r.query } : {}),
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
  });
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
