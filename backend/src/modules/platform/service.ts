// platform module service — sub-domains: IAC, COMMS, AI, INTG, TENANT, DPS, OBS, API
export async function list(_collegeId: string, page = 1, _limit = 20) {
  return { items: [], total: 0, page, pages: 0 };
}
