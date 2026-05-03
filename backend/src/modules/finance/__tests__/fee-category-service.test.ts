import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import mongoose from 'mongoose';

import * as svc from '../fee-category-service';
import { FeeCategory } from '../../../models/finance/FeeCategory';
import { AuditLog } from '../../../shared/audit';
import {
  setupMongo,
  teardownMongo,
  clearCollections,
} from '../../../__tests__/helpers/mongoMemory';

/**
 * fee-category-service — CRUD for the per-college FeeCategory catalog
 * (OC / OBC / SC / ST / NRI / …). Mirrors the test shape of
 * fee-component-template-service.test.ts.
 *
 * Coverage:
 *  - createCategory happy path → DB row + audit log
 *  - createCategory duplicate code (same college) → 409
 *  - createCategory same code across different colleges → allowed
 *  - listCategories paginates + filters by status
 *  - listCategories scopes by collegeId (multi-tenancy)
 *  - getCategory success + 404
 *  - updateCategory partial (name only, code only)
 *  - updateCategory duplicate-code conflict → 409
 *  - deleteCategory removes row + audit log
 *  - deleteCategory 404
 */

const oid = () => new mongoose.Types.ObjectId();

describe('fee-category-service', () => {
  beforeAll(async () => {
    await setupMongo();
  });
  afterAll(async () => {
    await teardownMongo();
  });
  afterEach(async () => {
    await clearCollections();
  });

  describe('createCategory', () => {
    it('creates a category and writes an audit log', async () => {
      const collegeId = String(oid());
      const before = await AuditLog.countDocuments({});
      const created = await svc.createCategory(
        collegeId,
        { code: 'OC', name: 'Open Category', description: 'General merit' },
        'user-1',
      );
      expect(created.code).toBe('OC');
      expect(created.name).toBe('Open Category');
      expect(created.status).toBe('active'); // default
      const inDb = await FeeCategory.findById(created._id);
      expect(inDb).toBeTruthy();
      const after = await AuditLog.countDocuments({});
      expect(after).toBe(before + 1);
      const log = await AuditLog.findOne({
        entityType: 'FeeCategory',
        action: 'create',
        entityId: String(created._id),
      });
      expect(log).toBeTruthy();
      expect(log!.performedBy).toBe('user-1');
      expect(log!.entityName).toBe('Open Category');
    });

    it('rejects a duplicate code within the same college with 409', async () => {
      const collegeId = String(oid());
      await svc.createCategory(
        collegeId,
        { code: 'SC', name: 'Scheduled Caste' },
        'user-1',
      );
      await expect(
        svc.createCategory(
          collegeId,
          { code: 'SC', name: 'Duplicate' },
          'user-1',
        ),
      ).rejects.toMatchObject({ statusCode: 409 });
    });

    it('allows the same code across different colleges (multi-tenancy)', async () => {
      const a = String(oid());
      const b = String(oid());
      await svc.createCategory(a, { code: 'OC', name: 'Open' }, 'user-1');
      const created = await svc.createCategory(
        b,
        { code: 'OC', name: 'Open (other college)' },
        'user-1',
      );
      expect(created.code).toBe('OC');
      expect(String(created.collegeId)).toBe(b);
    });

    it('honours an explicit status=inactive on create', async () => {
      const collegeId = String(oid());
      const created = await svc.createCategory(
        collegeId,
        { code: 'NRI', name: 'Non-Resident Indian', status: 'inactive' },
        'user-1',
      );
      expect(created.status).toBe('inactive');
    });
  });

  describe('listCategories', () => {
    it('paginates results and returns total/pages', async () => {
      const collegeId = String(oid());
      const codes = ['OC', 'OBC', 'SC', 'ST', 'NRI'];
      for (const code of codes) {
        await svc.createCategory(collegeId, { code, name: code }, 'user-1');
      }
      const page1 = await svc.listCategories(collegeId, { page: 1, limit: 2 });
      expect(page1.items.length).toBe(2);
      expect(page1.total).toBe(5);
      expect(page1.pages).toBe(3);
      expect(page1.page).toBe(1);
      const page3 = await svc.listCategories(collegeId, { page: 3, limit: 2 });
      expect(page3.items.length).toBe(1);
    });

    it('filters by status=active and excludes inactive rows', async () => {
      const collegeId = String(oid());
      await svc.createCategory(
        collegeId,
        { code: 'OC', name: 'Open Category' },
        'user-1',
      );
      await svc.createCategory(
        collegeId,
        { code: 'NRI', name: 'NRI', status: 'inactive' },
        'user-1',
      );
      const onlyActive = await svc.listCategories(collegeId, { status: 'active' });
      expect(onlyActive.total).toBe(1);
      expect(onlyActive.items[0]!.code).toBe('OC');
      const onlyInactive = await svc.listCategories(collegeId, {
        status: 'inactive',
      });
      expect(onlyInactive.total).toBe(1);
      expect(onlyInactive.items[0]!.code).toBe('NRI');
      const all = await svc.listCategories(collegeId);
      expect(all.total).toBe(2);
    });

    it('scopes by collegeId — college A cannot see college B rows', async () => {
      const a = String(oid());
      const b = String(oid());
      await svc.createCategory(a, { code: 'OC', name: 'A-OC' }, 'user-1');
      await svc.createCategory(b, { code: 'OC', name: 'B-OC' }, 'user-1');
      const fromA = await svc.listCategories(a);
      expect(fromA.total).toBe(1);
      expect(fromA.items[0]!.name).toBe('A-OC');
      const fromB = await svc.listCategories(b);
      expect(fromB.total).toBe(1);
      expect(fromB.items[0]!.name).toBe('B-OC');
    });
  });

  describe('getCategory', () => {
    it('returns the row when found in the same college', async () => {
      const collegeId = String(oid());
      const created = await svc.createCategory(
        collegeId,
        { code: 'ST', name: 'Scheduled Tribe' },
        'user-1',
      );
      const fetched = await svc.getCategory(collegeId, String(created._id));
      expect(fetched.code).toBe('ST');
    });

    it('throws 404 when the id is unknown', async () => {
      const collegeId = String(oid());
      await expect(
        svc.getCategory(collegeId, String(oid())),
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it('throws 404 when a row exists in a different college (cross-tenant isolation)', async () => {
      const a = String(oid());
      const b = String(oid());
      const created = await svc.createCategory(
        a,
        { code: 'OC', name: 'Open' },
        'user-1',
      );
      await expect(
        svc.getCategory(b, String(created._id)),
      ).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe('updateCategory', () => {
    it('updates name only and writes an audit log', async () => {
      const collegeId = String(oid());
      const created = await svc.createCategory(
        collegeId,
        { code: 'OC', name: 'Open' },
        'user-1',
      );
      const updated = await svc.updateCategory(
        collegeId,
        String(created._id),
        { name: 'Open Category' },
        'user-1',
      );
      expect(updated.name).toBe('Open Category');
      expect(updated.code).toBe('OC');
      const log = await AuditLog.findOne({
        entityType: 'FeeCategory',
        action: 'update',
        entityId: String(created._id),
      });
      expect(log).toBeTruthy();
    });

    it('updates code only and persists', async () => {
      const collegeId = String(oid());
      const created = await svc.createCategory(
        collegeId,
        { code: 'OBC', name: 'Other Backward Classes' },
        'user-1',
      );
      const updated = await svc.updateCategory(
        collegeId,
        String(created._id),
        { code: 'BC' },
        'user-1',
      );
      expect(updated.code).toBe('BC');
      expect(updated.name).toBe('Other Backward Classes');
    });

    it('rejects updating code to a value already used by another row in the same college (409)', async () => {
      const collegeId = String(oid());
      await svc.createCategory(collegeId, { code: 'OC', name: 'Open' }, 'user-1');
      const sc = await svc.createCategory(
        collegeId,
        { code: 'SC', name: 'Scheduled Caste' },
        'user-1',
      );
      await expect(
        svc.updateCategory(
          collegeId,
          String(sc._id),
          { code: 'OC' },
          'user-1',
        ),
      ).rejects.toMatchObject({ statusCode: 409 });
    });

    it('throws 404 when the id is unknown', async () => {
      const collegeId = String(oid());
      await expect(
        svc.updateCategory(
          collegeId,
          String(oid()),
          { name: 'x' },
          'user-1',
        ),
      ).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe('deleteCategory', () => {
    it('hard-deletes the row and writes an audit log', async () => {
      const collegeId = String(oid());
      const created = await svc.createCategory(
        collegeId,
        { code: 'NRI', name: 'NRI' },
        'user-1',
      );
      await svc.deleteCategory(collegeId, String(created._id), 'user-1');
      const gone = await FeeCategory.findById(created._id);
      expect(gone).toBeNull();
      const log = await AuditLog.findOne({
        entityType: 'FeeCategory',
        action: 'delete',
        entityId: String(created._id),
      });
      expect(log).toBeTruthy();
      expect(log!.performedBy).toBe('user-1');
    });

    it('throws 404 when the id is unknown', async () => {
      const collegeId = String(oid());
      await expect(
        svc.deleteCategory(collegeId, String(oid()), 'user-1'),
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it('cannot delete a row owned by another college (cross-tenant isolation)', async () => {
      const a = String(oid());
      const b = String(oid());
      const created = await svc.createCategory(
        a,
        { code: 'OC', name: 'Open' },
        'user-1',
      );
      await expect(
        svc.deleteCategory(b, String(created._id), 'user-1'),
      ).rejects.toMatchObject({ statusCode: 404 });
      // Still in DB
      const stillThere = await FeeCategory.findById(created._id);
      expect(stillThere).toBeTruthy();
    });
  });
});
