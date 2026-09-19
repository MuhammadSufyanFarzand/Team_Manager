import { CompanyRole, GroupSettings, ROLE_HIERARCHY } from '../types';

export const ROLE_DETAILS: Record<CompanyRole, {
  title: string;
  urduTitle: string;
  badgeClass: string;
  borderClass: string;
  textClass: string;
  bgClass: string;
  level: number;
}> = {
  ceo: {
    title: 'CEO',
    urduTitle: 'چیف ایگزیکٹو',
    badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    borderClass: 'border-amber-500/40',
    textClass: 'text-amber-300',
    bgClass: 'bg-amber-500/20',
    level: 1
  },
  manager: {
    title: 'Manager',
    urduTitle: 'مینیجر',
    badgeClass: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
    borderClass: 'border-cyan-500/40',
    textClass: 'text-cyan-300',
    bgClass: 'bg-cyan-500/20',
    level: 2
  },
  team_lead: {
    title: 'Team Lead',
    urduTitle: 'ٹیم لیڈ',
    badgeClass: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
    borderClass: 'border-purple-500/40',
    textClass: 'text-purple-300',
    bgClass: 'bg-purple-500/20',
    level: 3
  },
  employee: {
    title: 'Employee',
    urduTitle: 'ایمپلائی',
    badgeClass: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
    borderClass: 'border-blue-500/40',
    textClass: 'text-blue-300',
    bgClass: 'bg-blue-500/20',
    level: 4
  },
  intern: {
    title: 'Intern',
    urduTitle: 'انٹرن',
    badgeClass: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
    borderClass: 'border-slate-500/30',
    textClass: 'text-slate-300',
    bgClass: 'bg-slate-500/20',
    level: 5
  },
};

/**
 * Gets the current resolved role for a given user from group settings.
 * If user is owner_username -> 'ceo'
 * Else lookup user_roles, admin_usernames, leader_usernames, intern_usernames
 * Default fallback for any non-owner is always 'employee'!
 */
export function getUserRole(username: string | undefined | null, settings: GroupSettings | null | undefined): CompanyRole {
  if (!username) return 'employee';
  const clean = username.trim().toLowerCase();
  if (!clean) return 'employee';

  const ownerClean = (settings?.owner_username || '').trim().toLowerCase();
  if (ownerClean && clean === ownerClean) {
    return 'ceo';
  }

  // Check explicit user_roles map
  if (settings?.user_roles && settings.user_roles[clean]) {
    const assigned = settings.user_roles[clean];
    if (assigned === 'ceo' && clean !== ownerClean) {
      // Only the true owner_username can have 'ceo'
      return 'manager';
    }
    return assigned;
  }

  // Check legacy arrays
  if (settings?.admin_usernames?.some(a => a.trim().toLowerCase() === clean)) {
    return 'manager';
  }
  if (settings?.leader_usernames?.some(l => l.trim().toLowerCase() === clean)) {
    return 'team_lead';
  }
  if (settings?.intern_usernames?.some(i => i.trim().toLowerCase() === clean)) {
    return 'intern';
  }

  // Default for all other users is 'employee'
  return 'employee';
}

/**
 * Check if the actor can manage (change role, remove, or ban) the target user
 * Mathematical rule: Actor must be strictly higher in the hierarchy (lower numeric level).
 * Level 1 (CEO) > Level 2 (Manager) > Level 3 (Team Lead) > Level 4 (Employee) > Level 5 (Intern)
 */
export function canManageUser(actorRole: CompanyRole, targetRole: CompanyRole): boolean {
  return ROLE_HIERARCHY[actorRole] < ROLE_HIERARCHY[targetRole];
}

/**
 * Get the list of roles that an actor with `actorRole` is permitted to assign to a subordinate.
 * An actor can only assign roles that are subordinate to their own role.
 */
export function getAllowedAssignableRoles(actorRole: CompanyRole): CompanyRole[] {
  switch (actorRole) {
    case 'ceo':
      return ['manager', 'team_lead', 'employee', 'intern'];
    case 'manager':
      return ['team_lead', 'employee', 'intern'];
    case 'team_lead':
      return ['employee', 'intern'];
    case 'employee':
      return ['intern'];
    case 'intern':
    default:
      return [];
  }
}

/**
 * Cleanly updates GroupSettings with the new role for targetUsername, keeping all lists in sync.
 */
export function applyRoleChange(
  currentSettings: GroupSettings,
  targetUsername: string,
  newRole: CompanyRole
): GroupSettings {
  const cleanTarget = targetUsername.trim();
  const lowerTarget = cleanTarget.toLowerCase();

  // If promoting someone to CEO, old CEO becomes Manager
  if (newRole === 'ceo') {
    const oldOwner = currentSettings.owner_username;
    const oldOwnerLower = (oldOwner || '').toLowerCase();
    
    const updatedRoles: Record<string, CompanyRole> = {
      ...(currentSettings.user_roles || {}),
      [lowerTarget]: 'ceo'
    };
    if (oldOwnerLower && oldOwnerLower !== lowerTarget) {
      updatedRoles[oldOwnerLower] = 'manager';
    }

    const updatedAdmins = Array.from(
      new Set([
        ...(currentSettings.admin_usernames || []).filter(u => u.toLowerCase() !== lowerTarget),
        ...(oldOwner ? [oldOwner] : [])
      ])
    );

    return {
      ...currentSettings,
      owner_username: cleanTarget,
      admin_usernames: updatedAdmins,
      user_roles: updatedRoles
    };
  }

  // Otherwise, set the role for target
  const updatedRoles: Record<string, CompanyRole> = {
    ...(currentSettings.user_roles || {}),
    [lowerTarget]: newRole
  };

  // Keep legacy lists clean and synchronized
  let adminList = (currentSettings.admin_usernames || []).filter(u => u.toLowerCase() !== lowerTarget);
  let leaderList = (currentSettings.leader_usernames || []).filter(u => u.toLowerCase() !== lowerTarget);
  let employeeList = (currentSettings.employee_usernames || []).filter(u => u.toLowerCase() !== lowerTarget);
  let internList = (currentSettings.intern_usernames || []).filter(u => u.toLowerCase() !== lowerTarget);

  if (newRole === 'manager') {
    adminList.push(cleanTarget);
  } else if (newRole === 'team_lead') {
    leaderList.push(cleanTarget);
  } else if (newRole === 'employee') {
    employeeList.push(cleanTarget);
  } else if (newRole === 'intern') {
    internList.push(cleanTarget);
  }

  return {
    ...currentSettings,
    admin_usernames: Array.from(new Set(adminList)),
    leader_usernames: Array.from(new Set(leaderList)),
    employee_usernames: Array.from(new Set(employeeList)),
    intern_usernames: Array.from(new Set(internList)),
    user_roles: updatedRoles
  };
}
