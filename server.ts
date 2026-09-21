import express from "express";
import http from "http";
import path from "path";
import fs from "fs";
import { Server as SocketIOServer } from "socket.io";
import { createServer as createViteServer } from "vite";
import { CompanyRole, GroupSettings } from "./src/types";
import { getUserRole, canManageUser, applyRoleChange, getAllowedAssignableRoles } from "./src/lib/roleHierarchy";

const PORT = 3000;
const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "db.json");

// Ensure data folder exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

interface DatabaseSchema {
  messages: any[];
  group_settings: any[];
  user_profiles: any[];
  leads: any[];
  attendance_records: any[];
  leave_requests: any[];
  lead_logs: any[];
  user_daily_stats: any[];
  [key: string]: any[];
}

const defaultDatabase: DatabaseSchema = {
  messages: [],
  group_settings: [
    {
      id: 1,
      name: "Global Company Chat",
      description: "Enterprise workspace and communications network",
      avatar_url: null,
      owner_username: "",
      admin_usernames: [],
      leader_usernames: [],
      user_roles: {},
      banned_usernames: [],
      ban_appeals: [],
      allow_member_add: true,
      only_admins_message: false,
      pinned_message_id: null,
    },
  ],
  user_profiles: [],
  leads: [],
  attendance_records: [],
  leave_requests: [],
  lead_logs: [],
  user_daily_stats: [],
};

// Load database from file or initialize
let db: DatabaseSchema = { ...defaultDatabase };
try {
  if (fs.existsSync(DB_FILE)) {
    const raw = fs.readFileSync(DB_FILE, "utf-8");
    db = { ...defaultDatabase, ...JSON.parse(raw) };
  } else {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), "utf-8");
  }
} catch (err) {
  console.error("Error reading db.json, using defaults:", err);
}

