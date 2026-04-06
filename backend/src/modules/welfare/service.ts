// welfare module service — sub-domains: GGM, ARC, ICC, SCST, GRC, MENT, COUNS, DISC, CCD
export async function list(_collegeId: string, page = 1, _limit = 20) {
  return { items: [], total: 0, page, pages: 0 };
}
