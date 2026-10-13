const { ApiError } = require('../../utils/errors');
const policy = require('./policy');

const LISTING_SELECT = `
  SELECT l.*, u.full_name AS seller_name, u.phone AS seller_phone,
         f.block || '-' || f.flat_number AS seller_flat
    FROM marketplace_listings l
    JOIN users u ON u.id = l.seller_id
    LEFT JOIN flats f ON f.id = u.flat_id
`;

function createMarketplaceService({ db, notifications }) {
  async function create(actor, input) {
    policy.assertCategory(input.category);
    const listing = await db.one(
      `INSERT INTO marketplace_listings
         (seller_id, category, title, description, price, price_unit, image_url, contact_phone)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [
        actor.id,
        input.category,
        input.title,
        input.description,
        input.price || 0,
        input.priceUnit || 'one-time',
        input.imageUrl || null,
        input.contactPhone || actor.phone,
      ]
    );

    await notifications.notify({
      roles: ['admin'],
      type: 'marketplace',
      title: 'New listing awaiting approval',
      body: `${input.title} by ${actor.name || actor.phone}`,
      data: { listingId: listing.id },
    });
    return get(listing.id, actor);
  }

  async function get(id, actor) {
    const listing = await db.one(`${LISTING_SELECT} WHERE l.id = $1`, [id]);
    if (!listing) throw ApiError.notFound('Listing not found');
    policy.assertVisible(listing, actor);
    if (listing.status === 'approved') {
      await db.query('UPDATE marketplace_listings SET views = views + 1 WHERE id = $1', [id]);
      listing.views += 1;
    }
    listing.categoryLabel = policy.CATEGORY_LABELS[listing.category] || listing.category;
    return listing;
  }

  /** Resident-facing search/filter. Only approved listings are visible. */
  async function search({ q, category, minPrice, maxPrice, page = 1, limit = 20, sort = 'recent' } = {}) {
    const where = [`l.status = 'approved'`];
    const params = [];
    if (q) {
      params.push(`%${q}%`);
      where.push(`(l.title ILIKE $${params.length} OR l.description ILIKE $${params.length})`);
    }
    if (category) { params.push(category); where.push(`l.category = $${params.length}`); }
    if (minPrice !== undefined && minPrice !== null && minPrice !== '') {
      params.push(minPrice); where.push(`l.price >= $${params.length}`);
    }
    if (maxPrice !== undefined && maxPrice !== null && maxPrice !== '') {
      params.push(maxPrice); where.push(`l.price <= $${params.length}`);
    }
    const whereSql = `WHERE ${where.join(' AND ')}`;
    const total = Number(await db.scalar(`SELECT COUNT(*) FROM marketplace_listings l ${whereSql}`, params) || 0);

    const order = {
      recent: 'l.created_at DESC',
      price_asc: 'l.price ASC',
      price_desc: 'l.price DESC',
      popular: 'l.views DESC',
    }[sort] || 'l.created_at DESC';

    const lim = Math.min(Number(limit) || 20, 50);
    params.push(lim, (Math.max(1, Number(page) || 1) - 1) * lim);
    const items = await db.many(
      `${LISTING_SELECT} ${whereSql} ORDER BY ${order}
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    return {
      items: items.map((l) => ({ ...l, categoryLabel: policy.CATEGORY_LABELS[l.category] || l.category })),
      total, page: Number(page) || 1, limit: lim,
      categories: Object.entries(policy.CATEGORY_LABELS).map(([value, label]) => ({ value, label })),
    };
  }

  async function listMine(actor, { status, page = 1, limit = 20 } = {}) {
    const where = ['l.seller_id = $1'];
    const params = [actor.id];
    if (status) { params.push(status); where.push(`l.status = $${params.length}`); }
    const whereSql = `WHERE ${where.join(' AND ')}`;
    const total = Number(await db.scalar(`SELECT COUNT(*) FROM marketplace_listings l ${whereSql}`, params) || 0);
    const lim = Math.min(Number(limit) || 20, 100);
    params.push(lim, (Math.max(1, Number(page) || 1) - 1) * lim);
    const items = await db.many(
      `${LISTING_SELECT} ${whereSql} ORDER BY l.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    return { items, total, page: Number(page) || 1, limit: lim };
  }

  async function listAll({ status, q, page = 1, limit = 20 } = {}) {
    const where = [];
    const params = [];
    if (status) { params.push(status); where.push(`l.status = $${params.length}`); }
    if (q) { params.push(`%${q}%`); where.push(`l.title ILIKE $${params.length}`); }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const total = Number(await db.scalar(`SELECT COUNT(*) FROM marketplace_listings l ${whereSql}`, params) || 0);
    const lim = Math.min(Number(limit) || 20, 100);
    params.push(lim, (Math.max(1, Number(page) || 1) - 1) * lim);
    const items = await db.many(
      `${LISTING_SELECT} ${whereSql} ORDER BY l.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    const counts = await db.many(
      `SELECT status, COUNT(*)::int AS count FROM marketplace_listings GROUP BY status`
    );
    return { items, total, page: Number(page) || 1, limit: lim, counts };
  }

  /** Admin approve / reject / mark sold / take down. */
  async function moderate(id, actor, { status, reason = null }) {
    if (actor.role !== 'admin') throw ApiError.forbidden('Only admins can moderate listings');
    if (!['approved', 'rejected', 'sold', 'inactive'].includes(status)) {
      throw ApiError.badRequest('Invalid moderation status');
    }
    const listing = await db.one('SELECT * FROM marketplace_listings WHERE id = $1', [id]);
    if (!listing) throw ApiError.notFound('Listing not found');
    policy.assertCanModerate(listing, actor);
    if (status === 'rejected' && !reason) throw ApiError.badRequest('A rejection reason is required');

    await db.query(
      `UPDATE marketplace_listings
          SET status = $1, rejection_reason = $2, approved_by = $3, updated_at = NOW()
        WHERE id = $4`,
      [status, status === 'rejected' ? reason : null, status === 'approved' ? actor.id : listing.approved_by, id]
    );

    const messages = {
      approved: ['Your listing is live 🎉', `“${listing.title}” is now visible to all residents.`],
      rejected: ['Your listing was not approved', reason || 'Please review the community guidelines and try again.'],
      sold: ['Listing marked as sold', `“${listing.title}” is no longer shown as available.`],
      inactive: ['Listing taken down', `“${listing.title}” has been removed from the marketplace.`],
    };
    const [title, body] = messages[status];
    await notifications.notify({
      userId: listing.seller_id,
      type: 'marketplace',
      title,
      body,
      data: { listingId: id, status },
    });
    return get(id, actor);
  }

  async function remove(id, actor) {
    const listing = await db.one('SELECT * FROM marketplace_listings WHERE id = $1', [id]);
    if (!listing) throw ApiError.notFound('Listing not found');
    policy.assertCanEdit(listing, actor);
    if (['approved', 'pending'].includes(listing.status) && actor.role !== 'admin') {
      throw ApiError.badRequest('Mark the listing as sold or ask an admin to take it down');
    }
    await db.query('DELETE FROM marketplace_listings WHERE id = $1', [id]);
    return { id, deleted: true };
  }

  /** "Contact seller" - opens an enquiry the seller sees in-app. */
  async function contactSeller(listingId, actor, message) {
    const listing = await get(listingId, actor);
    if (listing.seller_id === actor.id) throw ApiError.badRequest('This is your own listing');
    const enquiry = await db.one(
      `INSERT INTO listing_enquiries (listing_id, buyer_id, message)
       VALUES ($1, $2, $3) RETURNING *`,
      [listingId, actor.id, message || 'Hi, is this still available?']
    );
    await notifications.notify({
      userId: listing.seller_id,
      type: 'marketplace',
      title: `Enquiry for “${listing.title}”`,
      body: message || 'Hi, is this still available?',
      data: { listingId, enquiryId: enquiry.id },
    });
    return { enquiry, sellerPhone: listing.contact_phone || listing.seller_phone };
  }

  async function myEnquiries(actor) {
    return db.many(
      `SELECT e.*, l.title AS listing_title, u.full_name AS buyer_name
         FROM listing_enquiries e
         JOIN marketplace_listings l ON l.id = e.listing_id
         JOIN users u ON u.id = e.buyer_id
        WHERE l.seller_id = $1
        ORDER BY e.created_at DESC LIMIT 50`,
      [actor.id]
    );
  }

  return { create, get, search, listMine, listAll, moderate, remove, contactSeller, myEnquiries };
}

module.exports = { createMarketplaceService, LISTING_SELECT };
