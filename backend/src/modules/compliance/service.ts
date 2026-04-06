// compliance module service — sub-domains: EVID, CRIT, READY, REPORT, REMED, VISIT
export async function list(_collegeId: string, page = 1, _limit = 20) {
  return { items: [], total: 0, page, pages: 0 };
}
