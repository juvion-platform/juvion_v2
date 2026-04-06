// juvi module service — sub-domains: SPACE, HOME, COMPANION, NOTICE, CONTENT, MOD, FAC, LIFECYCLE
export async function list(_collegeId: string, page = 1, _limit = 20) {
  return { items: [], total: 0, page, pages: 0 };
}