// Debounced atomic save
let saveTimer: NodeJS.Timeout | null = null;
function persistDatabase() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      const tmpPath = DB_FILE + ".tmp";
      fs.writeFileSync(tmpPath, JSON.stringify(db, null, 2), "utf-8");
      fs.renameSync(tmpPath, DB_FILE);
    } catch (e) {
      console.error("Failed to write db.json:", e);
    }
  }, 100);
}

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const io = new SocketIOServer(server, {
    cors: { origin: "*" },
    maxHttpBufferSize: 50 * 1024 * 1024, // 50 MB
  });

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));

  // Presence tracking
  const onlineUsers = new Map<string, { username: string; avatar: string; socketId: string; lastSeen: string }>();

  io.on("connection", (socket) => {
    socket.on("join", ({ username, avatar }: { username: string; avatar?: string }) => {
      if (!username) return;
      const cleanUser = username.trim();
      onlineUsers.set(socket.id, {
        username: cleanUser,
        avatar: avatar || "",
        socketId: socket.id,
        lastSeen: new Date().toISOString(),
      });

      // Broadcast presence
      const activeList = Array.from(onlineUsers.values()).map((u) => ({
        username: u.username,
        avatar: u.avatar,
        last_seen: u.lastSeen,
      }));
      io.emit("presence_state", activeList);
    });

    socket.on("typing", (payload: { username: string; isTyping: boolean }) => {
      socket.broadcast.emit("typing", payload);
    });

    socket.on("broadcast_msg", (data: any) => {
      socket.broadcast.emit("broadcast_msg", data);
    });

    socket.on("call_signal", (data: any) => {
      // Forward call signal to specific user
      socket.broadcast.emit("call_signal", data);
    });

    socket.on("call_end", (data: any) => {
      socket.broadcast.emit("call_end", data);
    });

    socket.on("leave", () => {
      onlineUsers.delete(socket.id);
      const activeList = Array.from(onlineUsers.values()).map((u) => ({
        username: u.username,
        avatar: u.avatar,
        last_seen: u.lastSeen,
      }));
      io.emit("presence_state", activeList);
    });

    socket.on("disconnect", () => {
      onlineUsers.delete(socket.id);
      const activeList = Array.from(onlineUsers.values()).map((u) => ({
        username: u.username,
        avatar: u.avatar,
        last_seen: u.lastSeen,
      }));
      io.emit("presence_state", activeList);
    });
  });

  // Helper broadcast change
  function broadcastChange(table: string, eventType: "INSERT" | "UPDATE" | "DELETE", record: any, oldRecord?: any) {
    io.emit("postgres_changes", {
      table,
      eventType,
      new: record,
      old: oldRecord || (eventType === "DELETE" ? record : undefined),
    });
  }

  // API ROUTES
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Server-authoritative CEO claim / role check
  app.post("/api/auth/register-or-claim-ceo", (req, res) => {
    const { username, avatar, bio, phone } = req.body;
    if (!username || typeof username !== "string") {
      return res.status(400).json({ error: "Username required" });
    }
    const cleanUser = username.trim();
    const userLower = cleanUser.toLowerCase();

    const gs = db.group_settings[0] || defaultDatabase.group_settings[0];
    let currentOwner = (gs.owner_username || "").trim();
    const roles = gs.user_roles || {};

    let assignedRole = roles[userLower];

    // Check if company has an owner yet
    if (!currentOwner || currentOwner.toLowerCase() === "mr saqib") {
      // First user ever becomes the CEO!
      currentOwner = cleanUser;
      gs.owner_username = cleanUser;
      gs.user_roles = {
        ...roles,
        [userLower]: "ceo",
      };
      if (!gs.admin_usernames.includes(cleanUser)) {
        gs.admin_usernames.push(cleanUser);
      }
      assignedRole = "ceo";
      persistDatabase();
      broadcastChange("group_settings", "UPDATE", gs);
    } else if (currentOwner.toLowerCase() === userLower) {
      assignedRole = "ceo";
    } else {
      // Subordinate users: default to employee if no role explicitly set
      if (!assignedRole) {
        assignedRole = "employee";
        gs.user_roles = {
          ...roles,
          [userLower]: "employee",
        };
        persistDatabase();
        broadcastChange("group_settings", "UPDATE", gs);
      }
    }

    // Upsert user profile
    const profiles = db.user_profiles || [];
    const existingIdx = profiles.findIndex((p) => p.username?.toLowerCase() === userLower);
    const now = new Date().toISOString();
    let userProfile = {
      username: cleanUser,
      avatar_url: avatar || "",
      bio: bio || "",
      phone: phone || "",
      role: assignedRole,
      status: "online",
      last_seen: now,
      created_at: now,
    };

    if (existingIdx >= 0) {
      userProfile = {
        ...profiles[existingIdx],
        role: assignedRole,
        avatar_url: avatar || profiles[existingIdx].avatar_url || "",
        last_seen: now,
      };
      profiles[existingIdx] = userProfile;
      broadcastChange("user_profiles", "UPDATE", userProfile);
    } else {
      profiles.push(userProfile);
      broadcastChange("user_profiles", "INSERT", userProfile);
    }
    db.user_profiles = profiles;
    persistDatabase();

    return res.json({
      success: true,
      username: cleanUser,
      role: assignedRole,
      isOwner: currentOwner.toLowerCase() === userLower,
      owner_username: currentOwner,
      group_settings: gs,
      user_profile: userProfile,
    });
  });

  // Dedicated Chat Sync Endpoint: Returns all messages sorted chronologically
  app.get("/api/chat/sync", (_req, res) => {
    const messages = [...(db.messages || [])];
    messages.sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
    return res.json({ data: messages, error: null });
  });

  // Hierarchical Role Management: Change / Promote / Demote Role
  app.post("/api/roles/change", (req, res) => {
    const { actorUsername, targetUsername, newRole } = req.body;
    if (!actorUsername || !targetUsername || !newRole) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    const cleanActor = actorUsername.trim();
    const cleanTarget = targetUsername.trim();
    const gs = db.group_settings[0] || defaultDatabase.group_settings[0];

    const actorRole = getUserRole(cleanActor, gs);
    const targetRole = getUserRole(cleanTarget, gs);
    const ownerLower = (gs.owner_username || "").trim().toLowerCase();

    // Prevent modifying CEO directly unless CEO is transferring ownership
    if (cleanTarget.toLowerCase() === ownerLower && newRole !== "ceo") {
      return res.status(403).json({ error: "The CEO role cannot be changed directly! Only current CEO can transfer ownership." });
    }

    // Check tree hierarchy: actor must be strictly higher in rank than target
    if (!canManageUser(actorRole, targetRole)) {
      return res.status(403).json({ error: `Permission Denied: As a ${actorRole}, you cannot modify a ${targetRole}.` });
    }

    // Check allowed assignable roles for this actor
    const allowed = getAllowedAssignableRoles(actorRole);
    if (!allowed.includes(newRole as CompanyRole) && !(actorRole === "ceo" && newRole === "ceo")) {
      return res.status(403).json({ error: `Permission Denied: As a ${actorRole}, you cannot assign ${newRole}.` });
    }

    const updated = applyRoleChange(gs, cleanTarget, newRole as CompanyRole);
    db.group_settings[0] = updated;

    // Update user profile in database
    const profiles = db.user_profiles || [];
    const profIdx = profiles.findIndex((p) => p.username?.toLowerCase() === cleanTarget.toLowerCase());
    if (profIdx >= 0) {
      profiles[profIdx] = { ...profiles[profIdx], role: newRole };
      broadcastChange("user_profiles", "UPDATE", profiles[profIdx]);
    }
    db.user_profiles = profiles;

    persistDatabase();
    broadcastChange("group_settings", "UPDATE", updated);

    // Emit live event for all connected clients
    io.emit("role_changed", {
      targetUsername: cleanTarget,
      newRole,
      actorUsername: cleanActor,
      updatedSettings: updated,
    });

    return res.json({ success: true, updatedSettings: updated, newRole });
  });

  // Hierarchical Role Management: Kick / Remove User from Chat & Company
  app.post("/api/roles/kick", (req, res) => {
    const { actorUsername, targetUsername } = req.body;
    if (!actorUsername || !targetUsername) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    const cleanActor = actorUsername.trim();
    const cleanTarget = targetUsername.trim();
    const targetLower = cleanTarget.toLowerCase();
    const gs = db.group_settings[0] || defaultDatabase.group_settings[0];

    const ownerLower = (gs.owner_username || "").trim().toLowerCase();
    if (targetLower === ownerLower) {
      return res.status(403).json({ error: "The CEO cannot be removed from the company!" });
    }
    if (cleanActor.toLowerCase() === targetLower) {
      return res.status(400).json({ error: "You cannot remove yourself!" });
    }

    const actorRole = getUserRole(cleanActor, gs);
    const targetRole = getUserRole(cleanTarget, gs);

    if (!canManageUser(actorRole, targetRole)) {
      return res.status(403).json({ error: `Permission Denied: As a ${actorRole}, you cannot remove a ${targetRole}.` });
    }

    // 1. Remove from user_profiles table
    const profiles = db.user_profiles || [];
    const targetProf = profiles.find((p) => p.username?.toLowerCase() === targetLower);
    db.user_profiles = profiles.filter((p) => p.username?.toLowerCase() !== targetLower);
    if (targetProf) {
      broadcastChange("user_profiles", "DELETE", targetProf);
    }

    // 2. Remove from all role lists and add to banned/removed list
    const updatedAdmins = (gs.admin_usernames || []).filter((u: string) => u.toLowerCase() !== targetLower);
    const updatedLeaders = (gs.leader_usernames || []).filter((u: string) => u.toLowerCase() !== targetLower);
    const updatedEmployees = (gs.employee_usernames || []).filter((u: string) => u.toLowerCase() !== targetLower);
    const updatedInterns = (gs.intern_usernames || []).filter((u: string) => u.toLowerCase() !== targetLower);
    const currentBanned = gs.banned_usernames || [];
    const updatedBanned = Array.from(new Set([...currentBanned, cleanTarget]));

    const updatedRoles = { ...(gs.user_roles || {}) };
    delete updatedRoles[targetLower];

    const updated: GroupSettings = {
      ...gs,
      admin_usernames: updatedAdmins,
      leader_usernames: updatedLeaders,
      employee_usernames: updatedEmployees,
      intern_usernames: updatedInterns,
      banned_usernames: updatedBanned,
      user_roles: updatedRoles,
    };
    db.group_settings[0] = updated;

    persistDatabase();
    broadcastChange("group_settings", "UPDATE", updated);

    // Live kick alert to target and all users
    io.emit("user_kicked", {
      username: cleanTarget,
      actor: cleanActor,
      role: targetRole,
    });

    return res.json({ success: true, kickedUsername: cleanTarget });
  });

  // Hierarchical Role Management: Ban / Unban User from Chat
  app.post("/api/roles/ban", (req, res) => {
    const { actorUsername, targetUsername, ban } = req.body;
    if (!actorUsername || !targetUsername) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    const cleanActor = actorUsername.trim();
    const cleanTarget = targetUsername.trim();
    const targetLower = cleanTarget.toLowerCase();
    const gs = db.group_settings[0] || defaultDatabase.group_settings[0];

    const ownerLower = (gs.owner_username || "").trim().toLowerCase();
    if (targetLower === ownerLower) {
      return res.status(403).json({ error: "The CEO cannot be banned!" });
    }

    const actorRole = getUserRole(cleanActor, gs);
    const targetRole = getUserRole(cleanTarget, gs);

    if (!canManageUser(actorRole, targetRole)) {
      return res.status(403).json({ error: `Permission Denied: As a ${actorRole}, you cannot ban a ${targetRole}.` });
    }

    let updatedBanned = (gs.banned_usernames || []).filter((u: string) => u.toLowerCase() !== targetLower);
    if (ban !== false) {
      updatedBanned.push(cleanTarget);
    }
    const updated: GroupSettings = {
      ...gs,
      banned_usernames: Array.from(new Set(updatedBanned)),
    };
    db.group_settings[0] = updated;

    persistDatabase();
    broadcastChange("group_settings", "UPDATE", updated);

    io.emit("user_banned_status", {
      username: cleanTarget,
      isBanned: ban !== false,
      actor: cleanActor,
    });

    return res.json({ success: true, banned: ban !== false, target: cleanTarget });
  });

  // REST generic query endpoint
  app.get("/api/db/:table", (req, res) => {
    const { table } = req.params;
    if (!db[table]) {
      db[table] = [];
    }

    let records = [...db[table]];

    // Parse filters
    for (const [key, val] of Object.entries(req.query)) {
      if (key === "order") {
        const [col, dir] = (val as string).split(".");
        records.sort((a, b) => {
          const aVal = a[col] || "";
          const bVal = b[col] || "";
          return dir === "desc"
            ? String(bVal).localeCompare(String(aVal))
            : String(aVal).localeCompare(String(bVal));
        });
      } else if (key === "limit") {
        records = records.slice(0, parseInt(val as string, 10));
      } else if (key === "single" || key === "maybeSingle") {
        // handled below
      } else if (typeof val === "string") {
        if (val.startsWith("eq.")) {
          const target = val.slice(3);
          records = records.filter((r) => String(r[key]) === target);
        } else if (val.startsWith("ilike.")) {
          const target = val.slice(6).toLowerCase().replace(/%/g, "");
          records = records.filter((r) => String(r[key] || "").toLowerCase().includes(target));
        } else if (val === "is.null") {
          records = records.filter((r) => r[key] === null || r[key] === undefined || r[key] === "");
        } else if (val.startsWith("in.(")) {
          const items = val.slice(4, -1).split(",").map((s) => s.trim().replace(/^"|"$/g, ""));
          records = records.filter((r) => items.includes(String(r[key])));
        }
      }
    }

    if (req.query.single === "true" || req.query.maybeSingle === "true") {
      return res.json({ data: records[0] || null, error: null });
    }

    return res.json({ data: records, error: null });
  });

  // Insert endpoint (with duplicate-prevention)
  app.post("/api/db/:table", (req, res) => {
    const { table } = req.params;
    if (!db[table]) db[table] = [];

    const body = req.body;
    const items = Array.isArray(body) ? body : [body];
    const inserted: any[] = [];

    for (const item of items) {
      const now = new Date().toISOString();
      const recordId = item.id || `${table}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const existingIdx = db[table].findIndex((r) => String(r.id) === String(recordId));

      if (existingIdx >= 0) {
        const merged = {
          ...db[table][existingIdx],
          ...item,
          id: recordId,
          updated_at: now,
        };
        db[table][existingIdx] = merged;
        inserted.push(merged);
        broadcastChange(table, "UPDATE", merged);
      } else {
        const record = {
          id: recordId,
          created_at: item.created_at || now,
          ...item,
        };
        db[table].push(record);
        inserted.push(record);
        broadcastChange(table, "INSERT", record);
      }
    }

    persistDatabase();
    return res.json({ data: inserted, error: null });
  });

  // Upsert endpoint
  app.post("/api/db/:table/upsert", (req, res) => {
    const { table } = req.params;
    if (!db[table]) db[table] = [];

    const body = req.body;
    const items = Array.isArray(body) ? body : [body];
    const upserted: any[] = [];

    for (const item of items) {
      const now = new Date().toISOString();
      const existingIdx = db[table].findIndex((r) => {
        if (item.id && r.id === item.id) return true;
        if (table === "user_profiles" && item.username && r.username?.toLowerCase() === item.username.toLowerCase()) return true;
        if (table === "group_settings" && (item.id === 1 || r.id === 1)) return true;
        return false;
      });

      if (existingIdx >= 0) {
        const merged = { ...db[table][existingIdx], ...item, updated_at: now };
        db[table][existingIdx] = merged;
        upserted.push(merged);
        broadcastChange(table, "UPDATE", merged);
      } else {
        const record = {
          id: item.id || (table === "group_settings" ? 1 : `${table}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`),
          created_at: item.created_at || now,
          ...item,
        };
        db[table].push(record);
        upserted.push(record);
        broadcastChange(table, "INSERT", record);
      }
    }

    persistDatabase();
    return res.json({ data: upserted, error: null });
  });

  // Update endpoint
  app.patch("/api/db/:table", (req, res) => {
    const { table } = req.params;
    if (!db[table]) db[table] = [];

    const updates = req.body;
    const idFilter = req.query.id as string;
    const usernameFilter = req.query.username as string;

    let targetId: any = null;
    if (idFilter) {
      targetId = idFilter.startsWith("eq.") ? idFilter.slice(3) : idFilter;
    }

    const updated: any[] = [];
    db[table] = db[table].map((record) => {
      let matches = false;
      if (targetId && String(record.id) === String(targetId)) matches = true;
      if (usernameFilter && record.username?.toLowerCase() === (usernameFilter.startsWith("eq.") ? usernameFilter.slice(3) : usernameFilter).toLowerCase()) matches = true;

      if (matches) {
        const next = { ...record, ...updates, updated_at: new Date().toISOString() };
        updated.push(next);
        broadcastChange(table, "UPDATE", next);
        return next;
      }
      return record;
    });

    persistDatabase();
    return res.json({ data: updated, error: null });
  });

  // Delete endpoint
  app.delete("/api/db/:table", (req, res) => {
    const { table } = req.params;
    if (!db[table]) db[table] = [];

    const idFilter = req.query.id as string;
    const usernameFilter = req.query.username as string;

    let targetId: any = null;
    if (idFilter) {
      targetId = idFilter.startsWith("eq.") ? idFilter.slice(3) : idFilter;
    }

    const deleted: any[] = [];
    db[table] = db[table].filter((record) => {
      let matches = false;
      if (targetId && String(record.id) === String(targetId)) matches = true;
      if (usernameFilter && record.username?.toLowerCase() === (usernameFilter.startsWith("eq.") ? usernameFilter.slice(3) : usernameFilter).toLowerCase()) matches = true;

      if (matches) {
        deleted.push(record);
        broadcastChange(table, "DELETE", record);
        return false;
      }
      return true;
    });

    persistDatabase();
    return res.json({ data: deleted, error: null });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
