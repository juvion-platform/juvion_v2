// governance module service — sub-domains: DASH, POLICY, PREDICT, BOARD, AUDIT, STRATEGY
export async function list(_collegeId: string, page = 1, _limit = 20) {
  return { items: [], total: 0, page, pages: 0 };
}
