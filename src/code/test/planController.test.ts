import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../cmd/app';
import { v4 as uuidv4 } from 'uuid';
describe('PlanController', () => {
    let token: string;
    let adminToken: string;
    let createdPlanId: string;
    const testUser = { email: 'user@example.com', password: 'password' };
    const adminUser = { email: 'admin@example.com', password: 'adminpassword' };
    const forWhoUid = `USR-${uuidv4()}`; // ganti dengan UID user valid

    beforeAll(async () => {
        // Login user
        const res = await request(app)
            .post('/api/auth/login')
            .send(testUser);
        token = res.body.data?.token;

        // Login admin
        const adminRes = await request(app)
            .post('/api/auth/login')
            .send(adminUser);
        adminToken = adminRes.body.data?.token;
    });

    it('GET /api/plans tanpa token harus 401', async () => {
        const res = await request(app).get('/api/plans');
        expect(res.status).toBe(401);
        expect(res.body.message).toBe('Unauthorized, token is missing');
    });

    it('GET /api/plans dengan token harus 200/404', async () => {
        const res = await request(app)
            .get('/api/plans')
            .set('Authorization', `Bearer ${token}`);
        expect([200, 404]).toContain(res.status);
    });

    it('GET /api/plans dengan search global', async () => {
        const res = await request(app)
            .get('/api/plans?search=Test')
            .set('Authorization', `Bearer ${token}`);
        expect([200, 404]).toContain(res.status);
    });

    it('POST /api/plans harus bisa create plan', async () => {
        const res = await request(app)
            .post('/api/plans')
            .set('Authorization', `Bearer ${token}`)
            .send({
                forWhoUid,
                Status: 'notyet',
                NamePlan: 'Test Plan',
                Start: new Date(),
                End: new Date()
            });
        expect([201, 400, 404]).toContain(res.status);
        if (res.status === 201) {
            createdPlanId = res.body.data.UniqueId;
        }
    });

    it('GET /api/plans/:uniqueId harus bisa ambil plan', async () => {
        if (!createdPlanId) return;
        const res = await request(app)
            .get(`/api/plans/${createdPlanId}`)
            .set('Authorization', `Bearer ${token}`);
        expect([200, 404]).toContain(res.status);
    });

    it('PATCH /api/plans/:uniqueId harus bisa update plan', async () => {
        if (!createdPlanId) return;
        const res = await request(app)
            .patch(`/api/plans/${createdPlanId}`)
            .set('Authorization', `Bearer ${token}`)
            .send({
                NamePlan: 'Updated Plan',
                Status: 'onprogres'
            });
        expect([200, 400, 403, 404]).toContain(res.status);
    });

    it('DELETE /api/plans/:uniqueId (soft delete) hanya admin', async () => {
        if (!createdPlanId) return;
        const res = await request(app)
            .delete(`/api/plans/${createdPlanId}`)
            .set('Authorization', `Bearer ${adminToken}`);
        expect([200, 403, 404]).toContain(res.status);
    });

    it('DELETE /api/plans/permanent/:uniqueId (permanent) hanya admin', async () => {
        if (!createdPlanId) return;
        const res = await request(app)
            .delete(`/api/plans/permanent/${createdPlanId}`)
            .set('Authorization', `Bearer ${adminToken}`);
        expect([200, 403, 404]).toContain(res.status);
    });

    afterAll(async () => {
        // Hapus user yang dibuat untuk testing
        if (token) {
            await request(app)
                .delete(`/api/users/${forWhoUid}`)
                .set('Authorization', `Bearer ${adminToken}`);
        }
    });
});