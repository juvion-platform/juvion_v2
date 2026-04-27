/**
 * Small circular avatar for a person row (Student / Faculty / Staff /
 * Parent). Tries to fetch a presigned thumb URL from
 * `GET /api/people/{entityType}/:id/photo-url?variant=thumb`; falls back
 * to an initials avatar on:
 *   - error (404, 500, network)
 *   - "no photo" (server returns 200 with empty `{}`)
 *   - <img> load failure (CORS / expired presign / network)
 *
 * Performance: per-row useQuery is auto-deduped by React Query (same key →
 * one in-flight request) and cached for 30 minutes. The actual image bytes
 * are deferred via `loading="lazy"`, so rows below the fold don't pull
 * pixels from S3 until the user scrolls. With ~50 rows per page this fires
 * 50 cheap presign GETs on mount; if that becomes a bottleneck, a future
 * batch endpoint (`POST /photo-urls` accepting `entityIds[]`) could
 * collapse them. See completion signal for the follow-up.
 *
 * The query-key prefix `['entity-photo-url', entityType, entityId, 'thumb']`
 * matches the prefix used by `PersonPhotoBlock`, so caches stay warm across
 * the list page and the detail page for the same entity.
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getEntityPhotoUrl, type PersonEntityType } from '../../services/people';

interface Props {
  entityType: PersonEntityType;
  entityId: string;
  /** Display name for the initials fallback + img alt text. */
  personName?: string;
  /** Pixel size of the (square) avatar. Default 32. */
  size?: number;
}

const STALE_TIME_MS = 30 * 60 * 1000; // 30 minutes — presigns are valid much longer.

function computeInitials(name?: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  const initials = (first + last).toUpperCase();
  return initials || '?';
}

export default function PersonThumbnail({ entityType, entityId, personName, size = 32 }: Props) {
  const [broken, setBroken] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['entity-photo-url', entityType, entityId, 'thumb'],
    queryFn: () => getEntityPhotoUrl(entityType, entityId, 'thumb'),
    staleTime: STALE_TIME_MS,
    // No retry: a 404 / 500 / no-photo response should fall straight through
    // to the initials avatar, not retry-storm the backend.
    retry: false,
  });

  const sizeStyle: React.CSSProperties = { width: size, height: size };
  const fontSize = Math.max(10, Math.round(size * 0.4));

  if (isLoading) {
    return (
      <div
        className="rounded-full bg-slate-200 animate-pulse"
        style={sizeStyle}
        aria-hidden="true"
      />
    );
  }

  const thumbUrl = data?.thumb?.url;
  const showImage = !isError && !broken && Boolean(thumbUrl);

  if (showImage) {
    return (
      <img
        src={thumbUrl}
        alt={personName ? `${personName} photo` : 'Profile photo'}
        loading="lazy"
        onError={() => setBroken(true)}
        className="rounded-full object-cover bg-slate-100"
        style={sizeStyle}
      />
    );
  }

  // Initials fallback — gradient avatar matching the existing teal/blue brand.
  return (
    <div
      className="rounded-full bg-gradient-to-br from-teal-400 to-blue-500 text-white font-semibold flex items-center justify-center select-none"
      style={{ ...sizeStyle, fontSize }}
      aria-label={personName ? `${personName} initials` : 'Initials'}
      title={personName}
    >
      {computeInitials(personName)}
    </div>
  );
}
