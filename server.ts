import express from "express";
import http from "http";
import path from "path";
import fs from "fs";
import { Server as SocketIOServer } from "socket.io";
import { createServer as createViteServer } from "vite";

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

  // Insert endpoint
  app.post("/api/db/:table", (req, res) => {
    const { table } = req.params;
    if (!db[table]) db[table] = [];

    const body = req.body;
    const items = Array.isArray(body) ? body : [body];
    const inserted: any[] = [];

    for (const item of items) {
      const now = new Date().toISOString();
      const record = {
        id: item.id || `${table}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        created_at: item.created_at || now,
        ...item,
      };
      db[table].push(record);
      inserted.push(record);
      broadcastChange(table, "INSERT", record);
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
