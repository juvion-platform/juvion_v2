// student-dev module service — sub-domains: ORG, EVT, ACH, BUD, PORT
export async function list(_collegeId: string, page = 1, _limit = 20) {
  return { items: [], total: 0, page, pages: 0 };
}
