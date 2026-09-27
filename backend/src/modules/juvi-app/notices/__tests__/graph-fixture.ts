import { AudienceGraph, PersonNode, emptyAudienceGraph } from '../audience';

/**
 * A small college for the pure tests:
 *   departments cse, ece · programme btech · batches b24 (btech), b23 (btech)
 *   sections sA (b24, cse), sB (b24, ece), sC (b23, cse)
 *   offerings o1 (sA, taught by f1), o2 (sB), o3 (sC, no enrolments → roster)
 *   hostel block h1
 */
export function graphFixture(): AudienceGraph {
  const g = emptyAudienceGraph('JIT');
  g.departments.set('cse', { name: 'Computer Science' });
  g.departments.set('ece', { name: 'Electronics' });
  g.programmes.set('btech', { name: 'B.Tech' });
  g.batches.set('b24', { name: '2024 Batch', programmeId: 'btech' });
  g.batches.set('b23', { name: '2023 Batch', programmeId: 'btech' });
  g.sections.set('sA', { name: 'A', batchId: 'b24', departmentId: 'cse' });
  g.sections.set('sB', { name: 'B', batchId: 'b24', departmentId: 'ece' });
  g.sections.set('sC', { name: 'C', batchId: 'b23', departmentId: 'cse' });
  g.offerings.set('o1', { label: 'CS201 · A', sectionId: 'sA', departmentId: 'cse', facultyIds: ['f1'] });
  g.offerings.set('o2', { label: 'EC201 · B', sectionId: 'sB', departmentId: 'ece', facultyIds: ['f2'] });
  g.offerings.set('o3', { label: 'CS301 · C', sectionId: 'sC', departmentId: 'cse', facultyIds: ['f1'] });
  g.blocks.set('h1', { name: 'Krishna' });

  const add = (p: Partial<PersonNode> & Pick<PersonNode, 'personId' | 'kind'>) => g.people.set(p.personId, {
    accountId: null, personaCodes: [], isHod: false, sectionIds: [], offeringIds: [], labels: {}, ...p,
  });
  add({ personId: 's1', kind: 'student', accountId: 'a1', personaCodes: ['L-STU'], departmentId: 'cse', batchId: 'b24', sectionIds: ['sA'], offeringIds: ['o1'], hostelBlockId: 'h1', labels: { batch: '2024 Batch', section: 'A', department: 'Computer Science' } });
  add({ personId: 's2', kind: 'student', personaCodes: ['L-STU'], departmentId: 'ece', batchId: 'b24', sectionIds: ['sB'], offeringIds: ['o2'], labels: { batch: '2024 Batch', section: 'B', department: 'Electronics' } });
  add({ personId: 's3', kind: 'student', accountId: 'a3', personaCodes: ['L-STU'], departmentId: 'cse', batchId: 'b23', sectionIds: ['sC'], offeringIds: ['o3'], labels: { batch: '2023 Batch', section: 'C', department: 'Computer Science' } });
  add({ personId: 'f1', kind: 'faculty', accountId: 'a4', personaCodes: ['F-FAC'], departmentId: 'cse', offeringIds: ['o1', 'o3'], labels: { department: 'Computer Science' } });
  add({ personId: 'hod1', kind: 'faculty', personaCodes: ['F-HOD'], isHod: true, departmentId: 'cse', labels: { department: 'Computer Science' } });
  add({ personId: 'f2', kind: 'faculty', personaCodes: ['F-FAC'], departmentId: 'ece', labels: { department: 'Electronics' } });
  add({ personId: 'st1', kind: 'staff', accountId: 'a7', personaCodes: ['ST-EXAM'], labels: {} });
  add({ personId: 'st2', kind: 'staff', personaCodes: ['ST-ADM-TC'], departmentId: 'cse', labels: { department: 'Computer Science' } });
  return g;
}

export const ids = (people: PersonNode[]) => people.map((p) => p.personId);
