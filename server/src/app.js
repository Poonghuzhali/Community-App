const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const config = require('./config');
const { errorHandler, notFoundHandler } = require('./utils/errors');
const { apiLimiter } = require('./middleware/rateLimit');
const { ensureUploadDir } = require('./middleware/upload');

const { createAuthRoutes } = require('./modules/auth/routes');
const { createVisitorRoutes, createSecurityRoutes } = require('./modules/visitors/routes');
const { createComplaintRoutes } = require('./modules/complaints/routes');
const { createBookingRoutes, createAdminAmenityRoutes } = require('./modules/bookings/routes');
const { createMarketplaceRoutes } = require('./modules/marketplace/routes');
const { createAnnouncementRoutes } = require('./modules/announcements/routes');
const { createEventRoutes } = require('./modules/events/routes');
const { createNotificationRoutes } = require('./modules/notifications/routes');
const { createAdminRoutes } = require('./modules/admin/routes');

/**
 * Builds the Express app around an already-constructed container of
 * services, so tests can pass fakes and production passes the SQL container.
 */
function createApp(container) {
  const app = express();
  app.set('trust proxy', 1);
  app.locals.container = container;

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors({ origin: config.corsOrigins.includes('*') ? true : config.corsOrigins }));
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use('/api', apiLimiter);

  const uploadDir = ensureUploadDir();
  app.use('/uploads', express.static(uploadDir, { maxAge: '7d' }));

  app.get('/health', (req, res) =>
    res.json({ success: true, data: { status: 'ok', service: 'community-connect-api', time: new Date().toISOString() } })
  );

  const auth = container.authMw;
  const marketplace = createMarketplaceRoutes({ ...container, authMw: auth });
  const announcements = createAnnouncementRoutes({ ...container, authMw: auth });
  const events = createEventRoutes({ ...container, authMw: auth });

  const routes = [
    ['/api/auth', createAuthRoutes({ ...container, authMw: auth })],
    ['/api/visitors', createVisitorRoutes({ ...container, authMw: auth })],
    ['/api/security', createSecurityRoutes({ ...container, authMw: auth })],
    ['/api/complaints', createComplaintRoutes({ ...container, authMw: auth })],
    ['/api/bookings', createBookingRoutes({ ...container, authMw: auth })],
    ['/api/admin/amenities', createAdminAmenityRoutes({ ...container, authMw: auth })],
    ['/api/marketplace/admin', marketplace.adminRouter],
    ['/api/marketplace', marketplace.router],
    ['/api/announcements/admin', announcements.adminRouter],
    ['/api/announcements', announcements.router],
    ['/api/events/admin', events.adminRouter],
    ['/api/events', events.router],
    ['/api/notifications', createNotificationRoutes({ ...container, authMw: auth })],
    ['/api/admin', createAdminRoutes({ ...container, authMw: auth })],
  ];

  for (const [mount, router] of routes) app.use(mount, router);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
