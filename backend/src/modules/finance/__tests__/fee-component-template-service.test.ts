import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import mongoose from 'mongoose';

import * as svc from '../fee-component-template-service';
import { FeeComponentTemplate } from '../../../models/finance/FeeComponentTemplate';
import { AuditLog } from '../../../shared/audit';
import { seedFeeComponentTemplateForCollege } from '../../../scripts/seed-fee-component-template';
import {
  setupMongo,
  teardownMongo,
  clearCollections,
} from '../../../__tests__/helpers/mongoMemory';

/**
 * Task 6 — fee-component-template-service
 *
 * Covers:
 *   - listComponents with category / applicableToYear filters
 *   - createComponent validation + defaults
 *   - updateComponent safeguards for default vs custom
 *   - deleteComponent safeguards
 *   - buildComponentsFromTemplate year filter + zero amounts
 *   - Audit log emission on mutations
 */

const oid = () => new mongoose.Types.ObjectId();

async function seedCollegeAndTemplate(): Promise<{ collegeId: string }> {
  const collegeId = String(oid());
  await seedFeeComponentTemplateForCollege(collegeId);
  return { collegeId };
}

describe('fee-component-template-service', () => {
  beforeAll(async () => {
    await setupMongo();
  });
  afterAll(async () => {
    await teardownMongo();
  });
  afterEach(async () => {
    await clearCollections();
  });

  describe('CANONICAL_FEE_COMPONENTS re-export', () => {
    it('re-exports the 33-component canonical table', () => {
      expect(Array.isArray(svc.CANONICAL_FEE_COMPONENTS)).toBe(true);
      expect(svc.CANONICAL_FEE_COMPONENTS.length).toBe(33);
    });
  });

  describe('listComponents', () => {
    it('returns all 33 components sorted by displayOrder', async () => {
      const { collegeId } = await seedCollegeAndTemplate();
      const items = await svc.listComponents(collegeId);
      expect(items.length).toBe(33);
      const orders = items.map((i) => i.displayOrder);
      const sorted = [...orders].sort((a, b) => a - b);
      expect(orders).toEqual(sorted);
      // First by canonical order is tuition_fee
      expect(items[0]!.componentKey).toBe('tuition_fee');
    });

    it('filters by category', async () => {
      const { collegeId } = await seedCollegeAndTemplate();
      const items = await svc.listComponents(collegeId, { category: 'caution' });
      expect(items.length).toBe(3);
      for (const i of items) expect(i.category).toBe('caution');
    });

    it('filters by applicableToYear: includes empty (all-years) and those containing the year', async () => {
      const { collegeId } = await seedCollegeAndTemplate();
      const year4 = await svc.listComponents(collegeId, { applicableToYear: 4 });
      // Every returned component must be either all-years ([]) or include 4
      for (const i of year4) {
        expect(
          i.applicableToYears.length === 0 || i.applicableToYears.includes(4),
        ).toBe(true);
      }
      // Negative assertion: a component restricted to [1] should NOT appear
      const keys = year4.map((i) => i.componentKey);
      expect(keys).not.toContain('workshop_fee'); // [1]
      expect(keys).not.toContain('admission_fee'); // [1]
      // Positive assertions
      expect(keys).toContain('tuition_fee'); // []
      expect(keys).toContain('project_fee'); // [4]
      expect(keys).toContain('internship_fee'); // [3, 4]
      expect(keys).toContain('alumni_fee'); // [4]
    });

    it('scopes by collegeId (multi-tenancy)', async () => {
      const { collegeId } = await seedCollegeAndTemplate();
      const { collegeId: other } = await seedCollegeAndTemplate();
      const a = await svc.listComponents(collegeId);
      const b = await svc.listComponents(other);
      expect(a.length).toBe(33);
      expect(b.length).toBe(33);
      for (const doc of a) expect(String(doc.collegeId)).toBe(collegeId);
    });
  });

  describe('createComponent', () => {
    it('creates a custom (isDefault=false) component with audit log', async () => {
      const { collegeId } = await seedCollegeAndTemplate();
      const before = await AuditLog.countDocuments({});
      const created = await svc.createComponent(
        collegeId,
        {
          componentKey: 'textbook_bundle_fee',
          displayLabel: 'Textbook Bundle Fee',
          category: 'infrastructure',
          isRefundable: false,
          defaultOneTime: true,
          applicableToYears: [1],
        },
        'user-1',
      );
      expect(created.componentKey).toBe('textbook_bundle_fee');
      expect(created.isDefault).toBe(false);
      expect(created.isRefundable).toBe(false);
      expect(created.defaultOneTime).toBe(true);
      const after = await AuditLog.countDocuments({});
      expect(after).toBe(before + 1);
      const last = await AuditLog.findOne({
        entityType: 'FeeComponentTemplate',
        action: 'create',
      }).sort({ timestamp: -1 });
      expect(last).toBeTruthy();
      expect(last!.performedBy).toBe('user-1');
    });

    it('auto-increments displayOrder = max + 10 when omitted', async () => {
      const { collegeId } = await seedCollegeAndTemplate();
      const created = await svc.createComponent(
        collegeId,
        {
          componentKey: 'coding_platform_fee',
          displayLabel: 'Coding Platform License Fee',
          category: 'infrastructure',
        },
        'user-1',
      );
      // canonical max is 33
      expect(created.displayOrder).toBe(43);
    });

    it('respects provided displayOrder', async () => {
      const { collegeId } = await seedCollegeAndTemplate();
      const created = await svc.createComponent(
        collegeId,
        {
          componentKey: 'special_fee',
          displayLabel: 'Special Fee',
          category: 'infrastructure',
          displayOrder: 2,
        },
        'user-1',
      );
      expect(created.displayOrder).toBe(2);
    });

    it('defaults isRefundable=false, defaultOneTime=false, applicableToYears=[] when omitted', async () => {
      const { collegeId } = await seedCollegeAndTemplate();
      const created = await svc.createComponent(
        collegeId,
        {
          componentKey: 'misc_fee',
          displayLabel: 'Miscellaneous Fee',
          category: 'infrastructure',
        },
        'user-1',
      );
      expect(created.isRefundable).toBe(false);
      expect(created.defaultOneTime).toBe(false);
      expect(created.applicableToYears).toEqual([]);
    });

    it('rejects invalid componentKey (uppercase, spaces, leading digit)', async () => {
      const { collegeId } = await seedCollegeAndTemplate();
      const bad = ['Tuition', 'my fee', '1leading', 'has-dash', ''];
      for (const k of bad) {
        await expect(
          svc.createComponent(
            collegeId,
            {
              componentKey: k,
              displayLabel: 'X',
              category: 'infrastructure',
            },
            'user-1',
          ),
        ).rejects.toMatchObject({ statusCode: 400 });
      }
    });

    it('rejects duplicate componentKey within same college with 409', async () => {
      const { collegeId } = await seedCollegeAndTemplate();
      // tuition_fee already seeded as default
      await expect(
        svc.createComponent(
          collegeId,
          {
            componentKey: 'tuition_fee',
            displayLabel: 'Tuition (Duplicate)',
            category: 'academic',
          },
          'user-1',
        ),
      ).rejects.toMatchObject({ statusCode: 409 });
    });

    it('allows same componentKey across different colleges', async () => {
      const { collegeId } = await seedCollegeAndTemplate();
      const otherId = String(oid());
      // otherId has no seed — still create a custom under it with an already-used key in the first
      const created = await svc.createComponent(
        otherId,
        {
          componentKey: 'tuition_fee',
          displayLabel: 'Tuition Fee (other college)',
          category: 'academic',
        },
        'user-1',
      );
      expect(created.componentKey).toBe('tuition_fee');
      expect(String(created.collegeId)).toBe(otherId);
      // no interference
      const a = await svc.listComponents(collegeId, { category: 'academic' });
      expect(a.find((c) => c.componentKey === 'tuition_fee')!.isDefault).toBe(true);
    });
  });

  describe('updateComponent — default safeguards', () => {
    it('allows updating displayLabel and displayOrder on a default', async () => {
      const { collegeId } = await seedCollegeAndTemplate();
      const def = await FeeComponentTemplate.findOne({
        collegeId,
        componentKey: 'tuition_fee',
      });
      expect(def).toBeTruthy();
      const updated = await svc.updateComponent(
        collegeId,
        String(def!._id),
        { displayLabel: 'Tuition (custom label)', displayOrder: 0 },
        'user-1',
      );
      expect(updated.displayLabel).toBe('Tuition (custom label)');
      expect(updated.displayOrder).toBe(0);
      expect(updated.isDefault).toBe(true);
      const audits = await AuditLog.countDocuments({
        entityType: 'FeeComponentTemplate',
        action: 'update',
      });
      expect(audits).toBeGreaterThan(0);
    });

    it('rejects changes to category/isRefundable/defaultOneTime/applicableToYears on defaults with 403', async () => {
      const { collegeId } = await seedCollegeAndTemplate();
      const def = await FeeComponentTemplate.findOne({
        collegeId,
        componentKey: 'tuition_fee',
      });
      const fields: Array<Partial<svc.UpdateComponentInput>> = [
        { category: 'lab' },
        { isRefundable: true },
        { defaultOneTime: true },
        { applicableToYears: [1, 2] },
      ];
      for (const data of fields) {
        await expect(
          svc.updateComponent(collegeId, String(def!._id), data, 'user-1'),
        ).rejects.toMatchObject({ statusCode: 403 });
      }
    });
  });

  describe('updateComponent — custom behavior', () => {
    it('allows full updates except componentKey on a custom', async () => {
      const { collegeId } = await seedCollegeAndTemplate();
      const created = await svc.createComponent(
        collegeId,
        {
          componentKey: 'custom_fee_x',
          displayLabel: 'Custom X',
          category: 'infrastructure',
        },
        'user-1',
      );
      const updated = await svc.updateComponent(
        collegeId,
        String(created._id),
        {
          displayLabel: 'Custom X v2',
          category: 'lab',
          isRefundable: true,
          defaultOneTime: true,
          applicableToYears: [2, 3],
          displayOrder: 99,
        },
        'user-1',
      );
      expect(updated.displayLabel).toBe('Custom X v2');
      expect(updated.category).toBe('lab');
      expect(updated.isRefundable).toBe(true);
      expect(updated.defaultOneTime).toBe(true);
      expect(updated.applicableToYears).toEqual([2, 3]);
      expect(updated.displayOrder).toBe(99);
    });

    it('rejects attempts to change componentKey on a custom with 403', async () => {
      const { collegeId } = await seedCollegeAndTemplate();
      const created = await svc.createComponent(
        collegeId,
        {
          componentKey: 'custom_fee_y',
          displayLabel: 'Custom Y',
          category: 'infrastructure',
        },
        'user-1',
      );
      await expect(
        svc.updateComponent(
          collegeId,
          String(created._id),
          // cast: componentKey isn't in UpdateComponentInput; guard should reject nonetheless
          { componentKey: 'new_key' } as unknown as svc.UpdateComponentInput,
          'user-1',
        ),
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it('returns 404 when updating a non-existent componentId', async () => {
      const { collegeId } = await seedCollegeAndTemplate();
      await expect(
        svc.updateComponent(collegeId, String(oid()), { displayLabel: 'x' }, 'user-1'),
      ).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe('deleteComponent', () => {
    it('rejects delete on a default with 403', async () => {
      const { collegeId } = await seedCollegeAndTemplate();
      const def = await FeeComponentTemplate.findOne({
        collegeId,
        componentKey: 'tuition_fee',
      });
      await expect(
        svc.deleteComponent(collegeId, String(def!._id), 'user-1'),
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it('allows delete on a custom + emits audit log', async () => {
      const { collegeId } = await seedCollegeAndTemplate();
      const created = await svc.createComponent(
        collegeId,
        {
          componentKey: 'custom_delete_me',
          displayLabel: 'Deletable',
          category: 'infrastructure',
        },
        'user-1',
      );
      await svc.deleteComponent(collegeId, String(created._id), 'user-1');
      const gone = await FeeComponentTemplate.findById(created._id);
      expect(gone).toBeNull();
      const audit = await AuditLog.findOne({
        entityType: 'FeeComponentTemplate',
        action: 'delete',
        entityId: String(created._id),
      });
      expect(audit).toBeTruthy();
      expect(audit!.performedBy).toBe('user-1');
    });

    it('returns 404 when deleting a non-existent componentId', async () => {
      const { collegeId } = await seedCollegeAndTemplate();
      await expect(
        svc.deleteComponent(collegeId, String(oid()), 'user-1'),
      ).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe('buildComponentsFromTemplate', () => {
    it('returns components applicable to year 4 with amount=0 and oneTime mapped', async () => {
      const { collegeId } = await seedCollegeAndTemplate();
      const items = await svc.buildComponentsFromTemplate(collegeId, 4);
      // every item applies to year 4 (either all or contains 4)
      expect(items.length).toBeGreaterThan(0);
      for (const i of items) {
        expect(i.amount).toBe(0);
        expect(typeof i.oneTime).toBe('boolean');
        expect(typeof i.name).toBe('string');
      }
      const keys = items.map((i) => i.componentKey);
      expect(keys).toContain('tuition_fee');
      expect(keys).toContain('project_fee');
      expect(keys).toContain('alumni_fee');
      expect(keys).not.toContain('workshop_fee'); // year [1] only
      expect(keys).not.toContain('admission_fee'); // year [1] only
    });

    it('excludes year-1-only components when building for year 2', async () => {
      const { collegeId } = await seedCollegeAndTemplate();
      const items = await svc.buildComponentsFromTemplate(collegeId, 2);
      const keys = items.map((i) => i.componentKey);
      expect(keys).not.toContain('admission_fee');
      expect(keys).not.toContain('workshop_fee');
      expect(keys).not.toContain('project_fee'); // year [4]
      expect(keys).toContain('tuition_fee');
    });

    it('sorts returned items by displayOrder', async () => {
      const { collegeId } = await seedCollegeAndTemplate();
      const items = await svc.buildComponentsFromTemplate(collegeId, 1);
      const orders = items.map((i) => i.displayOrder);
      const sorted = [...orders].sort((a, b) => a - b);
      expect(orders).toEqual(sorted);
    });

    it('maps displayLabel→name and defaultOneTime→oneTime', async () => {
      const { collegeId } = await seedCollegeAndTemplate();
      const items = await svc.buildComponentsFromTemplate(collegeId, 1);
      const admission = items.find((i) => i.componentKey === 'admission_fee');
      expect(admission).toBeTruthy();
      expect(admission!.name).toBe('Admission Fee');
      expect(admission!.oneTime).toBe(true);
      const tuition = items.find((i) => i.componentKey === 'tuition_fee');
      expect(tuition!.oneTime).toBe(false);
      expect(tuition!.name).toBe('Tuition Fee');
    });
  });
});
