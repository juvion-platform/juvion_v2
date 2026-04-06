// hr module service — sub-domains: LEAVE, ATT, APPR, FDP, RECRUIT, EXIT, DISC
export async function list(_collegeId: string, page = 1, _limit = 20) {
  return { items: [], total: 0, page, pages: 0 };
}
