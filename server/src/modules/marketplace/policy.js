const { ApiError } = require('../../utils/errors');

const CATEGORIES = ['homemade_food', 'jewellery', 'used_products', 'tuition', 'yoga_fitness', 'other'];
const STATUSES = ['pending', 'approved', 'rejected', 'sold', 'inactive'];

const CATEGORY_LABELS = {
  homemade_food: 'Homemade Food',
  jewellery: 'Jewellery',
  used_products: 'Used Products',
  tuition: 'Tuition',
  yoga_fitness: 'Yoga / Fitness',
  other: 'Other',
};

function assertCategory(category) {
  if (!CATEGORIES.includes(category)) {
    throw ApiError.badRequest(`Category must be one of: ${CATEGORIES.join(', ')}`);
  }
  return true;
}

/** Only the seller (or an admin) may edit; only admins approve/reject. */
function assertCanModerate(listing, actor) {
  if (actor.role !== 'admin') throw ApiError.forbidden('Only admins can approve listings');
  if (!['pending', 'approved', 'rejected'].includes(listing.status)) {
    throw ApiError.badRequest(`A ${listing.status} listing cannot be moderated`);
  }
  return true;
}

function assertCanEdit(listing, actor) {
  if (listing.seller_id !== actor.id && actor.role !== 'admin') {
    throw ApiError.forbidden('This listing belongs to another resident');
  }
  return true;
}

function assertVisible(listing, actor) {
  const isOwner = listing.seller_id === actor.id;
  if (listing.status === 'approved') return listing;
  if (isOwner || actor.role === 'admin') return listing;
  throw ApiError.notFound('Listing not found');
}

module.exports = {
  CATEGORIES, STATUSES, CATEGORY_LABELS,
  assertCategory, assertCanModerate, assertCanEdit, assertVisible,
};
