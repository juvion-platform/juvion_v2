/**
 * The people a publisher may name in a `custom` rule (spec §7.3), for the
 * portal composer's searchable picker (spec §8: no raw ids). The candidate
 * sets are exactly the ones assertAudienceInScope accepts for `custom`, so the
 * picker never offers someone the publish would refuse. Only names and group
 * labels leave the server (spec §10).
 */
import { Types } from 'mongoose';
import { AppError } from '../../../middleware/errorHandler';
import { Person } from '../../../models/people/Person';
import { AudienceGraph, PersonNode, groupLabel } from './audience';
import { loadAudienceGraph } from './audience-graph';
import { PublisherScope } from './scope';

export interface PersonOption { id: string; label: string; hint: string }

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** college: everyone · department: people in the HOD's department · offerings: students enrolled in them · none: nobody. */
export function customCandidates(scope: PublisherScope, g: AudienceGraph): PersonNode[] {
  const people = [...g.people.values()];
  switch (scope.kind) {
    case 'college': return people;
    case 'department': return scope.departmentId ? people.filter((p) => p.departmentId === scope.departmentId) : [];
    case 'offerings': {
      const mine = new Set(scope.offeringIds);
      return people.filter((p) => p.kind === 'student' && p.offeringIds.some((o) => mine.has(o)));
    }
    default: return [];
  }
}

/** Candidates whose name contains `q` (case-insensitive), alphabetical, at most `limit`. */
export async function searchCustomPeople(collegeId: string, scope: PublisherScope, q: string, limit: number): Promise<{ items: PersonOption[] }> {
  if (scope.kind === 'none') throw new AppError(403, 'You cannot publish notices.');
  const candidates = new Map(customCandidates(scope, await loadAudienceGraph(collegeId)).map((p) => [p.personId, p]));
  if (candidates.size === 0) return { items: [] };
  const filter: Record<string, unknown> = { collegeId, _id: { $in: [...candidates.keys()].map((id) => new Types.ObjectId(id)) } };
  const needle = q.trim();
  if (needle) filter.name = { $regex: escapeRegex(needle), $options: 'i' };
  const rows = await Person.find(filter).select('_id name').sort({ name: 1 }).limit(limit).lean();
  return {
    items: rows.map((r) => {
      const p = candidates.get(String(r._id))!;
      return { id: String(r._id), label: r.name, hint: groupLabel(p.kind, p.labels) };
    }),
  };
}
