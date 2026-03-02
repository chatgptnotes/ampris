import { prisma } from '../config/database';

class AuthorityService {
  async checkAuthority(
    userId: string,
    projectId: string,
    requiredLevel: number,
    permission?: string,
    zone?: string
  ): Promise<{ authorized: boolean; userLevel: number; reason?: string }> {
    const authority = await prisma.operatorAuthority.findUnique({
      where: { projectId_userId: { projectId, userId } },
    });

    if (!authority) {
      return { authorized: false, userLevel: 0, reason: 'No authority record found' };
    }

    if (!authority.isActive) {
      return { authorized: false, userLevel: authority.level, reason: 'Authority is inactive' };
    }

    // Check shift times
    const now = new Date();
    if (authority.activeFrom && now < authority.activeFrom) {
      return { authorized: false, userLevel: authority.level, reason: 'Outside shift hours (not started)' };
    }
    if (authority.activeTo && now > authority.activeTo) {
      return { authorized: false, userLevel: authority.level, reason: 'Outside shift hours (ended)' };
    }

    if (authority.level < requiredLevel) {
      return { authorized: false, userLevel: authority.level, reason: `Requires level ${requiredLevel}, user has level ${authority.level}` };
    }

    if (permission) {
      const perms = authority.permissions as string[];
      if (!perms.includes(permission)) {
        return { authorized: false, userLevel: authority.level, reason: `Missing permission: ${permission}` };
      }
    }

    if (zone) {
      const zones = authority.zones as string[];
      if (zones.length > 0 && !zones.includes(zone)) {
        return { authorized: false, userLevel: authority.level, reason: `Not authorized for zone: ${zone}` };
      }
    }

    return { authorized: true, userLevel: authority.level };
  }
}

export const authorityService = new AuthorityService();
