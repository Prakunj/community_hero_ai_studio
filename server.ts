import dotenv from "dotenv";
dotenv.config();

import express from "express";
import path from "path";
import fs from "fs";
import multer from "multer";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";

// Initialize Gemini Client safely
const apiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;
if (apiKey) {
  ai = new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

import { createClient } from "@supabase/supabase-js";

// Helper types for Supabase entities
export interface Profile {
  id: string;
  email: string;
  name: string;
  role: "citizen" | "admin";
  created_at: string;
}

export interface Issue {
  id: string;
  title: string;
  description: string;
  category: "pothole" | "garbage" | "water_leakage" | "streetlight" | "drain" | "other";
  status: "reported" | "verified" | "in_progress" | "resolved" | "rejected";
  lat: number;
  lng: number;
  address: string;
  image_url: string;
  media_type: "image" | "video";
  reporter_id: string;
  verification_count: number;
  ai_category?: string;
  ai_confidence?: number;
  ai_raw?: string;
  duplicate_of?: string | null;
  agent_analysis?: {
    steps: {
      step: string;
      name: string;
      input: any;
      output: any;
      duration_ms: number;
    }[];
    urgency_score: number;
    severity: "low" | "medium" | "high" | "critical";
    resolution_plan: {
      department: string;
      priority: "low" | "medium" | "high" | "critical";
      estimated_days: number;
      steps: string[];
      public_message: string;
    };
  } | null;
  created_at: string;
  updated_at: string;
}

export interface Verification {
  id: string;
  issue_id: string;
  user_id: string;
  created_at: string;
}

export interface IssueEvent {
  id: string;
  issue_id: string;
  user_id: string;
  type: "created" | "status_changed" | "verified" | "unverified" | "comment";
  payload: any;
  created_at: string;
}

// Helper to safely obtain a Supabase client lazily (returns a fresh client to prevent session leakage)
let useLocalMockDB = false;

// Mock database store definitions
const fallbackFilePath = path.join(process.cwd(), "db-fallback.json");

function getFallbackDB() {
  if (fs.existsSync(fallbackFilePath)) {
    try {
      return JSON.parse(fs.readFileSync(fallbackFilePath, "utf8"));
    } catch (e) {
      console.error("Error reading fallback DB, resetting...", e);
    }
  }
  return {
    profiles: [],
    issues: [],
    verifications: [],
    issue_events: []
  };
}

function saveFallbackDB(db: any) {
  try {
    fs.writeFileSync(fallbackFilePath, JSON.stringify(db, null, 2), "utf8");
  } catch (e) {
    console.error("Failed to write fallback DB file:", e);
  }
}

function getTableData(table: string): any[] {
  const db = getFallbackDB();
  const normalizedTable = table === "issue-media" ? "issue_events" : table;
  if (!db[normalizedTable]) {
    db[normalizedTable] = [];
    saveFallbackDB(db);
  }
  return db[normalizedTable];
}

function saveTableData(table: string, data: any[]) {
  const db = getFallbackDB();
  const normalizedTable = table === "issue-media" ? "issue_events" : table;
  db[normalizedTable] = data;
  saveFallbackDB(db);
}

class MockQueryBuilder {
  private table: string;
  private filters: Array<(item: any) => boolean> = [];
  private orderCol: string | null = null;
  private orderAscending: boolean = true;
  private limitCount: number | null = null;

  constructor(table: string) {
    this.table = table;
  }

  select(columns: string = "*") {
    return this;
  }

  eq(column: string, value: any) {
    this.filters.push((item) => item[column] === value);
    return this;
  }

  neq(column: string, value: any) {
    this.filters.push((item) => item[column] !== value);
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orderCol = column;
    this.orderAscending = options?.ascending !== false;
    return this;
  }

  limit(n: number) {
    this.limitCount = n;
    return this;
  }

  async insert(data: any | any[]) {
    try {
      const items = Array.isArray(data) ? data : [data];
      const tableData = getTableData(this.table);
      for (const item of items) {
        if (item.id) {
          const idx = tableData.findIndex(x => x.id === item.id);
          if (idx !== -1) {
            tableData[idx] = { ...tableData[idx], ...item };
            continue;
          }
        }
        tableData.push(item);
      }
      saveTableData(this.table, tableData);
      return { data: items, error: null };
    } catch (err: any) {
      return { data: null, error: err };
    }
  }

  async update(data: any) {
    try {
      const tableData = getTableData(this.table);
      const filtered = tableData.filter(item => {
        return this.filters.every(f => f(item));
      });
      for (const item of filtered) {
        Object.assign(item, data);
      }
      saveTableData(this.table, tableData);
      return { data: filtered, error: null };
    } catch (err: any) {
      return { data: null, error: err };
    }
  }

  async delete() {
    try {
      const tableData = getTableData(this.table);
      const remaining = tableData.filter(item => {
        return !this.filters.every(f => f(item));
      });
      const deleted = tableData.filter(item => {
        return this.filters.every(f => f(item));
      });
      saveTableData(this.table, remaining);
      return { data: deleted, error: null };
    } catch (err: any) {
      return { data: null, error: err };
    }
  }

  private executeQuery() {
    let list = [...getTableData(this.table)];
    for (const f of this.filters) {
      list = list.filter(f);
    }
    if (this.orderCol) {
      const col = this.orderCol;
      const asc = this.orderAscending;
      list.sort((a, b) => {
        const valA = a[col];
        const valB = b[col];
        if (valA === undefined || valA === null) return 1;
        if (valB === undefined || valB === null) return -1;
        if (valA < valB) return asc ? -1 : 1;
        if (valA > valB) return asc ? 1 : -1;
        return 0;
      });
    }
    if (this.limitCount !== null) {
      list = list.slice(0, this.limitCount);
    }
    return list;
  }

  async maybeSingle() {
    const list = this.executeQuery();
    return { data: list.length > 0 ? list[0] : null, error: null };
  }

  async single() {
    const list = this.executeQuery();
    if (list.length === 0) {
      return { data: null, error: { message: "No rows found", code: "PGRST116" } };
    }
    return { data: list[0], error: null };
  }

  then(onfulfilled?: (value: any) => any, onrejected?: (reason: any) => any) {
    const list = this.executeQuery();
    return Promise.resolve({ data: list, error: null }).then(onfulfilled, onrejected);
  }
}

function decodeJWTPayload(token: string): any {
  try {
    const parts = token.split(".");
    if (parts.length === 3) {
      const payloadBase64 = parts[1];
      const normalized = payloadBase64.replace(/-/g, "+").replace(/_/g, "/");
      const jsonStr = Buffer.from(normalized, "base64").toString("utf8");
      return JSON.parse(jsonStr);
    }
  } catch (e) {
    console.warn("Failed to decode JWT payload in mock mode:", e);
  }
  return null;
}

function createMockSupabase(): any {
  return {
    from: (table: string) => new MockQueryBuilder(table),
    auth: {
      getUser: async (token: string) => {
        if (token && token.startsWith("mock_token_")) {
          const userId = token.substring(11);
          const profiles = getTableData("profiles");
          const profile = profiles.find(p => p.id === userId);
          if (profile) {
            return { data: { user: { id: profile.id, email: profile.email, user_metadata: { name: profile.name } } }, error: null };
          }
        } else if (token) {
          // Robust Fallback: Decode real Supabase JWT token if present
          const decoded = decodeJWTPayload(token);
          if (decoded && decoded.sub) {
            const profiles = getTableData("profiles");
            let profile = profiles.find(p => p.id === decoded.sub || p.email?.toLowerCase() === decoded.email?.toLowerCase());
            if (!profile) {
              // Auto-seed/create the profile in mock DB to match the authenticated JWT user
              const email = decoded.email || "citizen_jwt@test.com";
              profile = {
                id: decoded.sub,
                email: email,
                name: decoded.user_metadata?.name || email.split("@")[0] || "Citizen",
                role: email.toLowerCase().includes("admin") ? "admin" : "citizen",
                created_at: new Date().toISOString()
              };
              profiles.push(profile);
              saveTableData("profiles", profiles);
            }
            return { data: { user: { id: profile.id, email: profile.email, user_metadata: { name: profile.name } } }, error: null };
          }
        }
        return { data: { user: null }, error: { message: "Invalid token" } };
      },
      signInWithPassword: async ({ email }: { email: string }) => {
        const profiles = getTableData("profiles");
        const profile = profiles.find(p => p.email?.toLowerCase() === email?.toLowerCase());
        if (profile) {
          return {
            data: {
              user: { id: profile.id, email: profile.email, user_metadata: { name: profile.name } },
              session: { access_token: `mock_token_${profile.id}` }
            },
            error: null
          };
        }
        return { data: { user: null, session: null }, error: { message: "User profile not found in mock database." } };
      },
      signOut: async () => ({ error: null }),
      admin: {
        createUser: async ({ email, user_metadata }: any) => {
          const userId = "u_mock_" + Math.random().toString(36).substring(2, 9);
          const name = user_metadata?.name || email.split("@")[0] || "Citizen";
          return {
            data: {
              user: { id: userId, email, user_metadata: { name } }
            },
            error: null
          };
        }
      }
    },
    storage: {
      listBuckets: async () => ({ data: [{ id: "issue-media" }], error: null }),
      createBucket: async () => ({ error: null }),
      from: () => ({
        upload: async (filePath: string, buffer: Buffer, options: any) => {
          try {
            const dir = path.join(process.cwd(), "dist", "uploads");
            fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(path.join(dir, filePath), buffer);
            return { data: { path: filePath }, error: null };
          } catch (e: any) {
            return { data: null, error: e };
          }
        },
        getPublicUrl: (filePath: string) => {
          return { data: { publicUrl: `/uploads/${filePath}` } };
        }
      })
    }
  };
}

function getSupabase(token?: string) {
  if (useLocalMockDB) {
    return createMockSupabase();
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseServiceKey) {
    useLocalMockDB = true;
    return createMockSupabase();
  }
  
  try {
    let cleanUrl = supabaseUrl.trim();
    if (cleanUrl.endsWith("/")) {
      cleanUrl = cleanUrl.slice(0, -1);
    }
    if (cleanUrl.endsWith("/rest/v1")) {
      cleanUrl = cleanUrl.slice(0, -8);
    }

    if (token && supabaseAnonKey) {
      return createClient(cleanUrl, supabaseAnonKey.trim(), {
        global: {
          headers: {
            Authorization: `Bearer ${token}`
          }
        },
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false
        }
      });
    }

    return createClient(cleanUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      }
    });
  } catch (err) {
    console.warn("Failed to initialize real Supabase client. Falling back to local DB.", err);
    useLocalMockDB = true;
    return createMockSupabase();
  }
}

