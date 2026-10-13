const express = require('express');
const { asyncHandler, ApiError } = require('../../utils/errors');
const { validate } = require('../../middleware/validate');
const v = require('../../utils/validators');

/**
 * Admin panel endpoints: resident management, flat directory and the
 * summary report used by the dashboard.
 */
function createAdminRoutes({ users, complaints, bookings, visitors, marketplace, announcements, events, authMw }) {
  const router = express.Router();
  const { requireAuth, requireRole } = authMw;
  router.use(requireAuth, requireRole('admin'));

  // ------------------------------------------------------------ Residents
  router.get(
    '/residents',
    asyncHandler(async (req, res) => {
      const data = await users.listResidents({
        q: req.query.q,
        role: req.query.role || null,
        page: req.query.page,
        limit: req.query.limit,
      });
      res.json({ success: true, data });
    })
  );

  router.post(
    '/residents',
    validate(
      v.shape({
        phone: v.phone({ required: true }),
        full_name: v.str({ max: 120, label: 'Name' }),
        email: v.str({ max: 160, label: 'Email' }),
        role: v.oneOf(['resident', 'security', 'admin'], { fallback: 'resident', label: 'Role' }),
        flat_id: v.str({ label: 'Flat' }),
      })
    ),
    asyncHandler(async (req, res) => {
      const user = await users.adminCreateResident({
        phone: req.body.phone,
        fullName: req.body.full_name,
        email: req.body.email,
        role: req.body.role,
        flatId: req.body.flat_id || null,
      });
      res.status(201).json({ success: true, data: user });
    })
  );

  router.patch(
    '/residents/:id',
    validate(
      v.shape({
        full_name: v.str({ max: 120, label: 'Name' }),
        email: v.str({ max: 160, label: 'Email' }),
        role: v.oneOf(['resident', 'security', 'admin'], { label: 'Role' }),
        is_active: v.bool(),
        flat_id: v.str({ label: 'Flat' }),
        clear_flat: v.bool({ fallback: false }),
      })
    ),
    asyncHandler(async (req, res) => {
      const patch = {};
      if (req.body.full_name !== undefined) patch.full_name = req.body.full_name;
      if (req.body.email !== undefined) patch.email = req.body.email;
      if (req.body.role !== undefined) patch.role = req.body.role;
      if (req.body.is_active !== undefined) patch.is_active = req.body.is_active;

      if (req.body.clear_flat === true || req.body.clear_flat === 'true') {
        await users.assignFlat(req.params.id, null);
      } else if (req.body.flat_id) {
        await users.assignFlat(req.params.id, req.body.flat_id);
      }

      const user = await users.updateUser(req.params.id, patch);
      if (!user) throw ApiError.notFound('Resident not found');
      res.json({ success: true, data: user });
    })
  );

  // ---------------------------------------------------------------- Flats
  router.get(
    '/flats',
    asyncHandler(async (req, res) => {
      res.json({ success: true, data: await users.listFlats() });
    })
  );

  // ------------------------------------------------------ Dashboard report
  router.get(
    '/reports',
    asyncHandler(async (req, res) => {
      const [complaintStats, bookingStats, visitorStats, announcementStats, eventStats] = await Promise.all([
        complaints.stats(),
        bookings.stats(),
        visitors.stats(),
        announcements.stats(),
        events.stats(),
      ]);

      const residents = await users.listResidents({ limit: 1 });
      const marketplaceData = await marketplace.listAll({ limit: 1 });

      const overview = {
        residents: residents.total,
        complaintsOpen: complaintStats.open,
        complaintsResolved: (complaintStats.byStatus.find((s) => s.status === 'resolved') || {}).count || 0,
        visitorEntriesToday: visitorStats.todayEntries,
        visitorsInside: visitorStats.currentlyInside,
        bookingsUpcoming: bookingStats.upcoming,
        announcements: announcementStats.total,
        eventsUpcoming: eventStats.upcoming,
        listingsPending: (marketplaceData.counts.find((c) => c.status === 'pending') || {}).count || 0,
      };

      res.json({
        success: true,
        data: {
          overview,
          complaints: complaintStats,
          bookings: bookingStats,
          visitors: visitorStats,
          events: eventStats,
          marketplace: marketplaceData.counts,
          generatedAt: new Date().toISOString(),
        },
      });
    })
  );

  return router;
}

module.exports = { createAdminRoutes };
