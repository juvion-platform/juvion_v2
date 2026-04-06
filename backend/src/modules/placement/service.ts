// placement module service — sub-domains: CRM, PROFILE, DRIVES, OFFERS, TRAIN, PORTAL, ALUMNI
export async function list(_collegeId: string, page = 1, _limit = 20) {
  return { items: [], total: 0, page, pages: 0 };
}
