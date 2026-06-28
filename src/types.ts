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

export interface IssueEvent {
  id: string;
  issue_id: string;
  user_id: string;
  type: "created" | "status_changed" | "verified" | "unverified" | "comment";
  payload: any;
  created_at: string;
  user_name: string;
  user_role: string;
}

export interface LeaderboardUser {
  id: string;
  name: string;
  role: "citizen" | "admin";
  points: number;
  badge: string;
  stats: {
    reported: number;
    verified_given: number;
    verified_received: number;
    resolved: number;
  };
}

export interface DashboardStats {
  issuesByCategory: { category: string; count: number }[];
  statusBreakdown: { status: string; count: number }[];
  leaderboard: LeaderboardUser[];
  totals: {
    total_reported: number;
    total_resolved: number;
    total_verifications: number;
    total_citizens: number;
  };
}
