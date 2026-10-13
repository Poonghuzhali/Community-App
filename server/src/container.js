const { createPush } = require('./services/push');
const { createNotificationService } = require('./services/notifications');

const { createUsersService } = require('./modules/users/service');
const { createAuthService } = require('./modules/auth/service');
const { createVisitorsService } = require('./modules/visitors/service');
const { createComplaintsService } = require('./modules/complaints/service');
const { createBookingsService } = require('./modules/bookings/service');
const { createMarketplaceService } = require('./modules/marketplace/service');
const { createAnnouncementsService } = require('./modules/announcements/service');
const { createEventsService } = require('./modules/events/service');
const { createAuthMiddleware } = require('./middleware/auth');

/**
 * Builds every service and wires them together.
 * `db` must expose query/one/many/scalar (see src/db/pool.js).
 * Tests inject a hand-written container instead of calling this.
 */
function createContainer({ db }) {
  const push = createPush();
  const notifications = createNotificationService({ db, push });

  const users = createUsersService({ db });
  const auth = createAuthService({ db, users, notifications });
  const visitors = createVisitorsService({ db, notifications });
  const complaints = createComplaintsService({ db, notifications });
  const bookings = createBookingsService({ db, notifications });
  const marketplace = createMarketplaceService({ db, notifications });
  const announcements = createAnnouncementsService({ db, notifications });
  const events = createEventsService({ db, notifications });

  const authMw = createAuthMiddleware({ users });

  return {
    db,
    push,
    notifications,
    users,
    auth,
    visitors,
    complaints,
    bookings,
    marketplace,
    announcements,
    events,
    authMw,
  };
}

module.exports = { createContainer };
