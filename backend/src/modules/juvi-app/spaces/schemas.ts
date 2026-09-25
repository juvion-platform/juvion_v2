import { z } from 'zod';

export const spaceChannelRowSchema = z.object({
  id: z.string(), name: z.string(), about: z.string(),
  scopeType: z.enum(['college', 'department', 'batch', 'course_offering', 'hostel_block']),
  templateCode: z.enum(['college', 'department', 'batch', 'course', 'hostel']),
  role: z.enum(['member', 'publisher']), muted: z.boolean(), memberCount: z.number().int(), archived: z.boolean(),
  nextClassAt: z.string().nullable(), nextClassLabel: z.string().nullable(),
});
export const spacesGroupSchema = z.object({
  key: z.enum(['college', 'department', 'batch', 'courses', 'hostel', 'archived']),
  title: z.string(), emptyHint: z.string().optional(), channels: z.array(spaceChannelRowSchema),
});
export const spacesResponseSchema = z.object({ groups: z.array(spacesGroupSchema), asOf: z.string() });
export type SpacesResponse = z.infer<typeof spacesResponseSchema>;
export type SpaceChannelRow = z.infer<typeof spaceChannelRowSchema>;

export const channelDetailSchema = z.object({
  id: z.string(), name: z.string(), about: z.string(),
  scopeType: spaceChannelRowSchema.shape.scopeType, templateCode: spaceChannelRowSchema.shape.templateCode,
  status: z.enum(['active', 'archived']), memberCount: z.number().int(),
  replyRule: z.enum(['allowed', 'announcement_only']), defaultPriority: z.enum(['routine', 'important']),
  role: z.enum(['member', 'publisher']), muted: z.boolean(), canPost: z.boolean(), canReply: z.boolean(),
  whoCanPost: z.string(), linkedObject: z.object({ type: z.string(), id: z.string().nullable() }),
});
export type ChannelDetail = z.infer<typeof channelDetailSchema>;

export const muteResponseSchema = z.object({ muted: z.boolean() });
export const readResponseSchema = z.object({ lastReadAt: z.string() });
