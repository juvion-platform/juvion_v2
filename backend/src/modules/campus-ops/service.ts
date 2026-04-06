// campus-ops module service — sub-domains: HOSTEL, MESS, TRANSPORT, LIBRARY, LABS, FACILITIES, MAINT
export async function list(_collegeId: string, page = 1, _limit = 20) {
  return { items: [], total: 0, page, pages: 0 };
}
