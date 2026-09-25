import { describe, it, expect } from 'vitest';
import { computeExpectedMembers, emptyGraph, ErpGraph, AccountNode } from '../strategies';

function graph(): ErpGraph {
  const g = emptyGraph();
  g.branchDepartment.set('brCSE', 'dCSE'); g.branchDepartment.set('brECE', 'dECE');
  g.departments.set('dCSE', { hodFacultyId: 'fHOD' }); g.departments.set('dECE', {});
  g.sections.set('secA', { batchId: 'b24', branchId: 'brCSE', classAdvisorId: 'fADV' });
  g.sections.set('secE', { batchId: 'b24', branchId: 'brECE' });
  g.offerings.set('offDB', { sectionId: 'secA', facultyIds: ['fFAC', 'fCO'], enrollmentCount: 1 });
  g.offerings.set('offNoEnrol', { sectionId: 'secA', facultyIds: ['fFAC'], enrollmentCount: 0 });
  g.blocks.set('blkA', { wardenPersonId: 'pWARDEN', chiefWardenStaffId: 'stCHIEF' });
  const add = (n: AccountNode) => g.accounts.set(n.accountId, n);
  add({ accountId: 'aStu', kind: 'student', personId: 'pStu', isAdminOrPrincipal: false, student: { studentId: 'sStu', batchId: 'b24', branchId: 'brCSE', sectionIds: ['secA'], enrolledOfferingIds: ['offDB'], hostelBlockId: 'blkA' } });
  add({ accountId: 'aStu2', kind: 'student', personId: 'pStu2', isAdminOrPrincipal: false, student: { studentId: 'sStu2', batchId: 'b24', branchId: 'brCSE', sectionIds: ['secA'], enrolledOfferingIds: [] } });
  add({ accountId: 'aEce', kind: 'student', personId: 'pEce', isAdminOrPrincipal: false, student: { studentId: 'sEce', batchId: 'b24', branchId: 'brECE', sectionIds: ['secE'], enrolledOfferingIds: [] } });
  add({ accountId: 'aFac', kind: 'faculty', personId: 'pFac', isAdminOrPrincipal: false, faculty: { facultyId: 'fFAC', departmentId: 'dCSE', contractType: 'regular' } });
  add({ accountId: 'aCo', kind: 'faculty', personId: 'pCo', isAdminOrPrincipal: false, faculty: { facultyId: 'fCO', departmentId: 'dCSE', contractType: 'regular' } });
  add({ accountId: 'aHod', kind: 'faculty', personId: 'pHod', isAdminOrPrincipal: false, faculty: { facultyId: 'fHOD', departmentId: 'dCSE', contractType: 'regular' } });
  add({ accountId: 'aAdv', kind: 'faculty', personId: 'pAdv', isAdminOrPrincipal: false, faculty: { facultyId: 'fADV', departmentId: 'dECE', contractType: 'regular' } });
  add({ accountId: 'aAdj', kind: 'faculty', personId: 'pAdj', isAdminOrPrincipal: false, faculty: { facultyId: 'fADJ', departmentId: 'dCSE', contractType: 'adjunct' } });
  add({ accountId: 'aReg', kind: 'staff', personId: 'pReg', isAdminOrPrincipal: false, staff: { staffId: 'stREG', personaCode: 'ST-REG' } });
  add({ accountId: 'aAdm', kind: 'staff', personId: 'pAdm', isAdminOrPrincipal: false, staff: { staffId: 'stADM', personaCode: 'ST-ADM-TC' } });
  add({ accountId: 'aChief', kind: 'staff', personId: 'pChief', isAdminOrPrincipal: false, staff: { staffId: 'stCHIEF', personaCode: 'ST-WARDEN' } });
  add({ accountId: 'aWarden', kind: 'staff', personId: 'pWARDEN', isAdminOrPrincipal: false, staff: { staffId: 'stWARD' } });
  add({ accountId: 'aPrin', kind: 'staff', personId: 'pPrin', isAdminOrPrincipal: true, staff: { staffId: 'stPRIN' } });
  return g;
}
const roles = (m: Map<string, string>) => Object.fromEntries([...m.entries()].sort());

describe('computeExpectedMembers', () => {
  it('college: everyone except F4; admin/principal and staff publish', () => {
    const m = roles(computeExpectedMembers(graph(), { scopeType: 'college', scopeId: null }));
    expect(m.aStu).toBe('member'); expect(m.aFac).toBe('member');
    expect(m.aAdj).toBeUndefined();
    expect(m.aReg).toBe('publisher'); expect(m.aPrin).toBe('publisher');
  });

  it('department: students via branch, faculty via department minus F4; HOD, principal, registrar publish', () => {
    const m = roles(computeExpectedMembers(graph(), { scopeType: 'department', scopeId: 'dCSE' }));
    expect(m.aStu).toBe('member'); expect(m.aEce).toBeUndefined();
    expect(m.aFac).toBe('member'); expect(m.aAdv).toBeUndefined(); expect(m.aAdj).toBeUndefined();
    expect(m.aHod).toBe('publisher'); expect(m.aPrin).toBe('publisher'); expect(m.aReg).toBe('publisher');
    expect(m.aAdm).toBeUndefined();
  });

  it('batch: students by batch; admissions/registrar staff, class advisors and HODs of its branches publish', () => {
    const m = roles(computeExpectedMembers(graph(), { scopeType: 'batch', scopeId: 'b24' }));
    expect(m.aStu).toBe('member'); expect(m.aEce).toBe('member');
    expect(m.aAdm).toBe('publisher'); expect(m.aReg).toBe('publisher');
    expect(m.aAdv).toBe('publisher'); expect(m.aHod).toBe('publisher');
    expect(m.aFac).toBeUndefined(); expect(m.aChief).toBeUndefined();
  });

  it('course: enrolled students; assigned faculty publish; section roster fallback when no enrollments', () => {
    const withEnrol = roles(computeExpectedMembers(graph(), { scopeType: 'course_offering', scopeId: 'offDB' }));
    expect(withEnrol).toEqual({ aStu: 'member', aFac: 'publisher', aCo: 'publisher' });
    const fallback = roles(computeExpectedMembers(graph(), { scopeType: 'course_offering', scopeId: 'offNoEnrol' }));
    expect(fallback).toEqual({ aStu: 'member', aStu2: 'member', aFac: 'publisher' });
  });

  it('hostel: residents; warden person and chief-warden staff publish', () => {
    const m = roles(computeExpectedMembers(graph(), { scopeType: 'hostel_block', scopeId: 'blkA' }));
    expect(m).toEqual({ aStu: 'member', aWarden: 'publisher', aChief: 'publisher' });
  });

  it('unknown scope object yields nobody', () => {
    expect(computeExpectedMembers(graph(), { scopeType: 'department', scopeId: 'nope' }).size).toBe(0);
  });
});