// SQL schema for user reference:
/*
-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'citizen',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create issues table
CREATE TABLE IF NOT EXISTS issues (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'reported',
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  address TEXT NOT NULL,
  image_url TEXT NOT NULL,
  media_type TEXT NOT NULL DEFAULT 'image',
  reporter_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  verification_count INTEGER NOT NULL DEFAULT 0,
  ai_category TEXT,
  ai_confidence DOUBLE PRECISION,
  ai_raw TEXT,
  duplicate_of TEXT REFERENCES issues(id) ON DELETE SET NULL,
  agent_analysis JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create verifications table
CREATE TABLE IF NOT EXISTS verifications (
  id TEXT PRIMARY KEY,
  issue_id TEXT REFERENCES issues(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(issue_id, user_id)
);

-- Create issue_events table
CREATE TABLE IF NOT EXISTS issue_events (
  id TEXT PRIMARY KEY,
  issue_id TEXT REFERENCES issues(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
*/

// Try to seed Supabase if tables are empty
async function seedSupabaseIfEmpty(supabase: any) {
  try {
    // Check if profiles table is empty
    const { data: profiles, error: pError } = await supabase.from("profiles").select("id").limit(1);
    if (pError) {
      console.warn("Could not query profiles table. It might not exist yet. Please create the schema in your Supabase dashboard.", pError);
      return;
    }

    if (!profiles || profiles.length === 0) {
      console.log("Profiles table is empty. Seeding test users into Supabase...");
      const testUsers = [
        { id: "u1", email: "citizen_a@test.com", name: "Arjun Mehta", role: "citizen", created_at: new Date().toISOString() },
        { id: "u2", email: "citizen_b@test.com", name: "Priya Sharma", role: "citizen", created_at: new Date().toISOString() },
        { id: "u3", email: "citizen_c@test.com", name: "Kabir Singh", role: "citizen", created_at: new Date().toISOString() },
        { id: "u4", email: "citizen_d@test.com", name: "Meera Patel", role: "citizen", created_at: new Date().toISOString() },
        { id: "admin", email: "admin_test@test.com", name: "Official Admin", role: "admin", created_at: new Date().toISOString() },
      ];
      await supabase.from("profiles").insert(testUsers);
    }

    // Check if issues table is empty
    const { data: issues, error: iError } = await supabase.from("issues").select("id").limit(1);
    if (iError) {
      console.warn("Could not query issues table. It might not exist yet.", iError);
      return;
    }

    if (!issues || issues.length === 0) {
      console.log("Issues table is empty. Seeding sample Indian city issues into Supabase...");
      const sampleIssues = [
        {
          id: "issue_1",
          title: "Large Pothole near Silk Board Junction",
          description: "A huge pothole has formed right in the middle of the service lane. It is extremely dangerous for two-wheelers especially at night.",
          category: "pothole",
          status: "reported",
          lat: 12.9176,
          lng: 77.6233,
          address: "Silk Board Junction Flyover Service Rd, Sector 6, HSR Layout, Bengaluru, Karnataka 560102",
          image_url: "https://images.unsplash.com/photo-1515162305285-0293e4767cc2?auto=format&fit=crop&w=600&q=80",
          media_type: "image",
          reporter_id: "u1",
          verification_count: 3,
          created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
          updated_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
          ai_category: "pothole",
          ai_confidence: 0.95,
          duplicate_of: null,
          agent_analysis: null,
        },
        {
          id: "issue_2",
          title: "Garbage pile dumping in Indiranagar 12th Main",
          description: "Illegal commercial waste is being dumped on the pavement. Extremely unhygienic, causing bad odor across the entire shopping street.",
          category: "garbage",
          status: "in_progress",
          lat: 12.9719,
          lng: 77.6412,
          address: "12th Main Rd, HAL 2nd Stage, Indiranagar, Bengaluru, Karnataka 560038",
          image_url: "https://images.unsplash.com/photo-1611284446314-60a58ac0deb9?auto=format&fit=crop&w=600&q=80",
          media_type: "image",
          reporter_id: "u2",
          verification_count: 5,
          created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
          updated_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          ai_category: "garbage",
          ai_confidence: 0.98,
          duplicate_of: null,
          agent_analysis: {
            urgency_score: 28,
            severity: "high",
            steps: [
              { step: "1", name: "get_issue", input: { id: "issue_2" }, output: "Fetched Indiranagar Garbage Pile issue.", duration_ms: 45 },
              { step: "2", name: "check_area_history", input: { lat: 12.9719, lng: 77.6412, category: "garbage" }, output: "Found 2 similar resolved issues in Indiranagar in the last 6 months.", duration_ms: 120 },
              { step: "3", name: "assess_community_urgency", input: { verifications: 5, days_open: 5 }, output: "Urgency Calculated: 28 (High community response)", duration_ms: 80 },
              { step: "4", name: "analyze_severity", input: { title: "Garbage pile dumping...", description: "Illegal commercial waste..." }, output: "Severity set to High due to public health risks and blockages.", duration_ms: 450 },
              { step: "5", name: "generate_resolution_plan", input: {}, output: "Resolution plan completed. Department: BBMP Solid Waste Management.", duration_ms: 600 }
            ],
            resolution_plan: {
              department: "Bruhat Bengaluru Mahanagara Palike (BBMP) - Solid Waste Management Office",
              priority: "high",
              estimated_days: 2,
              steps: [
                "Deploy sanitation supervisor to inspect Indiranagar 12th Main",
                "Dispatch waste collection dumper to clear current pile",
                "Install localized CCTV camera / signboards warning of fine for illegal dumping"
              ],
              public_message: "BBMP Sanitation squad has been notified. Clean up operations are scheduled within 48 hours, and surveillance is being heightened to prevent recurring commercial dumpings."
            }
          }
        },
        {
          id: "issue_3",
          title: "Major water pipeline leakage at Koramangala 4th Block",
          description: "Clean drinking water is bursting out of the road pipeline and flooding the street. Thousands of liters are being wasted since morning.",
          category: "water_leakage",
          status: "resolved",
          lat: 12.9343,
          lng: 77.6244,
          address: "80 Feet Rd, 4th Block, Koramangala, Bengaluru, Karnataka 560034",
          image_url: "https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=600&q=80",
          media_type: "image",
          reporter_id: "u3",
          verification_count: 8,
          created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
          updated_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
          ai_category: "water_leakage",
          ai_confidence: 0.99,
          duplicate_of: null,
          agent_analysis: null,
        },
        {
          id: "issue_4",
          title: "Non-functional streetlights on MG Road",
          description: "At least 5 consecutive lamp posts are completely blacked out near the metro station. Feels unsafe for pedestrians.",
          category: "streetlight",
          status: "reported",
          lat: 12.9740,
          lng: 77.6078,
          address: "MG Road Metro Station Footpath, MG Road, Bengaluru, Karnataka 560001",
          image_url: "",
          media_type: "image",
          reporter_id: "u4",
          verification_count: 1,
          created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
          updated_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
          ai_category: "streetlight",
          ai_confidence: 0.91,
          duplicate_of: null,
          agent_analysis: null,
        }
      ];
      await supabase.from("issues").insert(sampleIssues);

      // Seed timeline events
      const events = [];
      for (const iss of sampleIssues) {
        events.push({
          id: `ev_${iss.id}_1`,
          issue_id: iss.id,
          user_id: iss.reporter_id,
          type: "created",
          payload: { title: iss.title },
          created_at: iss.created_at,
        });

        if (iss.status === "in_progress") {
          events.push({
            id: `ev_${iss.id}_2`,
            issue_id: iss.id,
            user_id: "admin",
            type: "status_changed",
            payload: { old: "reported", new: "in_progress" },
            created_at: iss.updated_at,
          });
        } else if (iss.status === "resolved") {
          events.push({
            id: `ev_${iss.id}_2`,
            issue_id: iss.id,
            user_id: "admin",
            type: "status_changed",
            payload: { old: "reported", new: "in_progress" },
            created_at: new Date(new Date(iss.created_at).getTime() + 1 * 24 * 60 * 60 * 1000).toISOString(),
          });
          events.push({
            id: `ev_${iss.id}_3`,
            issue_id: iss.id,
            user_id: "admin",
            type: "status_changed",
            payload: { old: "in_progress", new: "resolved" },
            created_at: iss.updated_at,
          });
        }
      }
      await supabase.from("issue_events").insert(events);

      // Seed some verifications to simulate interaction
      const verifications = [
        { id: "v1", issue_id: "issue_1", user_id: "u2", created_at: new Date().toISOString() },
        { id: "v2", issue_id: "issue_1", user_id: "u3", created_at: new Date().toISOString() },
        { id: "v3", issue_id: "issue_1", user_id: "u4", created_at: new Date().toISOString() },
        { id: "v4", issue_id: "issue_2", user_id: "u1", created_at: new Date().toISOString() },
        { id: "v5", issue_id: "issue_2", user_id: "u3", created_at: new Date().toISOString() },
        { id: "v6", issue_id: "issue_2", user_id: "u4", created_at: new Date().toISOString() }
      ];
      await supabase.from("verifications").insert(verifications);
    }
    console.log("Supabase seed checks completed successfully.");
  } catch (err) {
    console.warn("Seeding Supabase failed:", err);
  }
}

// Haversine formula to compute distance in meters between two coordinates
function getDistanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000; // Radius of the earth in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Start Server Setup
async function startServer() {
  const app = express();
  const PORT = 3000;

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 50 * 1024 * 1024, // 50MB limit
    },
  });

  // JSON Body limit 50mb as requested
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Authentication & Session Middleware using Supabase Auth JWT
  app.use(async (req, res, next) => {
    try {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith("Bearer ")) {
        const token = authHeader.substring(7);
        const supabase = getSupabase();
        
        // Use getUser as it safely verifies the token with Supabase Auth
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        
        if (authError) {
          // Gracefully ignore expected errors like expired or missing sessions to avoid polluting test logs
        } else if (user) {
          // Fetch or auto-create profile
          const { data: profile, error: profileError } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", user.id)
            .maybeSingle();
            
          if (profileError) {
            console.warn("Error fetching profile:", profileError.message);
          } else if (profile) {
            (req as any).user = profile;
          } else {
            // Profile does not exist yet. Let's auto-create it with default role 'citizen'
            const email = user.email || "";
            const name = user.user_metadata?.name || email.split("@")[0] || "Citizen";
            const newProfile: Profile = {
              id: user.id,
              email,
              name,
              role: "citizen", // Default role MUST be citizen!
              created_at: new Date().toISOString(),
            };
            
            const { error: insertError } = await supabase
              .from("profiles")
              .insert(newProfile);
              
            if (insertError) {
              console.warn("Failed to auto-create profile:", insertError.message);
            } else {
              (req as any).user = newProfile;
            }
          }
        }
      }
    } catch (err: any) {
      console.warn("Auth middleware failed:", err.message);
    }
    next();
  });

  // Auth Endpoints
  app.get("/api/auth/me", (req, res) => {
    res.json({ user: (req as any).user || null });
  });

  app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and Password are required" });
    }
    try {
      const supabase = getSupabase();
      
      const { data: authData, error: loginError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (loginError) {
        return res.status(401).json({ error: loginError.message });
      }

      if (!authData.user) {
        return res.status(401).json({ error: "Authentication failed." });
      }

      // Get profile role and data using a clean service role client to bypass user-level RLS restrictions
      const adminSupabase = getSupabase();
      let { data: profile, error: profileError } = await adminSupabase
        .from("profiles")
        .select("*")
        .eq("id", authData.user.id)
        .maybeSingle();

      if (profileError) throw profileError;

      // Auto-create profile if missing
      if (!profile) {
        // Check if there is an existing seeded profile with same email
        const { data: existingProfileByEmail } = await adminSupabase
          .from("profiles")
          .select("*")
          .eq("email", email)
          .maybeSingle();

        let assignedRole: "citizen" | "admin" = email.toLowerCase().includes("admin") ? "admin" : "citizen";
        if (existingProfileByEmail) {
          assignedRole = email.toLowerCase().includes("admin") ? "admin" : existingProfileByEmail.role;
          if (existingProfileByEmail.id !== authData.user.id) {
            // Update issues and events
            await adminSupabase
              .from("issues")
              .update({ reporter_id: authData.user.id })
              .eq("reporter_id", existingProfileByEmail.id);

            await adminSupabase
              .from("issue_events")
              .update({ user_id: authData.user.id })
              .eq("user_id", existingProfileByEmail.id);

            // Delete old profile
            await adminSupabase
              .from("profiles")
              .delete()
              .eq("id", existingProfileByEmail.id);
          }
        } else if (email.toLowerCase().includes("admin")) {
          assignedRole = "admin";
        }

        const name = authData.user.user_metadata?.name || email.split("@")[0] || "Citizen";
        const newProfile: Profile = {
          id: authData.user.id,
          email,
          name,
          role: assignedRole,
          created_at: new Date().toISOString()
        };
        const { error: insertError } = await adminSupabase
          .from("profiles")
          .insert(newProfile);
        if (insertError) throw insertError;
        profile = newProfile;
      }

      res.json({ success: true, user: profile, session: authData.session });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/auth/signup", async (req, res) => {
    const { email, password, name } = req.body;
    if (!email || !name || !password) {
      return res.status(400).json({ error: "Email, Password, and Name are required" });
    }
    try {
      const supabase = getSupabase();

      // Create the user via Admin API to bypass rate limits and auto-confirm email
      const { data: authData, error: signUpError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          name
        }
      });

      if (signUpError) throw signUpError;
      if (!authData.user) {
        return res.status(400).json({ error: "Sign up failed to return user data." });
      }

      // Check if profile exists already with same email but different ID (e.g. seeded profile)
      const { data: existingProfileByEmail } = await supabase
        .from("profiles")
        .select("*")
        .eq("email", email)
        .maybeSingle();

      let assignedRole: "citizen" | "admin" = email.toLowerCase().includes("admin") ? "admin" : "citizen";
      if (existingProfileByEmail) {
        assignedRole = email.toLowerCase().includes("admin") ? "admin" : existingProfileByEmail.role;

        if (existingProfileByEmail.id !== authData.user.id) {
          // Update all issues referencing the old ID to the new user ID
          await supabase
            .from("issues")
            .update({ reporter_id: authData.user.id })
            .eq("reporter_id", existingProfileByEmail.id);

          // Update all issue_events referencing the old ID to the new user ID
          await supabase
            .from("issue_events")
            .update({ user_id: authData.user.id })
            .eq("user_id", existingProfileByEmail.id);

          // Delete old profile
          await supabase
            .from("profiles")
            .delete()
            .eq("id", existingProfileByEmail.id);
        }
      } else if (email.toLowerCase().includes("admin")) {
        assignedRole = "admin";
      }

      // Check if profile exists already
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", authData.user.id)
        .maybeSingle();

      let profile = existingProfile;
      if (!profile) {
        // Create profiles entry
        const newProfile: Profile = {
          id: authData.user.id,
          email,
          name,
          role: assignedRole,
          created_at: new Date().toISOString(),
        };

        const { error: insertError } = await supabase
          .from("profiles")
          .insert(newProfile);

        if (insertError) throw insertError;
        profile = newProfile;
      }

      // Automatically sign in the newly registered user to get a valid session
      const { data: sessionData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) throw signInError;

      res.json({ success: true, user: profile, session: sessionData.session });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/auth/logout", async (req, res) => {
    try {
      const supabase = getSupabase();
      await supabase.auth.signOut();
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/upload", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file was uploaded." });
      }

      const supabase = getSupabase();
      const file = req.file;
      const fileExt = file.originalname.split(".").pop();
      const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
      const filePath = fileName;

      // Upload file to Supabase storage bucket "issue-media"
      const { data, error: uploadError } = await supabase.storage
        .from("issue-media")
        .upload(filePath, file.buffer, {
          contentType: file.mimetype,
          upsert: true,
        });

      if (uploadError) {
        throw uploadError;
      }

      // Get the public URL for the uploaded file
      const { data: publicUrlData } = supabase.storage
        .from("issue-media")
        .getPublicUrl(filePath);

      const publicUrl = publicUrlData?.publicUrl;

      res.json({
        success: true,
        url: publicUrl,
        media_type: file.mimetype.startsWith("video/") ? "video" : "image"
      });
    } catch (err: any) {
      console.error("Storage upload endpoint failed:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // 1. GET /api/issues — list with filters (category, status, lat/lng/radius)
  app.get("/api/issues", async (req, res) => {
    const { category, status, lat, lng, radius } = req.query;
    try {
      const supabase = getSupabase();
      const { data: dbIssues, error } = await supabase
        .from("issues")
        .select("*");

      if (error) throw error;

      let filtered = [...(dbIssues || [])];

      if (category && category !== "all") {
        filtered = filtered.filter((i) => i.category === category);
      }
      if (status && status !== "all") {
        filtered = filtered.filter((i) => i.status === status);
      }
      if (lat && lng && radius) {
        const originLat = parseFloat(lat as string);
        const originLng = parseFloat(lng as string);
        const radMeters = parseFloat(radius as string);
        filtered = filtered.filter((i) => {
          const d = getDistanceMeters(originLat, originLng, i.lat, i.lng);
          return d <= radMeters;
        });
      }

      // Sort by newest first
      filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      res.json(filtered);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/issues/:id - get single issue with timeline events
  app.get("/api/issues/:id", async (req, res) => {
    const { id } = req.params;
    try {
      const supabase = getSupabase();
      const { data: issue, error: issueError } = await supabase
        .from("issues")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (issueError) throw issueError;
      if (!issue) {
        return res.status(404).json({ error: "Issue not found" });
      }

      // Get timeline events
      const { data: events, error: eventsError } = await supabase
        .from("issue_events")
        .select("*")
        .eq("issue_id", id)
        .order("created_at", { ascending: true });

      if (eventsError) throw eventsError;

      // Fetch profiles to map names to events
      const userIds = Array.from(new Set((events || []).map((e: any) => e.user_id).filter(Boolean)));
      let profilesMap: Record<string, any> = {};
      if (userIds.length > 0) {
        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select("id, name, role")
          .in("id", userIds);

        if (!profilesError && profiles) {
          profiles.forEach((p: any) => {
            profilesMap[p.id] = p;
          });
        }
      }

      const timelineWithUser = (events || []).map((e: any) => {
        const profile = profilesMap[e.user_id];
        return {
          ...e,
          user_name: profile ? profile.name : "System / Citizen",
          user_role: profile ? profile.role : "citizen",
        };
      });

      res.json({ issue, timeline: timelineWithUser });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/issues/:id/nearby — find issues within 100m of same category for duplicate detection
  app.get("/api/issues/:id/nearby", async (req, res) => {
    const { id } = req.params;
    try {
      const supabase = getSupabase();
      const { data: issue, error: issueError } = await supabase
        .from("issues")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (issueError) throw issueError;
      if (!issue) {
        return res.status(404).json({ error: "Issue not found" });
      }

      // Get same category issues
      const { data: sameCategory, error: scError } = await supabase
        .from("issues")
        .select("*")
        .eq("category", issue.category);

      if (scError) throw scError;

      const duplicates = (sameCategory || []).filter((i: any) => {
        if (i.id === id) return false;
        const dist = getDistanceMeters(issue.lat, issue.lng, i.lat, i.lng);
        return dist <= 100;
      });

      res.json(duplicates);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 2. POST /api/issues — create issue, run AI categorization, detect duplicates, log created event
  app.post("/api/issues", async (req, res) => {
    const currentUser = (req as any).user;
    const { title, description, category, lat, lng, address, image_url, media_type, location_source } = req.body;

    if (!title || !lat || !lng || !category) {
      return res.status(400).json({ error: "Missing required fields (title, lat, lng, category)" });
    }

    // Server-side audit logging for submitted location
    const finalSource = location_source || "default_fallback";
    console.log("==================================================");
    console.log("SERVER LOCATION AUDIT - NEW COMPLAINT RECORDED:");
    console.log(`Title:           "${title}"`);
    console.log(`Latitude:        ${lat}`);
    console.log(`Longitude:       ${lng}`);
    console.log(`Address:         "${address || ""}"`);
    console.log(`Location Source: "${finalSource}"`);
    console.log("==================================================");

    try {
      const supabase = getSupabase();
      const issueId = "issue_" + Math.random().toString(36).substring(2, 9);
      const reporterId = currentUser ? currentUser.id : "u1";

      // Call Gemini AI for categorization validation/enrichment if API key is active
      let aiCategory = category;
      let aiConfidence = 0.85;
      let aiRaw = {};

      if (ai) {
        try {
          const prompt = `Classify this user-reported civic issue in an Indian city.
Title: "${title}"
Description: "${description || "No description provided."}"
User-Selected Category: "${category}"

Analyze the content and categorize it into one of the following standard bins:
- pothole
- garbage
- water_leakage
- streetlight
- drain
- other

Return ONLY a valid JSON string containing:
{
  "category": "pothole | garbage | water_leakage | streetlight | drain | other",
  "confidence": <float confidence score between 0.0 and 1.0>,
  "reasoning": "<short sentence describing why this category matches best>"
}`;

          const aiResponse = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
              responseMimeType: "application/json",
            },
          });

          const text = aiResponse.text?.trim() || "{}";
          const result = JSON.parse(text);
          if (result.category) {
            aiCategory = result.category;
            aiConfidence = result.confidence || 0.9;
            aiRaw = result;
          }
        } catch (err) {
          console.warn("Gemini auto-categorization failed or was offline:", err);
        }
      }

      // Duplicate detection - within 100m, same category
      const { data: sameCategoryIssues, error: scError } = await supabase
        .from("issues")
        .select("*")
        .eq("category", category)
        .neq("status", "rejected");

      if (scError) throw scError;

      const nearbySameCategory = (sameCategoryIssues || []).filter((i: any) => {
        const d = getDistanceMeters(parseFloat(lat), parseFloat(lng), i.lat, i.lng);
        return d <= 100;
      });

      const isDuplicateOf = nearbySameCategory.length > 0 ? nearbySameCategory[0].id : null;

      const newIssue: Issue = {
        id: issueId,
        title,
        description: description || "",
        category: category,
        status: "reported",
        lat: parseFloat(lat),
        lng: parseFloat(lng),
        address: address || "Location in Indian City",
        image_url: image_url || "",
        media_type: media_type === "video" ? "video" : "image",
        reporter_id: reporterId,
        verification_count: 0,
        ai_category: aiCategory,
        ai_confidence: aiConfidence,
        ai_raw: JSON.stringify(aiRaw),
        duplicate_of: isDuplicateOf,
        agent_analysis: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { error: insertIssueError } = await supabase
        .from("issues")
        .insert(newIssue);

      if (insertIssueError) throw insertIssueError;

      // Save Timeline event
      const { error: insertEventError } = await supabase
        .from("issue_events")
        .insert({
          id: "ev_" + Math.random().toString(36).substring(2, 9),
          issue_id: issueId,
          user_id: reporterId,
          type: "created",
          payload: { title, duplicate_of: isDuplicateOf },
          created_at: new Date().toISOString(),
        });

      if (insertEventError) throw insertEventError;

      res.json({ success: true, issue: newIssue });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 3. PATCH /api/issues/[id] — admin status update, logs status_changed event
  app.patch("/api/issues/:id", async (req, res) => {
    const currentUser = (req as any).user;
    const { id } = req.params;
    const { status, resolution_note, resolution_image_url } = req.body;

    try {
      const authHeader = req.headers.authorization;
      const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.substring(7) : undefined;
      const supabase = getSupabase(token);
      const { data: issue, error: fetchError } = await supabase
        .from("issues")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (fetchError) throw fetchError;
      if (!issue) {
        return res.status(404).json({ error: "Issue not found" });
      }

      if (!currentUser || currentUser.role !== "admin") {
        return res.status(403).json({ error: "Forbidden. Admin authorization required." });
      }

      if (status === "resolved" && !resolution_note) {
        return res.status(400).json({ error: "A resolution note is required when marking an issue as resolved." });
      }

      const oldStatus = issue.status;
      const updateFields: any = { status, updated_at: new Date().toISOString() };

      const { error: updateError } = await supabase
        .from("issues")
        .update(updateFields)
        .eq("id", id);

      if (updateError) throw updateError;

      // Log status changed event
      const { error: eventError } = await supabase
        .from("issue_events")
        .insert({
          id: "ev_" + Math.random().toString(36).substring(2, 9),
          issue_id: id,
          user_id: currentUser.id,
          type: "status_changed",
          payload: { old: oldStatus, new: status, resolution_note: resolution_note || null, resolution_image_url: resolution_image_url || null },
          created_at: new Date().toISOString(),
        });

      if (eventError) throw eventError;

      res.json({ success: true, issue: { ...issue, ...updateFields } });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 4. POST /api/issues/[id]/verify — toggle verify/unverify, blocks own issue, logs event
  app.post("/api/issues/:id/verify", async (req, res) => {
    const currentUser = (req as any).user;
    const { id } = req.params;
    try {
      const supabase = getSupabase();
      const { data: issue, error: fetchError } = await supabase
        .from("issues")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (fetchError) throw fetchError;
      if (!issue) {
        return res.status(404).json({ error: "Issue not found" });
      }

      if (!currentUser) {
        return res.status(401).json({ error: "Please log in to verify issues." });
      }

      if (issue.reporter_id === currentUser.id) {
        return res.status(400).json({ error: "You cannot verify your own reported issue!" });
      }

      // Check if verification already exists
      const { data: existingVerification, error: evError } = await supabase
        .from("verifications")
        .select("*")
        .eq("issue_id", id)
        .eq("user_id", currentUser.id)
        .maybeSingle();

      if (evError) throw evError;

      let verified = false;
      if (existingVerification) {
        // Unverify
        const { error: deleteError } = await supabase
          .from("verifications")
          .delete()
          .eq("id", existingVerification.id);

        if (deleteError) throw deleteError;
        verified = false;

        // Add timeline event
        const { error: eventError } = await supabase
          .from("issue_events")
          .insert({
            id: "ev_" + Math.random().toString(36).substring(2, 9),
            issue_id: id,
            user_id: currentUser.id,
            type: "unverified",
            payload: { user_name: currentUser.name },
            created_at: new Date().toISOString(),
          });

        if (eventError) throw eventError;
      } else {
        // Verify
        const { error: insertError } = await supabase
          .from("verifications")
          .insert({
            id: "v_" + Math.random().toString(36).substring(2, 9),
            issue_id: id,
            user_id: currentUser.id,
            created_at: new Date().toISOString(),
          });

        if (insertError) throw insertError;
        verified = true;

        // Add timeline event
        const { error: eventError } = await supabase
          .from("issue_events")
          .insert({
            id: "ev_" + Math.random().toString(36).substring(2, 9),
            issue_id: id,
            user_id: currentUser.id,
            type: "verified",
            payload: { user_name: currentUser.name },
            created_at: new Date().toISOString(),
          });

        if (eventError) throw eventError;
      }

      // Sync verification count
      const { data: verifications, error: countError } = await supabase
        .from("verifications")
        .select("id")
        .eq("issue_id", id);

      if (countError) throw countError;
      const verification_count = verifications ? verifications.length : 0;

      const { error: updateError } = await supabase
        .from("issues")
        .update({
          verification_count,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (updateError) throw updateError;

      res.json({ success: true, verified, verification_count });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/issues/:id/comment - add user comment
  app.post("/api/issues/:id/comment", async (req, res) => {
    const currentUser = (req as any).user;
    const { id } = req.params;
    const { comment } = req.body;

    try {
      const supabase = getSupabase();
      const { data: issue, error: fetchError } = await supabase
        .from("issues")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (fetchError) throw fetchError;
      if (!issue) {
        return res.status(404).json({ error: "Issue not found" });
      }

      if (!currentUser) {
        return res.status(401).json({ error: "Please log in to leave a comment." });
      }

      const { error: eventError } = await supabase
        .from("issue_events")
        .insert({
          id: "ev_" + Math.random().toString(36).substring(2, 9),
          issue_id: id,
          user_id: currentUser.id,
          type: "comment",
          payload: { comment },
          created_at: new Date().toISOString(),
        });

      if (eventError) throw eventError;

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 5. POST /api/agent/analyze — runs 5-step agent, saves agent_analysis to issue
  app.post("/api/agent/analyze", async (req, res) => {
    const currentUser = (req as any).user;
    if (!currentUser || currentUser.role !== "admin") {
      return res.status(403).json({ error: "Forbidden. Admin authorization required." });
    }

    const { issue_id } = req.body;
    if (!issue_id) {
      return res.status(400).json({ error: "Missing issue_id" });
    }

    try {
      const authHeader = req.headers.authorization;
      const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.substring(7) : undefined;
      const supabase = getSupabase(token);
      const { data: issue, error: fetchError } = await supabase
        .from("issues")
        .select("*")
        .eq("id", issue_id)
        .maybeSingle();

      if (fetchError) throw fetchError;
      if (!issue) {
        return res.status(404).json({ error: "Issue not found" });
      }

      const stepsTrace: { step: string; name: string; input: any; output: any; duration_ms: number }[] = [];

      // Step 1: get_issue
      const start1 = Date.now();
      const step1Input = { id: issue_id };
      const step1Output = `Successfully fetched issue details. Category: ${issue.category}, Status: ${issue.status}, Lat/Lng: (${issue.lat}, ${issue.lng}).`;
      stepsTrace.push({
        step: "1",
        name: "get_issue",
        input: step1Input,
        output: step1Output,
        duration_ms: Date.now() - start1 || 10,
      });

      // Step 2: check_area_history — find nearby same-category issues in 500m/6 months via geo query
      const start2 = Date.now();
      const step2Input = { lat: issue.lat, lng: issue.lng, category: issue.category, radius_meters: 500 };

      const { data: allSameCategory, error: scError } = await supabase
        .from("issues")
        .select("*")
        .eq("category", issue.category);

      if (scError) throw scError;

      const nearbyHistoric = (allSameCategory || []).filter((i: any) => {
        if (i.id === issue_id) return false;
        const d = getDistanceMeters(issue.lat, issue.lng, i.lat, i.lng);
        return d <= 500;
      });

      const step2Output = {
        nearby_count_500m: nearbyHistoric.length,
        resolved_count: nearbyHistoric.filter((i: any) => i.status === "resolved").length,
        reported_count: nearbyHistoric.filter((i: any) => i.status === "reported").length,
        message: `Found ${nearbyHistoric.length} nearby historic issues of the same category within a 500m radius.`,
      };
      stepsTrace.push({
        step: "2",
        name: "check_area_history",
        input: step2Input,
        output: step2Output,
        duration_ms: Date.now() - start2 || 35,
      });

      // Step 3: assess_community_urgency — compute urgency score from verifications + days open + area trend
      const start3 = Date.now();
      const creationDate = new Date(issue.created_at);
      const daysOpen = Math.max(1, Math.ceil((Date.now() - creationDate.getTime()) / (1000 * 60 * 60 * 24)));
      const verificationsCount = issue.verification_count || 0;
      const historyDensity = nearbyHistoric.length;

      // Urgency Score logic
      const urgencyScore = Math.min(
        100,
        Math.round((verificationsCount * 5) + (daysOpen * 2) + (historyDensity * 4) + (issue.image_url ? 10 : 0))
      );

      const step3Input = { verifications: verificationsCount, days_open: daysOpen, nearby_trend_density: historyDensity };
      const step3Output = {
        calculated_urgency_score: urgencyScore,
        factors: {
          verification_weight: verificationsCount * 5,
          days_open_weight: daysOpen * 2,
          area_trend_weight: historyDensity * 4,
          media_attachment_bonus: issue.image_url ? 10 : 0,
        },
        status: urgencyScore > 50 ? "Urgent Priority Action Advised" : "Standard Priority Track",
      };
      stepsTrace.push({
        step: "3",
        name: "assess_community_urgency",
        input: step3Input,
        output: step3Output,
        duration_ms: Date.now() - start3 || 25,
      });

      // LLM Assessment (Step 4 & 5)
      let severity: "low" | "medium" | "high" | "critical" =
        urgencyScore > 75 ? "critical" : urgencyScore > 45 ? "high" : urgencyScore > 20 ? "medium" : "low";
      let department = "Municipal Corporation Grievance Redressal Cell";
      let estDays = 3;
      let steps: string[] = ["Inspect the location", "Deploy municipal cleanup crew", "Notify reporter on completion"];
      let publicMessage = "We have escalated this issue to our urban works wing. Resolution plan generated.";

      if (ai) {
        try {
          const cleanAndParseJSON = (text: string) => {
            let cleaned = text.trim();
            if (cleaned.startsWith("```")) {
              cleaned = cleaned.replace(/^```(?:json)?\n/, "");
              cleaned = cleaned.replace(/\n```$/, "");
              cleaned = cleaned.trim();
            }
            return JSON.parse(cleaned);
          };

          // Step 4: analyze_severity
          const start4 = Date.now();
          const severityPrompt = `Analyze the severity of this civic issue in an Indian city:
Title: "${issue.title}"
Description: "${issue.description}"
Category: "${issue.category}"
Urgency Score: ${urgencyScore}/100
Verifications: ${verificationsCount}

Classify severity into low, medium, high, or critical.`;
          const aiResponse4 = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: severityPrompt,
            config: { 
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  severity: {
                    type: Type.STRING,
                    description: "Severity level: low, medium, high, or critical",
                  },
                  reasoning: {
                    type: Type.STRING,
                    description: "Short explanation of the severity decision",
                  }
                },
                required: ["severity", "reasoning"]
              }
            },
          });

          const result4 = cleanAndParseJSON(aiResponse4.text || "{}");
          if (result4.severity) {
            severity = result4.severity;
          }

          stepsTrace.push({
            step: "4",
            name: "analyze_severity",
            input: { title: issue.title, urgencyScore },
            output: result4,
            duration_ms: Date.now() - start4,
          });

          // Step 5: generate_resolution_plan
          const start5 = Date.now();
          const planPrompt = `Develop a precise municipal resolution plan for:
Title: "${issue.title}"
Category: "${issue.category}"
Severity Assessment: "${severity}"
Address: "${issue.address}"`;
          const aiResponse5 = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: planPrompt,
            config: { 
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  department: {
                    type: Type.STRING,
                    description: "Indian municipal equivalent, e.g., BBMP Solid Waste Management, BWSSB Water Works, BESCOM Electricals, MCD Road Wing, etc.",
                  },
                  priority: {
                    type: Type.STRING,
                    description: "Priority rating: low, medium, high, critical",
                  },
                  estimated_days: {
                    type: Type.INTEGER,
                    description: "Estimated days to resolve",
                  },
                  steps: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.STRING
                    },
                    description: "3-4 actionable steps"
                  },
                  public_message: {
                    type: Type.STRING,
                    description: "Reassuring, professional bilingual or English civic message"
                  }
                },
                required: ["department", "priority", "estimated_days", "steps", "public_message"]
              }
            },
          });

          const result5 = cleanAndParseJSON(aiResponse5.text || "{}");
          if (result5.department) {
            department = result5.department;
            estDays = result5.estimated_days || 3;
            steps = result5.steps || steps;
            publicMessage = result5.public_message || publicMessage;
          }

          stepsTrace.push({
            step: "5",
            name: "generate_resolution_plan",
            input: { severity, category: issue.category },
            output: result5,
            duration_ms: Date.now() - start5,
          });
        } catch (err) {
          console.warn("AI execution in Agent failed, using smart heuristic fallback:", err);
          // Fallback traces
          stepsTrace.push({
            step: "4",
            name: "analyze_severity",
            input: { title: issue.title, urgencyScore },
            output: { severity, reasoning: "Heuristic categorization based on urgency score of " + urgencyScore },
            duration_ms: 15,
          });
          stepsTrace.push({
            step: "5",
            name: "generate_resolution_plan",
            input: { severity },
            output: { department, priority: severity, estimated_days: estDays, steps, public_message: publicMessage },
            duration_ms: 20,
          });
        }
      } else {
        // Offline/Local mock agent execution
        // Step 4
        const start4 = Date.now();
        stepsTrace.push({
          step: "4",
          name: "analyze_severity",
          input: { title: issue.title, urgencyScore },
          output: {
            severity,
            reasoning: `Categorized as ${severity} severity based on high citizen response of ${verificationsCount} verifications and duration of ${daysOpen} days open.`,
          },
          duration_ms: Date.now() - start4 || 20,
        });

        // Step 5
        const start5 = Date.now();
        // Heuristic department picker
        if (issue.category === "garbage") {
          department = "Solid Waste Management Division (BBMP/MCD/BMC)";
          estDays = 2;
          steps = [
            "Deploy sanitation wing crew to inspect the site and clear garbage mounds.",
            "Dispatch compactor/dumper trucks for full disposal of accumulated rubbish.",
            "Install warning sign boards regarding penalty for unauthorized public dumping.",
            "Notify resident community group once lane is fully sanitised.",
          ];
          publicMessage =
            "Sanitation Division has listed this lane for primary morning clearance. A crew is being dispatched with a garbage compactor to completely clear the pile and clean the site.";
        } else if (issue.category === "pothole") {
          department = "Roads & Highways Engineering Department (PWD)";
          estDays = 4;
          steps = [
            "Cordon off the broken road lane with safety markers.",
            "Excavate the loose road gravel and level base foundation.",
            "Lay hot asphalt mix and steamroll for flat surfacing.",
            "Perform quality check and restore traffic signals.",
          ];
          publicMessage =
            "PWD Road Repair wing has generated an inspection ticket. Repair crews will fill the pothole during night hours to avoid traffic disruption.";
        } else if (issue.category === "water_leakage") {
          department = "Water Supply & Sewerage Board (BWSSB/DJB)";
          estDays = 3;
          steps = [
            "Shut down local water main valves to stop leakage.",
            "Excavate the pipeline junction and identify structural fractures.",
            "Weld/replace the burst high-density pipe joint.",
            "Re-pressurize system and backfill asphalt.",
          ];
          publicMessage =
            "Sewerage & Water works crew is dispatched to repair the pipe fracture. Water supply will be restored to normalcy on completion.";
        } else if (issue.category === "streetlight") {
          department = "Municipal Electrical Infrastructure Division";
          estDays = 2;
          steps = [
            "Inspect junction box and wiring circuits near MG Road.",
            "Replace fused high-intensity sodium bulb with eco-friendly LED.",
            "Reset automated timer switches in substation.",
            "Ensure safety certification for damp wire conduits.",
          ];
          publicMessage =
            "Electrical repairs crew has scheduled a bulb-swap and line circuit diagnostic on this block. Grid light should be active by tomorrow night.";
        } else {
          department = "General Municipal Grievance Action Cell";
          estDays = 5;
          steps = [
            "Direct request details to respective local ward engineer.",
            "Conduct site feasibility survey and draw up materials cost.",
            "Execute local grievance repair and close ticket.",
          ];
        }

        stepsTrace.push({
          step: "5",
          name: "generate_resolution_plan",
          input: { severity, category: issue.category },
          output: {
            department,
            priority: severity,
            estimated_days: estDays,
            steps,
            public_message: publicMessage,
          },
          duration_ms: Date.now() - start5 || 30,
        });
      }

      const agentAnalysisResult = {
        steps: stepsTrace,
        urgency_score: urgencyScore,
        severity,
        resolution_plan: {
          department,
          priority: severity,
          estimated_days: estDays,
          steps,
          public_message: publicMessage,
        },
      };

      // Auto progress status to in_progress upon agent run!
      let newStatus = issue.status;
      if (issue.status === "reported") {
        newStatus = "in_progress";
        // Insert timeline event for status changed
        const { error: eventError } = await supabase
          .from("issue_events")
          .insert({
            id: "ev_" + Math.random().toString(36).substring(2, 9),
            issue_id: issue_id,
            user_id: currentUser ? currentUser.id : "admin",
            type: "status_changed",
            payload: { old: "reported", new: "in_progress", trigger: "AI Agent Analysis Plan" },
            created_at: new Date().toISOString(),
          });
        if (eventError) throw eventError;
      }

      // Save agent_analysis to issues table in Supabase
      const { error: updateError } = await supabase
        .from("issues")
        .update({
          agent_analysis: agentAnalysisResult,
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", issue_id);

      if (updateError) throw updateError;

      res.json({ success: true, agent_analysis: agentAnalysisResult, status: newStatus });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 6. GET /api/dashboard/stats — aggregate stats for charts & leaderboard
  app.get("/api/dashboard/stats", async (req, res) => {
    try {
      const supabase = getSupabase();

      // Fetch all required tables
      const { data: issues, error: issuesError } = await supabase.from("issues").select("*");
      const { data: profiles, error: profilesError } = await supabase.from("profiles").select("*");
      const { data: verifications, error: verificationsError } = await supabase.from("verifications").select("*");

      if (issuesError) throw issuesError;
      if (profilesError) throw profilesError;
      if (verificationsError) throw verificationsError;

      const safeIssues = issues || [];
      const safeProfiles = profiles || [];
      const safeVerifications = verifications || [];

      // 1. Issues by Category
      const categoriesList = ["pothole", "garbage", "water_leakage", "streetlight", "drain", "other"];
      const issuesByCategory = categoriesList.map((cat) => {
        return {
          category: cat,
          count: safeIssues.filter((i: any) => i.category === cat).length,
        };
      });

      // 2. Status Breakdown
      const statusList = ["reported", "verified", "in_progress", "resolved", "rejected"];
      const statusBreakdown = statusList.map((st) => {
        return {
          status: st,
          count: safeIssues.filter((i: any) => i.status === st).length,
        };
      });

      // 3. Leaderboard
      const leaderboard = safeProfiles.map((p: any) => {
        const reports = safeIssues.filter((i: any) => i.reporter_id === p.id);
        const reportsCount = reports.length;
        const verificationsGiven = safeVerifications.filter((v: any) => v.user_id === p.id).length;

        let verificationsReceived = 0;
        let resolvedCount = 0;
        for (const iss of reports) {
          verificationsReceived += safeVerifications.filter((v: any) => v.issue_id === iss.id).length;
          if (iss.status === "resolved") {
            resolvedCount += 1;
          }
        }

        const points = (reportsCount * 10) + (verificationsGiven * 5) + (verificationsReceived * 2) + (resolvedCount * 20);

        // Simple Badge logic
        let badge = "Civic Novice";
        if (points >= 100) badge = "Civic Legend 👑";
        else if (points >= 60) badge = "Hyperlocal Warrior 🛡️";
        else if (points >= 30) badge = "Community Guardian 🌟";
        else if (points >= 15) badge = "Active Helper 🤝";

        return {
          id: p.id,
          name: p.name,
          role: p.role,
          points,
          badge,
          stats: {
            reported: reportsCount,
            verified_given: verificationsGiven,
            verified_received: verificationsReceived,
            resolved: resolvedCount,
          },
        };
      });

      // Sort Leaderboard by points descending
      leaderboard.sort((a: any, b: any) => b.points - a.points);

      res.json({
        issuesByCategory,
        statusBreakdown,
        leaderboard,
        totals: {
          total_reported: safeIssues.length,
          total_resolved: safeIssues.filter((i: any) => i.status === "resolved").length,
          total_verifications: safeVerifications.length,
          total_citizens: safeProfiles.filter((p: any) => p.role === "citizen").length,
        },
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // In-memory cache for insights (1 hour TTL)
  let insightsCache: { data: any; expires_at: number } | null = null;
  const INSIGHTS_TTL_MS = 24 * 60 * 60 * 1000;

  // 7. GET /api/insights — AI-powered predictive analytics
  app.get("/api/insights", async (req, res) => {
    const forceRefresh = req.query.refresh === "1";
    if (!forceRefresh && insightsCache && Date.now() < insightsCache.expires_at) {
      return res.json(insightsCache.data);
    }
    try {
      const supabase = getSupabase();
      const { data: issues, error } = await supabase.from("issues").select("*");
      if (error) throw error;
      const safeIssues: any[] = issues || [];

      const categories = ["pothole", "garbage", "water_leakage", "streetlight", "drain", "other"];
      const now = new Date();

      // Category breakdown
      const categoryStats = categories.map(cat => {
        const catIssues = safeIssues.filter(i => i.category === cat);
        const resolved = catIssues.filter(i => i.status === "resolved");
        const times = resolved
          .filter(i => i.created_at && i.updated_at)
          .map(i => (new Date(i.updated_at).getTime() - new Date(i.created_at).getTime()) / 86400000);
        return {
          category: cat,
          total: catIssues.length,
          resolved: resolved.length,
          unresolved: catIssues.filter(i => !["resolved", "rejected"].includes(i.status)).length,
          avg_resolution_days: times.length ? Math.round((times.reduce((a, b) => a + b, 0) / times.length) * 10) / 10 : null,
        };
      });

      // Weekly trend (last 4 weeks)
      const weeklyTrend = Array.from({ length: 4 }, (_, idx) => {
        const wStart = new Date(now); wStart.setDate(wStart.getDate() - (4 - idx) * 7);
        const wEnd = new Date(now); wEnd.setDate(wEnd.getDate() - (3 - idx) * 7);
        const wIssues = safeIssues.filter(i => { const d = new Date(i.created_at); return d >= wStart && d < wEnd; });
        const counts: any = { label: `W${idx + 1}`, total: wIssues.length };
        categories.forEach(cat => { counts[cat] = wIssues.filter(i => i.category === cat).length; });
        return counts;
      });

      // Geographic hotspots (0.05° grid)
      const grid: Record<string, { lat: number; lng: number; count: number; cats: Record<string, number> }> = {};
      safeIssues
        .filter(i => !["resolved", "rejected"].includes(i.status) && i.lat && i.lng)
        .forEach(i => {
          const key = `${(Math.round(i.lat / 0.05) * 0.05).toFixed(2)},${(Math.round(i.lng / 0.05) * 0.05).toFixed(2)}`;
          if (!grid[key]) grid[key] = { lat: Math.round(i.lat / 0.05) * 0.05, lng: Math.round(i.lng / 0.05) * 0.05, count: 0, cats: {} };
          grid[key].count++;
          grid[key].cats[i.category] = (grid[key].cats[i.category] || 0) + 1;
        });
      const hotspots = Object.values(grid)
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)
        .map(h => ({ lat: h.lat, lng: h.lng, count: h.count, topCategory: Object.entries(h.cats).sort(([, a], [, b]) => (b as number) - (a as number))[0]?.[0] || "unknown" }));

      const stats = { totalIssues: safeIssues.length, categoryStats, weeklyTrend, hotspots };

      if (!ai) return res.status(503).json({ error: "AI not configured" });

      const prompt = `You are a senior urban analytics advisor for a civic issue tracking platform in India. Write like a trusted analyst briefing a municipal commissioner — clear, professional, evidence-backed. No jargon, no raw data dumps.

Data:
${JSON.stringify(stats)}

Return ONLY valid JSON (no markdown, no extra text) with this exact structure:
{
  "health_score": <integer 0-100, higher = healthier community>,
  "narrative": "<3-4 sentence executive summary written in plain English. Cite specific numbers naturally in prose — e.g. 'Six of the eight reported issues are potholes, and five remain unresolved.' Do NOT use field names like 'W4' or 'category'. Write as if briefing a non-technical official.>",
  "predictions": [
    {
      "category": "<category name>",
      "trend": "increasing|stable|decreasing",
      "urgency": "low|medium|high|critical",
      "headline": "<8-10 word headline for this prediction, e.g. 'Pothole complaints expected to rise sharply this month'>",
      "explanation": "<2-3 sentence human-readable explanation. Start with 'Based on...' or 'Our analysis shows...'. Cite evidence naturally, e.g. 'Based on 6 new reports in the past week with only 1 resolved, road damage is accumulating faster than it is being addressed.' Never expose raw field names.>",
      "suggested_action": "<One concrete action the admin should take, written as a direct instruction e.g. 'Deploy road repair crews to the northern cluster within 48 hours.'>"
    }
  ],
  "risk_areas": [
    {
      "area_label": "<Human-readable area name e.g. 'Northern residential zone' or 'Sector 4 junction area'>",
      "issue_count": <N>,
      "dominant_category": "<category>",
      "risk_narrative": "<1-2 sentences explaining why this area is at risk in plain language>",
      "recommended_action": "<Direct instruction for admin>"
    }
  ],
  "key_actions": [
    { "priority": "immediate|this_week|this_month", "action": "<Direct, specific admin action in plain language>" }
  ]
}`;

      let aiResult = null;
      let aiError = null;
      try {
        const result = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: [{ role: "user", parts: [{ text: prompt }] }],
        });
        let raw = result.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
        raw = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        aiResult = JSON.parse(raw);
      } catch (aiErr: any) {
        // If Gemini fails, return stale cache if available
        if (insightsCache) {
          return res.json({ ...insightsCache.data, stale: true, ai_error: "AI quota exceeded — showing cached insights." });
        }
        aiError = aiErr.message?.includes("429") || aiErr.message?.includes("quota")
          ? "AI quota exceeded for today. Stats shown without predictions."
          : `AI error: ${aiErr.message}`;
      }

      const payload = { stats, ai: aiResult, generated_at: new Date().toISOString(), ai_error: aiError };
      if (aiResult) insightsCache = { data: payload, expires_at: Date.now() + INSIGHTS_TTL_MS };
      res.json(payload);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Vite integration
  const uploadsPath = path.join(process.cwd(), "dist", "uploads");
  if (!fs.existsSync(uploadsPath)) {
    fs.mkdirSync(uploadsPath, { recursive: true });
  }
  app.use("/uploads", express.static(uploadsPath));

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Attempt to lazily check & seed database schema on startup
  try {
    let supabase = getSupabase();
    if (!useLocalMockDB) {
      // Test if the profiles table actually exists
      const { error } = await supabase.from("profiles").select("id").limit(1);
      if (error) {
        // Only switch to mock DB if the schema doesn't exist (structural database errors like 42P01)
        const isTableMissing = error.code === "42P01" || error.message?.toLowerCase().includes("relation") || error.message?.toLowerCase().includes("does not exist");
        if (isTableMissing) {
          console.warn("Supabase profiles table query returned schema missing. Activating high-reliability local fallback DB:", error.message);
          useLocalMockDB = true;
          supabase = getSupabase(); // Get the mock supabase client
        } else {
          console.warn("Transient/network connection issue with Supabase on startup. Continuing to use real client. Error:", error.message);
        }
      }
    }
    
    // Seed database if empty (whether mock or real)
    await seedSupabaseIfEmpty(supabase);

    if (useLocalMockDB) {
      console.log("High-reliability local fallback database activated and seeded.");
    } else {
      console.log("Real Supabase connected and database queried successfully.");
      // Ensure issue-media storage bucket exists
      try {
        const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
        if (bucketError) {
          console.warn("Could not list buckets:", bucketError);
        } else if (buckets && !buckets.some((b: any) => b.id === "issue-media")) {
          const { error: createError } = await supabase.storage.createBucket("issue-media", {
            public: true,
            allowedMimeTypes: ["image/*", "video/*"],
            fileSizeLimit: 52428800 // 50MB
          });
          if (createError) {
            console.error("Failed to create issue-media bucket:", createError);
          } else {
            console.log("Successfully created issue-media bucket.");
          }
        } else {
          console.log("issue-media bucket already exists.");
        }
      } catch (bucketEx: any) {
        console.error("Exception checking/creating issue-media bucket:", bucketEx.message);
      }
    }
  } catch (err: any) {
    console.warn("Database startup check failed with exception. Retrying database calls with real client. Exception:", err.message);
    try {
      const supabase = getSupabase();
      await seedSupabaseIfEmpty(supabase);
    } catch (seedErr: any) {
      console.error("Failed to seed fallback DB:", seedErr.message);
    }
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Community Hero custom server running on http://localhost:${PORT}`);
  });
}

startServer();
