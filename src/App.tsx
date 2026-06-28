import React, { useState, useEffect } from "react";
import {
  MapPin,
  AlertTriangle,
  CheckCircle,
  Clock,
  User,
  Shield,
  Plus,
  Filter,
  TrendingUp,
  Award,
  Users,
  Search,
  ChevronRight,
  ExternalLink,
  ThumbsUp,
  MessageSquare,
  Sparkles,
  BarChart2,
  List,
  Map as MapIcon,
  Play,
  RotateCcw,
  Check,
  AlertCircle,
  Video,
  Image as ImageIcon,
  ChevronLeft,
  Menu,
  X,
  Layers,
  Navigation,
  Eye,
  EyeOff,
  Camera
} from "lucide-react";
import { Issue, Profile, IssueEvent, LeaderboardUser, DashboardStats } from "./types";
import { APIProvider, Map, AdvancedMarker, InfoWindow } from "@vis.gl/react-google-maps";
import { Circle } from "./components/Circle";

const GOOGLE_MAPS_API_KEY =
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
  (import.meta as any).env?.VITE_GOOGLE_MAPS_PLATFORM_KEY ||
  process.env.GOOGLE_MAPS_PLATFORM_KEY ||
  "";

const DARK_MAP_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#0f172a" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0f172a" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#94a3b8" }] },
  {
    featureType: "administrative.locality",
    elementType: "labels.text.fill",
    stylers: [{ color: "#cbd5e1" }],
  },
  {
    featureType: "poi",
    elementType: "labels.text.fill",
    stylers: [{ color: "#cbd5e1" }],
  },
  {
    featureType: "poi.park",
    elementType: "geometry",
    stylers: [{ color: "#1e293b" }],
  },
  {
    featureType: "poi.park",
    elementType: "labels.text.fill",
    stylers: [{ color: "#475569" }],
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#1e293b" }],
  },
  {
    featureType: "road",
    elementType: "geometry.stroke",
    stylers: [{ color: "#0f172a" }],
  },
  {
    featureType: "road",
    elementType: "labels.text.fill",
    stylers: [{ color: "#94a3b8" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#334155" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry.stroke",
    stylers: [{ color: "#0f172a" }],
  },
  {
    featureType: "road.highway",
    elementType: "labels.text.fill",
    stylers: [{ color: "#e2e8f0" }],
  },
  {
    featureType: "transit",
    elementType: "geometry",
    stylers: [{ color: "#0f172a" }]
  },
  {
    featureType: "transit.station",
    elementType: "labels.text.fill",
    stylers: [{ color: "#cbd5e1" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#1e293b" }],
  },
  {
    featureType: "water",
    elementType: "labels.text.fill",
    stylers: [{ color: "#475569" }],
  },
  {
    featureType: "water",
    elementType: "labels.text.stroke",
    stylers: [{ color: "#0f172a" }],
  },
];

// Standard Unsplash presets for beautiful civic issue photos
const UNSPLASH_PRESETS = [
  { name: "Pothole standard", url: "https://images.unsplash.com/photo-1515162305285-0293e4767cc2?auto=format&fit=crop&w=600&q=80" },
  { name: "Garbage mound", url: "https://images.unsplash.com/photo-1611284446314-60a58ac0deb9?auto=format&fit=crop&w=600&q=80" },
  { name: "Water flooding", url: "https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=600&q=80" },
  { name: "Dark streetlight", url: "https://images.unsplash.com/photo-1509099836639-18ba1795216d?auto=format&fit=crop&w=600&q=80" },
  { name: "Broken drain", url: "https://images.unsplash.com/photo-1541888946425-d81bb19240f5?auto=format&fit=crop&w=600&q=80" }
];

export default function App() {
  const hasValidKey = Boolean(GOOGLE_MAPS_API_KEY) && GOOGLE_MAPS_API_KEY !== "YOUR_API_KEY" && GOOGLE_MAPS_API_KEY.trim() !== "";

  // Navigation tabs
  const [activeTab, setActiveTab] = useState<"home" | "map" | "report" | "issues" | "dashboard" | "reports" | "admin">("home");
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [postLoginAction, setPostLoginAction] = useState<{ type: "report" | "verify" | "tab"; data?: any } | null>(null);

  // Authentication State
  const [user, setUser] = useState<Profile | null>(null);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [authName, setAuthName] = useState("");
  const [authError, setAuthError] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);

  // Issue States
  const [issues, setIssues] = useState<Issue[]>([]);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [timeline, setTimeline] = useState<(IssueEvent & { user_name: string; user_role: string })[]>([]);
  const [loadingIssueId, setLoadingIssueId] = useState<string | null>(null);

  // New Issue Form States
  const [showReportModal, setShowReportModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newCategory, setNewCategory] = useState<Issue["category"]>("pothole");
  const [newLat, setNewLat] = useState(0);
  const [newLng, setNewLng] = useState(0);
  const [newAddress, setNewAddress] = useState("");
  const [newImageUrl, setNewImageUrl] = useState("");
  const [newMediaType, setNewMediaType] = useState<"image" | "video">("image");
  const [imageUploadOption, setImageUploadOption] = useState<"preset" | "url" | "file">("file");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<Issue | null>(null);

  // Mobile step states
  const [reportStep, setReportStep] = useState<1 | 2 | 3>(1);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [locationSource, setLocationSource] = useState<"gps" | "map_picker" | "default_fallback" | null>(null);
  const [showMapInline, setShowMapInline] = useState(false);

  useEffect(() => {
    if (!selectedFile) {
      setFilePreviewUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(selectedFile);
    setFilePreviewUrl(objectUrl);

    if (selectedFile.type.startsWith("video/")) {
      setNewMediaType("video");
    } else {
      setNewMediaType("image");
    }

    return () => URL.revokeObjectURL(objectUrl);
  }, [selectedFile]);

  // Filters
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [issuesView, setIssuesView] = useState<"all" | "mine">("all");
  const [adminSearch, setAdminSearch] = useState("");
  const [adminFilterCategory, setAdminFilterCategory] = useState("all");
  const [adminFilterStatus, setAdminFilterStatus] = useState("all");

  // Resolution modal state
  const [resolutionModal, setResolutionModal] = useState<{ issueId: string; pendingStatus: string } | null>(null);
  const [resolutionNote, setResolutionNote] = useState("");
  const [resolutionImageUrl, setResolutionImageUrl] = useState("");
  const [resolutionUploading, setResolutionUploading] = useState(false);

  // SLA days per category
  const SLA_DAYS: Record<string, number> = {
    pothole: 7, garbage: 3, water_leakage: 5, streetlight: 5, drain: 7, other: 10,
  };
  const getDaysOpen = (issue: Issue) => Math.floor((Date.now() - new Date(issue.created_at).getTime()) / 86400000);
  const isSlaBreached = (issue: Issue) => issue.status !== "resolved" && issue.status !== "rejected" && getDaysOpen(issue) > (SLA_DAYS[issue.category] ?? 7);
  const [searchQuery, setSearchQuery] = useState("");

  // Dashboard Stats
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [insights, setInsights] = useState<any | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);

  // Map settings
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationBlocked, setLocationBlocked] = useState(false);
  const [mapCenter, setMapCenter] = useState({ lat: 20.5937, lng: 78.9629 }); // India center fallback
  const [mapZoom, setMapZoom] = useState(5);
  const [showIssuesLayer, setShowIssuesLayer] = useState(true);
  const [showHotspotsLayer, setShowHotspotsLayer] = useState(true);
  const [showNearbyLayer, setShowNearbyLayer] = useState(false);
  const [activeMarkerId, setActiveMarkerId] = useState<string | null>(null);
  const [showLayerControl, setShowLayerControl] = useState(false);

  // Admin states
  const [agentRunningId, setAgentRunningId] = useState<string | null>(null);
  const [agentTrace, setAgentTrace] = useState<any[]>([]);
  const [agentResult, setAgentResult] = useState<any | null>(null);

  // Comment input
  const [newComment, setNewComment] = useState("");

  // Indian Cities lookup list for map focus
  const [focusedCity, setFocusedCity] = useState("Bengaluru, KA");

  // Simulated User Location Helper
  const getSimulatedUserLocation = () => {
    if (focusedCity.includes("Bengaluru")) {
      return { lat: 12.9348, lng: 77.6189 }; // Koramangala
    } else if (focusedCity.includes("Mumbai")) {
      return { lat: 19.0596, lng: 72.8826 }; // Bandra/Chembur
    } else {
      return { lat: 28.6250, lng: 77.2200 }; // Connaught Place
    }
  };

  // City Hotspots Areas Helper
  const getHotspotsForCity = () => {
    if (focusedCity.includes("Bengaluru")) {
      return [
        { id: "hs1", center: { lat: 12.9176, lng: 77.6233 }, radius: 800, color: "#f43f5e", label: "Silk Board - High Risk 🚨" },
        { id: "hs2", center: { lat: 12.9719, lng: 77.6412 }, radius: 600, color: "#f59e0b", label: "Indiranagar 12th Main - Recurring ⚠️" }
      ];
    } else if (focusedCity.includes("Mumbai")) {
      return [
        { id: "hs1", center: { lat: 19.0760, lng: 72.8777 }, radius: 1000, color: "#f43f5e", label: "Kurla Crossing - High Flood Risk 🚨" },
        { id: "hs2", center: { lat: 19.1176, lng: 72.9060 }, radius: 800, color: "#f59e0b", label: "Powai Lake Road - Pothole Zone ⚠️" }
      ];
    } else {
      return [
        { id: "hs1", center: { lat: 28.6139, lng: 77.2090 }, radius: 900, color: "#f43f5e", label: "Connaught Circle - High Congestion 🚨" },
        { id: "hs2", center: { lat: 28.5244, lng: 77.1855 }, radius: 700, color: "#f59e0b", label: "Mehrauli Bypass - Dark Streetlight Zone ⚠️" }
      ];
    }
  };

  // Smart back navigation tracking
  const [referrerTab, setReferrerTab] = useState<"home" | "map" | "report" | "issues" | "reports" | "admin">("home");

  // Load user & issues on startup
  useEffect(() => {
    fetchCurrentUser();
    fetchIssues();
    fetchStats();
    fetchInsights();
  }, []);

  // Get real GPS on mount to center the map and reverse-geocode city name
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLocation(loc);
        setMapCenter(loc);
        setMapZoom(13);
        try {
          const r = await fetch(
            `https://maps.googleapis.com/maps/api/geocode/json?latlng=${loc.lat},${loc.lng}&key=${GOOGLE_MAPS_API_KEY}&language=en&result_type=locality|sublocality`
          );
          const d = await r.json();
          if (d.status === "OK" && d.results?.length > 0) {
            const components = d.results[0].address_components || [];
            const city = components.find((c: any) => c.types.includes("locality"))?.long_name
              || components.find((c: any) => c.types.includes("sublocality"))?.long_name || "";
            const state = components.find((c: any) => c.types.includes("administrative_area_level_1"))?.short_name || "";
            if (city) setFocusedCity(`${city}${state ? ", " + state : ""}`);
          }
        } catch {
          // reverse geocode failed — keep default
        }
      },
      () => {
        // Permission denied or unavailable — leave India fallback, zoom stays at 5
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
    );
  }, []);

  const apiFetch = async (url: string, options: RequestInit = {}) => {
    const token = localStorage.getItem("sb_token");
    const headers = {
      ...options.headers,
      "Content-Type": "application/json",
      ...(token ? { "Authorization": `Bearer ${token}` } : {}),
    };
    return fetch(url, { ...options, headers });
  };

  const fetchCurrentUser = async () => {
    try {
      const response = await apiFetch("/api/auth/me");
      const data = await response.json();
      if (data.user) {
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch (err) {
      console.error(err);
      setUser(null);
    }
  };

  const fetchIssues = async () => {
    try {
      const response = await apiFetch("/api/issues");
      const data = await response.json();
      if (Array.isArray(data)) {
        setIssues(data);
      } else {
        console.error("Issues API response is not an array:", data);
        setIssues([]);
      }
    } catch (err) {
      console.error(err);
      setIssues([]);
    }
  };

  const fetchInsights = async (forceRefresh = false) => {
    setInsightsLoading(true);
    try {
      const res = await apiFetch(`/api/insights${forceRefresh ? "?refresh=1" : ""}`);
      const data = await res.json();
      if (data && !data.error) setInsights(data);
    } catch (err) {
      console.error(err);
      setInsights({ ai: null, stats: null, ai_error: "Failed to load insights." });
    } finally {
      setInsightsLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await apiFetch("/api/dashboard/stats");
      const data = await response.json();
      if (data && !data.error) {
        setStats(data);
      } else {
        console.error("Stats API response has an error or is invalid:", data);
        setStats(null);
      }
    } catch (err) {
      console.error(err);
      setStats(null);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setAuthLoading(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: authEmail, password: authPassword })
      });
      const data = await response.json();
      if (data.success) {
        localStorage.setItem("sb_token", data.session?.access_token || "");
        setUser(data.user);
        setAuthPassword("");
        setShowPassword(false);
        setShowAuthModal(false);
        fetchStats();
        fetchIssues();
        if (postLoginAction) {
          if (postLoginAction.type === "report") {
            setShowReportModal(true);
          } else if (postLoginAction.type === "verify" && postLoginAction.data?.issueId) {
            handleVerify(postLoginAction.data.issueId);
          } else if (postLoginAction.type === "tab" && postLoginAction.data?.tabName) {
            setActiveTab(postLoginAction.data.tabName);
          }
          setPostLoginAction(null);
        }
      } else {
        setAuthError(data.error || "Login failed.");
      }
    } catch (err: any) {
      setAuthError("Failed to authenticate.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    if (!authName.trim()) {
      setAuthError("Name is required");
      return;
    }
    setAuthLoading(true);
    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: authEmail, password: authPassword, name: authName })
      });
      const data = await response.json();
      if (data.success) {
        localStorage.setItem("sb_token", data.session?.access_token || "");
        setUser(data.user);
        setAuthPassword("");
        setAuthName("");
        setShowPassword(false);
        setIsRegistering(false);
        setShowAuthModal(false);
        fetchStats();
        fetchIssues();
        if (postLoginAction) {
          if (postLoginAction.type === "report") {
            setShowReportModal(true);
          } else if (postLoginAction.type === "verify" && postLoginAction.data?.issueId) {
            handleVerify(postLoginAction.data.issueId);
          } else if (postLoginAction.type === "tab" && postLoginAction.data?.tabName) {
            setActiveTab(postLoginAction.data.tabName);
          }
          setPostLoginAction(null);
        }
      } else {
        setAuthError(data.error || "Registration failed.");
      }
    } catch (err: any) {
      setAuthError("Failed to register.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
    } catch (err) {
      console.error(err);
    } finally {
      localStorage.removeItem("sb_token");
      setUser(null);
    }
  };

  const selectIssueDetail = async (id: string, fromTab: typeof referrerTab) => {
    setLoadingIssueId(id);
    setReferrerTab(fromTab);
    try {
      const response = await apiFetch(`/api/issues/${id}`);
      const data = await response.json();
      if (data.issue) {
        setSelectedIssue(data.issue);
        setTimeline(data.timeline || []);
        // Highlight on simulated map
        setMapCenter({ lat: data.issue.lat, lng: data.issue.lng });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingIssueId(null);
    }
  };

  const handleVerify = async (id: string) => {
    if (!user) {
      setPostLoginAction({ type: "verify", data: { issueId: id } });
      setShowAuthModal(true);
      return;
    }
    try {
      const response = await apiFetch(`/api/issues/${id}/verify`, {
        method: "POST"
      });
      const data = await response.json();
      if (data.success) {
        // Refresh details
        selectIssueDetail(id, referrerTab);
        fetchIssues();
        fetchStats();
      } else {
        alert(data.error || "Cannot verify issue.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedIssue || !newComment.trim()) return;

    try {
      const response = await apiFetch(`/api/issues/${selectedIssue.id}/comment`, {
        method: "POST",
        body: JSON.stringify({ comment: newComment })
      });
      const data = await response.json();
      if (data.success) {
        setNewComment("");
        selectIssueDetail(selectedIssue.id, referrerTab);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAdminStatusChange = async (issueId: string, newStatus: string, resNote?: string, resImageUrl?: string) => {
    if (!user || user.role !== "admin") {
      alert("Error: You must be logged in as an Admin to change status.");
      return;
    }
    if (newStatus === "resolved" && !resNote) {
      setResolutionModal({ issueId, pendingStatus: newStatus });
      setResolutionNote("");
      setResolutionImageUrl("");
      return;
    }
    try {
      const response = await apiFetch(`/api/issues/${issueId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus, resolution_note: resNote, resolution_image_url: resImageUrl })
      });
      const data = await response.json();
      if (data.success) {
        fetchIssues();
        fetchStats();
        if (selectedIssue && selectedIssue.id === issueId) {
          selectIssueDetail(issueId, referrerTab);
        }
      } else {
        alert("Failed to update status: " + (data.error || "Unknown server error"));
      }
    } catch (err: any) {
      console.error(err);
      alert("Error updating status: " + err.message);
    }
  };

  const handleRunAgent = async (issueId: string) => {
    if (!user || user.role !== "admin") {
      alert("Error: Only admins can trigger the AI Agent.");
      return;
    }
    setAgentRunningId(issueId);
    setAgentTrace([]);
    setAgentResult(null);

    try {
      const response = await apiFetch("/api/agent/analyze", {
        method: "POST",
        body: JSON.stringify({ issue_id: issueId })
      });
      const data = await response.json();
      if (data.success) {
        const analysis = data.agent_analysis;
        // Simulate step duration visuals
        for (let i = 0; i < analysis.steps.length; i++) {
          await new Promise((res) => setTimeout(res, 400));
          setAgentTrace((prev) => [...prev, analysis.steps[i]]);
        }
        setAgentResult(analysis);
        fetchIssues();
        fetchStats();
        if (selectedIssue && selectedIssue.id === issueId) {
          selectIssueDetail(issueId, referrerTab);
        }
      } else {
        alert("AI Agent execution failed: " + (data.error || "Unknown server error"));
      }
    } catch (err: any) {
      console.error(err);
      alert("Error running AI Agent: " + err.message);
    } finally {
      setAgentRunningId(null);
    }
  };

  // Detect duplicate in 100m range client side before submitting
  const checkDuplicateCandidate = () => {
    if (!newLat || !newLng || !newCategory) return;
    const sameCat = issues.filter(
      (i) => i.category === newCategory && i.status !== "rejected"
    );

    // Haversine formula client-side
    const match = sameCat.find((i) => {
      const R = 6371000;
      const dLat = ((newLat - i.lat) * Math.PI) / 180;
      const dLng = ((newLng - i.lng) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((i.lat * Math.PI) / 180) *
          Math.cos((newLat * Math.PI) / 180) *
          Math.sin(dLng / 2) *
          Math.sin(dLng / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const dist = R * c;
      return dist <= 100;
    });

    if (match) {
      setDuplicateWarning(match);
    } else {
      setDuplicateWarning(null);
    }
  };

  // Trigger duplicate check when coordinates or category changes
  useEffect(() => {
    checkDuplicateCandidate();
  }, [newLat, newLng, newCategory]);

  // Simulated location generator helper
  // Reverse geocode lat/lng → human-readable address via Google Maps Geocoding API
  const reverseGeocode = async (lat: number, lng: number): Promise<string> => {
    try {
      const r = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_MAPS_API_KEY}&language=en`
      );
      const d = await r.json();
      if (d.status === "OK" && d.results?.length > 0) {
        return d.results[0].formatted_address;
      }
      return `Near (${lat}, ${lng})`;
    } catch {
      return `Near (${lat}, ${lng})`;
    }
  };

  // Browser Geolocation handler with strict requirement checks
  const handleUseCurrentLocation = () => {
    setLocationError(null);
    if (!navigator.geolocation) {
      setLocationError("Browser doesn't support geolocation. Please pick location on map.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = Math.round(position.coords.latitude * 100000) / 100000;
        const lng = Math.round(position.coords.longitude * 100000) / 100000;
        setNewLat(lat);
        setNewLng(lng);
        setLocationSource("gps");
        setLocationError(null);
        setNewAddress("Fetching address…");
        const addr = await reverseGeocode(lat, lng);
        setNewAddress(addr);
      },
      (error) => {
        console.warn("Geolocation failed:", error);
        if (error.code === error.PERMISSION_DENIED) {
          setLocationError("__PERMISSION_DENIED__");
        } else if (error.code === error.TIMEOUT) {
          setLocationError("Location request timed out. Please pick location on map.");
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          setLocationError("GPS signal weak or unavailable. Please pick location on map.");
        } else {
          setLocationError("Location request failed. Please pick location on map.");
        }
      },
      { enableHighAccuracy: true, timeout: 6000, maximumAge: 0 }
    );
  };

  const handleCreateIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newLat || !newLng) {
      alert("Please provide a title and pin a location.");
      return;
    }

    try {
      let finalImg = newImageUrl;
      let finalMediaType = newMediaType;

      if (imageUploadOption === "file") {
        if (!selectedFile) {
          alert("Please select or drag-and-drop an image or video file.");
          return;
        }

        setIsUploading(true);
        const formData = new FormData();
        formData.append("file", selectedFile);

        const token = localStorage.getItem("sb_token");
        const headers: Record<string, string> = {};
        if (token) {
          headers["Authorization"] = `Bearer ${token}`;
        }

        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          headers,
          body: formData
        });

        if (!uploadRes.ok) {
          const errData = await uploadRes.json();
          throw new Error(errData.error || "File upload failed.");
        }

        const uploadData = await uploadRes.json();
        finalImg = uploadData.url;
        finalMediaType = uploadData.media_type;
        setIsUploading(false);
      } else {
        finalImg = imageUploadOption === "preset" ? newImageUrl : newImageUrl;
      }

      // Console logging for submitted location (Audit Requirement)
      const submittedAddress = newAddress && newAddress !== "Fetching address…" ? newAddress : `Near (${newLat}, ${newLng})`;
      const submittedSource = locationSource || "default_fallback";
      console.log("----------------------------------------");
      console.log("CLIENT LOCATION AUDIT - SUBMITTING ISSUE:");
      console.log(`Latitude: ${newLat}`);
      console.log(`Longitude: ${newLng}`);
      console.log(`Address: ${submittedAddress}`);
      console.log(`Location Source: ${submittedSource}`);
      console.log("----------------------------------------");

      const response = await apiFetch("/api/issues", {
        method: "POST",
        body: JSON.stringify({
          title: newTitle,
          description: newDescription,
          category: newCategory,
          lat: newLat,
          lng: newLng,
          address: submittedAddress,
          image_url: finalImg || "https://images.unsplash.com/photo-1515162305285-0293e4767cc2?auto=format&fit=crop&w=600&q=80",
          media_type: finalMediaType,
          location_source: submittedSource
        })
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to submit issue");
      }
      if (data.success) {
        setShowReportModal(false);
        // Reset form
        setNewTitle("");
        setNewDescription("");
        setNewCategory("pothole");
        setNewAddress("");
        setNewImageUrl("");
        setSelectedFile(null);
        setNewMediaType("image");
        setDuplicateWarning(null);
        setReportStep(1);
        setLocationError(null);
        setLocationSource(null);
        setShowMapInline(false);

        // Fetch new data
        await fetchIssues();
        await fetchStats();
        setActiveTab("issues");
      }
    } catch (err: any) {
      console.error(err);
      alert(err.message || "An error occurred while creating the issue.");
      setIsUploading(false);
    }
  };

  const renderSinglePageReportForm = (isModal: boolean, onClose?: () => void) => {
    const categories = [
      { id: "pothole", label: "Pothole", icon: "🕳️" },
      { id: "garbage", label: "Garbage", icon: "🗑️" },
      { id: "water_leakage", label: "Water Leakage", icon: "💧" },
      { id: "streetlight", label: "Streetlight", icon: "💡" },
      { id: "drain", label: "Blocked Drain", icon: "🌊" },
      { id: "other", label: "Other", icon: "⚙️" }
    ];

    const isFormValid = newTitle.trim().length > 0 &&
                        newLat !== 0 &&
                        newLng !== 0 &&
                        selectedFile !== null &&
                        (locationSource === "gps" || locationSource === "map_picker");

    const handleFormSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setImageUploadOption("file");
      await handleCreateIssue(e);
      if (isModal && onClose) {
        onClose();
      }
    };

    const triggerInput = (inputId: string) => {
      const el = document.getElementById(inputId);
      if (el) el.click();
    };

    return (
      <div className={`flex flex-col h-full ${isModal ? "p-0" : "w-full max-w-2xl mx-auto px-2 py-4"}`}>
        
        {/* Hidden inputs for capturing evidence */}
        <input
          id="camera-photo-input"
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              if (file.size > 50 * 1024 * 1024) {
                alert("File size exceeds 50MB limit!");
                return;
              }
              setSelectedFile(file);
            }
          }}
        />
        <input
          id="camera-video-input"
          type="file"
          accept="video/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              if (file.size > 50 * 1024 * 1024) {
                alert("File size exceeds 50MB limit!");
                return;
              }
              setSelectedFile(file);
            }
          }}
        />
        <input
          id="gallery-input"
          type="file"
          accept="image/*,video/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              if (file.size > 50 * 1024 * 1024) {
                alert("File size exceeds 50MB limit!");
                return;
              }
              setSelectedFile(file);
            }
          }}
        />

        {/* 1. Header (When not inside modal) */}
        {!isModal && (
          <div className="bg-gradient-to-r from-indigo-950 via-slate-950 to-purple-955 p-5 rounded-2xl border border-indigo-900/40 shadow-lg text-white mb-6">
            <h2 className="text-base md:text-lg font-black text-white flex items-center gap-2">
              <Plus className="w-5 h-5 text-indigo-400" />
              <span>Report an Issue</span>
            </h2>
            <p className="text-xs text-slate-300 mt-1 font-semibold">
              Add location and photo/video proof.
            </p>
          </div>
        )}

        <form onSubmit={handleFormSubmit} className="space-y-5 pb-24 md:pb-6 flex-1">
          
          {/* 2. Issue Title */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs space-y-3">
            <label className="block text-xs font-black text-slate-500 uppercase tracking-wider">
              Issue Title
            </label>
            <input
              type="text"
              required
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="e.g., Massive pothole in the HSR service lane"
              className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-indigo-500 focus:bg-white rounded-xl px-4 py-3 text-sm font-semibold transition-all focus:outline-none focus:ring-4 focus:ring-indigo-100"
            />
          </div>

          {/* 3. Category Grid */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs space-y-3">
            <label className="block text-xs font-black text-slate-500 uppercase tracking-wider">
              Category Classification
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setNewCategory(cat.id as Issue["category"])}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 transition-all ${
                    newCategory === cat.id
                      ? "border-indigo-600 bg-indigo-50/50 text-indigo-800 font-extrabold shadow-2xs"
                      : "border-slate-100 bg-slate-50/50 hover:bg-slate-50 text-slate-600 hover:border-slate-200"
                  }`}
                >
                  <span className="text-lg">{cat.icon}</span>
                  <span className="text-xs font-bold truncate">{cat.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 4. Evidence Capture */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs space-y-4">
            <div>
              <label className="block text-xs font-black text-slate-500 uppercase tracking-wider">
                Photo / Video Evidence
              </label>
              <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                Take a direct snap, record video, or upload high-fidelity proof.
              </p>
            </div>

            {/* Evidence action buttons */}
            <div className="grid grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => triggerInput("camera-photo-input")}
                className="flex flex-col items-center justify-center p-3 rounded-xl border border-slate-250 bg-slate-50 hover:bg-indigo-50/10 hover:border-indigo-400 text-slate-700 hover:text-indigo-700 transition-all cursor-pointer group shadow-2xs"
              >
                <div className="w-9 h-9 rounded-full bg-white group-hover:bg-indigo-50 flex items-center justify-center border border-slate-200 shadow-2xs mb-1.5 transition-colors">
                  <ImageIcon className="w-4.5 h-4.5 text-slate-500 group-hover:text-indigo-600" />
                </div>
                <span className="text-[10px] font-black tracking-tight text-center leading-tight">Take Photo</span>
              </button>

              <button
                type="button"
                onClick={() => triggerInput("camera-video-input")}
                className="flex flex-col items-center justify-center p-3 rounded-xl border border-slate-255 bg-slate-50 hover:bg-indigo-50/10 hover:border-indigo-400 text-slate-700 hover:text-indigo-700 transition-all cursor-pointer group shadow-2xs"
              >
                <div className="w-9 h-9 rounded-full bg-white group-hover:bg-indigo-50 flex items-center justify-center border border-slate-200 shadow-2xs mb-1.5 transition-colors">
                  <Video className="w-4.5 h-4.5 text-slate-500 group-hover:text-indigo-600" />
                </div>
                <span className="text-[10px] font-black tracking-tight text-center leading-tight">Record Video</span>
              </button>

              <button
                type="button"
                onClick={() => triggerInput("gallery-input")}
                className="flex flex-col items-center justify-center p-3 rounded-xl border border-slate-255 bg-slate-50 hover:bg-indigo-50/10 hover:border-indigo-400 text-slate-700 hover:text-indigo-700 transition-all cursor-pointer group shadow-2xs"
              >
                <div className="w-9 h-9 rounded-full bg-white group-hover:bg-indigo-50 flex items-center justify-center border border-slate-200 shadow-2xs mb-1.5 transition-colors">
                  <Plus className="w-4.5 h-4.5 text-slate-500 group-hover:text-indigo-600" />
                </div>
                <span className="text-[10px] font-black tracking-tight text-center leading-tight">From Gallery</span>
              </button>
            </div>

            {/* Real-time evidence preview */}
            {selectedFile ? (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-3">
                <div className="relative aspect-video rounded-lg overflow-hidden bg-slate-900 border border-slate-200 shadow-sm">
                  {selectedFile.type.startsWith("video/") ? (
                    <video
                      src={filePreviewUrl || undefined}
                      controls
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <img
                      src={filePreviewUrl || undefined}
                      alt="Incident proof"
                      className="w-full h-full object-cover"
                    />
                  )}
                  
                  <div className="absolute top-2.5 right-2.5">
                    <span className="text-[9px] bg-slate-900/85 backdrop-blur-xs text-white px-2 py-0.5 rounded-md font-bold uppercase tracking-wider border border-white/10">
                      {selectedFile.type.startsWith("video/") ? "Video Clip" : "Photo Evidence"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-800 truncate">{selectedFile.name}</p>
                    <p className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider">
                      {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • File verified
                    </p>
                  </div>
                  
                  <button
                    type="button"
                    onClick={() => setSelectedFile(null)}
                    className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition-all cursor-pointer shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-indigo-50/25 rounded-xl border border-indigo-100/50 text-center text-xs font-bold text-indigo-700/80">
                Please snap a photo, record video, or select a file (Max 50MB)
              </div>
            )}
          </div>

          {/* 5. Description */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs space-y-3">
            <label className="block text-xs font-black text-slate-500 uppercase tracking-wider">
              Description (Optional)
            </label>
            <textarea
              rows={3}
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="Describe landmarks, context, hazard level, or other details..."
              className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-indigo-500 focus:bg-white rounded-xl px-4 py-3 text-sm font-semibold transition-all focus:outline-none focus:ring-4 focus:ring-indigo-100"
            />
          </div>

          {/* 6. Location Section */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
            <div>
              <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-1">
                Pinpoint Location
              </label>
              <p className="text-[11px] text-slate-400 font-medium">
                Automatic GPS tracking allows dispatch of municipal crews and checks for duplicates.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5">
              <button
                type="button"
                onClick={handleUseCurrentLocation}
                className={`flex-1 py-3 px-4 rounded-xl font-black text-xs transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer border ${
                  locationSource === "gps"
                    ? "bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-600"
                    : "bg-indigo-600 hover:bg-indigo-500 text-white border-indigo-600"
                }`}
              >
                <Navigation className="w-4 h-4 fill-current animate-pulse" />
                <span>{locationSource === "gps" ? "GPS Connected" : "Use GPS Location"}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowMapInline(!showMapInline);
                  setLocationSource("map_picker");
                }}
                className={`flex-1 py-3 px-4 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-2 cursor-pointer border ${
                  showMapInline || locationSource === "map_picker"
                    ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                    : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
                }`}
              >
                <MapIcon className="w-4 h-4" />
                <span>{showMapInline ? "Hide Map Picker" : "Pick on Map"}</span>
              </button>
            </div>


            {locationError && locationError === "__PERMISSION_DENIED__" ? (
              <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2.5">
                <span className="text-amber-500 text-sm shrink-0">⚠️</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-amber-700 font-semibold leading-snug">Location access blocked</p>
                  <p className="text-[10px] text-amber-600/80 mt-0.5 leading-snug">Tap the lock icon in your browser's address bar → Site settings → Location → Allow, then tap "Use GPS Location" again.</p>
                </div>
                <button onClick={() => setLocationError(null)} className="text-amber-500 hover:text-amber-700 text-xs shrink-0 mt-0.5">✕</button>
              </div>
            ) : locationError ? (
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 flex items-start gap-2 text-amber-800 text-[11px] font-bold">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>{locationError}</span>
              </div>
            ) : null}

            {/* Inline map picker if showMapInline is enabled */}
            {showMapInline && (
              <div className="space-y-1.5 pt-1 animate-fade-in">
                <span className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  {hasValidKey ? "Click Map to Pinpoint Coordinates" : "Google Maps Offline — Select a Sector to Pin Coordinates"}
                </span>
                
                {hasValidKey ? (
                  <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs" style={{ height: "180px" }}>
                    <APIProvider apiKey={GOOGLE_MAPS_API_KEY} version="weekly">
                      <Map
                        defaultCenter={{ lat: (newLat !== 0 ? newLat : userLocation?.lat ?? mapCenter.lat), lng: (newLng !== 0 ? newLng : userLocation?.lng ?? mapCenter.lng) }}
                        defaultZoom={newLat !== 0 ? 14 : userLocation ? 12 : 5}
                        mapId="MINI_PICKER_MAP_SINGLE"
                        options={{
                          styles: DARK_MAP_STYLE,
                          disableDefaultUI: true,
                          zoomControl: true,
                        }}
                        internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                        style={{ width: "100%", height: "100%" }}
                        onClick={(e) => {
                          if (e.detail.latLng) {
                            const lat = Math.round(e.detail.latLng.lat * 100000) / 100000;
                            const lng = Math.round(e.detail.latLng.lng * 100000) / 100000;
                            setNewLat(lat);
                            setNewLng(lng);
                            setLocationSource("map_picker");
                            setNewAddress("Fetching address…");
                            reverseGeocode(lat, lng).then(setNewAddress);
                          }
                        }}
                      >
                        {(newLat !== 0 && newLng !== 0) && (
                          <AdvancedMarker position={{ lat: newLat, lng: newLng }} />
                        )}
                      </Map>
                    </APIProvider>
                  </div>
                ) : (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                    <p className="text-[11px] text-slate-500 font-medium">Google Maps unavailable. Use GPS Location button to set coordinates.</p>
                  </div>
                )}
              </div>
            )}

            {/* Address field — editable, shows pin icon + coords when location is set */}
            <div className="space-y-1 pt-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Street / Landmark Address</span>
              {newLat !== 0 && newLng !== 0 ? (
                <div className="flex flex-col gap-1 bg-slate-50 border border-indigo-300 p-3 rounded-xl">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                    <input
                      type="text"
                      required
                      value={newAddress}
                      onChange={(e) => setNewAddress(e.target.value)}
                      placeholder="Resolving address…"
                      className="flex-1 bg-transparent text-xs font-bold text-slate-700 focus:outline-none min-w-0"
                    />
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    Coordinates: {newLat.toFixed(6)}, {newLng.toFixed(6)}
                  </div>
                </div>
              ) : (
                <input
                  type="text"
                  required
                  value={newAddress}
                  onChange={(e) => setNewAddress(e.target.value)}
                  placeholder="e.g., Opposite police station, Sector 4, HSR Layout"
                  className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-indigo-500 focus:bg-white rounded-xl px-3.5 py-2.5 text-xs font-semibold focus:outline-none"
                />
              )}
            </div>
          </div>

          {/* Duplicate Detection Alert */}
          {duplicateWarning && (
            <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 flex items-start gap-3 shadow-2xs animate-fade-in">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs leading-normal">
                <p className="font-bold text-amber-900">Potential Duplicate Detected! ⚠️</p>
                <p className="text-amber-700 mt-1">
                  Another active report <strong className="text-slate-900">&ldquo;{duplicateWarning.title}&rdquo;</strong> already exists within 100 meters! Submitting this will automatically link it to aggregate municipal tracking.
                </p>
              </div>
            </div>
          )}

          {/* Bottom Actions Footer */}
          <div className="mt-6 flex items-center justify-between gap-3 shrink-0 pb-4">
            <button
              type="button"
              onClick={() => {
                setNewTitle("");
                setNewDescription("");
                setNewAddress("");
                setNewLat(0);
                setNewLng(0);
                setSelectedFile(null);
                setDuplicateWarning(null);
                setLocationError(null);
                if (isModal && onClose) onClose();
                else setActiveTab("home");
              }}
              className="px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black transition-all border border-slate-200 cursor-pointer shrink-0"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={!isFormValid || isUploading}
              className={`flex-1 py-3 rounded-xl text-xs font-black transition-all shadow-md flex items-center justify-center gap-2 ${
                isFormValid && !isUploading
                  ? "bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer"
                  : "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200/50"
              }`}
            >
              {isUploading ? (
                <>
                  <div className="w-4 h-4 border-2 border-slate-300 border-t-slate-800 rounded-full animate-spin shrink-0" />
                  <span>Uploading Evidence...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Submit Report</span>
                </>
              )}
            </button>
          </div>

        </form>

      </div>
    );
  };

  // Quick setup coordinate preset clicks
  const panToLocation = (lat: number, lng: number, label: string) => {
    setMapCenter({ lat, lng });
    setMapZoom(15);
  };

  // Categories helper
  const getCategoryColor = (category: string) => {
    switch (category) {
      case "pothole":
        return "bg-rose-500 text-white";
      case "garbage":
        return "bg-amber-500 text-white";
      case "water_leakage":
        return "bg-blue-500 text-white";
      case "streetlight":
        return "bg-purple-500 text-white";
      case "drain":
        return "bg-indigo-500 text-white";
      default:
        return "bg-slate-500 text-white";
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "reported":
        return "bg-blue-100 text-blue-800 border border-blue-200";
      case "verified":
        return "bg-amber-100 text-amber-800 border border-amber-200 animate-pulse";
      case "in_progress":
        return "bg-indigo-100 text-indigo-800 border border-indigo-200";
      case "resolved":
        return "bg-emerald-100 text-emerald-800 border border-emerald-200";
      case "rejected":
        return "bg-slate-100 text-slate-800 border border-slate-200";
      default:
        return "bg-slate-100 text-slate-800";
    }
  };

  // Haversine distance in km
  const getDistanceKm = (lat1: number, lng1: number, lat2: number, lng2: number) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const NEARBY_RADIUS_KM = 10;
  const nearbyActiveIssues = userLocation
    ? issues.filter(i =>
        i.status !== "resolved" && i.status !== "rejected" &&
        getDistanceKm(userLocation.lat, userLocation.lng, i.lat, i.lng) <= NEARBY_RADIUS_KM
      )
    : issues.filter(i => i.status !== "resolved" && i.status !== "rejected");

  // Filter logic
  const filteredIssues = issues.filter((i) => {
    const matchesOwner = !user || issuesView === "all" || i.reporter_id === user.id;
    const matchesCategory = filterCategory === "all" || i.category === filterCategory;
    const matchesStatus = filterStatus === "all" || i.status === filterStatus;
    const matchesSearch =
      i.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      i.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      i.address.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesOwner && matchesCategory && matchesStatus && matchesSearch;
  });



  return (
    <div className="flex flex-col h-screen w-full bg-slate-50 font-sans text-slate-900 overflow-hidden" id="app_root">
      
      {/* 1. Header Navbar */}
      <nav className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-3 md:px-6 shrink-0 shadow-sm z-30" id="main_navbar">
        <div className="flex items-center gap-2 md:gap-6">
          {/* Hamburger Menu Button - hidden now that bottom nav replaces drawer */}

          <div className="flex items-center gap-2 cursor-pointer" onClick={() => { setActiveTab("home"); setMobileSidebarOpen(false); }}>
            <div className="w-8.5 h-8.5 bg-indigo-600 rounded-lg flex items-center justify-center shadow-sm">
              <Shield className="w-4.5 h-4.5 text-white" />
            </div>
            <span className="text-base md:text-xl font-black tracking-tight text-slate-800">Community Hero</span>
          </div>

        </div>

        {/* User Profile Action */}
        <div className="flex items-center gap-2">
          {user && (
            <div className="flex items-center gap-2">
              <div className="text-right hidden md:block">
                <p className="text-[9px] font-extrabold text-indigo-600 uppercase tracking-wider">
                  {user.role === "admin" ? "Admin 👑" : "Verified Citizen 🛡️"}
                </p>
                <p className="text-xs font-bold text-slate-800">{user.name}</p>
              </div>
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(v => !v)}
                  className="w-8.5 h-8.5 rounded-full bg-indigo-100 border border-indigo-200 shadow-xs flex items-center justify-center font-black text-xs text-indigo-700 cursor-pointer hover:bg-indigo-200 transition-colors"
                >
                  {user.name.split(" ").map(n => n[0]).join("")}
                </button>
                {showUserMenu && (
                  <div className="absolute right-0 top-10 bg-white border border-slate-200 rounded-xl shadow-lg py-1 z-50 min-w-[130px]">
                    <button
                      onClick={() => { setShowUserMenu(false); handleLogout(); }}
                      className="w-full text-left px-4 py-2.5 text-xs font-bold text-rose-600 hover:bg-rose-50 transition-colors"
                    >
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
              <button
                onClick={handleLogout}
                className="hidden md:block px-3 py-1.5 border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-600 rounded-lg text-xs font-bold transition-all cursor-pointer"
              >
                Sign Out
              </button>
            </div>
          )}
          {!user && (
            <button
              onClick={() => {
                setIsRegistering(false);
                setShowAuthModal(true);
              }}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-md hover:shadow-indigo-500/10 cursor-pointer"
            >
              Sign In
            </button>
          )}
        </div>
      </nav>

      {/* 2. Main Content Layout Container */}
      <div className="flex flex-1 overflow-hidden relative">
        
        {/* Left Sidebar */}
        <aside
          className="hidden md:flex md:flex-col w-64 h-full bg-white border-r border-slate-200 p-5 gap-4.5 shrink-0"
          id="left_sidebar"
        >
          {/* Points & Stats widget - visible for desktop and simple inside drawer */}
          {user && (
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 shadow-xs hidden md:block">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">My Standing</p>
                <span className="text-[9px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-bold">
                  Level {Math.floor((stats?.leaderboard.find(l => l.id === user.id)?.points || 0) / 25) + 1}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <div className="bg-indigo-50/70 p-2 rounded-lg border border-indigo-100 text-center">
                  <p className="text-lg font-black text-indigo-600">
                    {stats?.leaderboard.find(l => l.id === user.id)?.points || 0}
                  </p>
                  <p className="text-[8px] font-extrabold text-indigo-400 uppercase tracking-widest">Points</p>
                </div>
                <div className="bg-emerald-50/70 p-2 rounded-lg border border-emerald-100 text-center">
                  <p className="text-lg font-black text-emerald-600">
                    {stats?.leaderboard.find(l => l.id === user.id)?.stats.resolved || 0}
                  </p>
                  <p className="text-[8px] font-extrabold text-emerald-400 uppercase tracking-widest">Resolved</p>
                </div>
              </div>
              <p className="text-[10px] text-slate-500 mt-2 text-center font-medium italic border-t border-slate-100 pt-1.5">
                &ldquo;{stats?.leaderboard.find(l => l.id === user.id)?.badge || "Civic Helper"}&rdquo;
              </p>
            </div>
          )}

          {/* Create Issue Action Button - Hidden on mobile drawer since we have menu links and map CTA */}
          <button
            onClick={() => {
              if (!user) { setPostLoginAction({ type: "report" }); setShowAuthModal(true); return; }
              setActiveTab("report");
              setSelectedIssue(null);
              setMobileSidebarOpen(false);
            }}
            className="hidden md:flex w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-3 px-4 rounded-xl shadow-xs items-center justify-center gap-2 transition-all cursor-pointer text-xs"
            id="report_issue_btn"
          >
            <Plus className="w-4 h-4" />
            <span>Report New Issue</span>
          </button>

          {/* Navigation Menu Links */}
          <nav className="flex-1 flex flex-col gap-1 text-xs font-semibold overflow-y-auto" id="side_navigation">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-3 mb-1.5">Main Menu</p>
            
            <button
              onClick={() => { setActiveTab("home"); setSelectedIssue(null); setMobileSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-colors text-left ${
                activeTab === "home" ? "bg-indigo-50 text-indigo-700 font-extrabold" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <TrendingUp className="w-4 h-4 text-indigo-500" />
              <span>Home</span>
            </button>

            <button
              onClick={() => { setActiveTab("map"); setSelectedIssue(null); setMobileSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-colors text-left ${
                activeTab === "map" ? "bg-indigo-50 text-indigo-700 font-extrabold" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <MapIcon className="w-4 h-4 text-emerald-500" />
              <span>Map</span>
            </button>

            <button
              onClick={() => { if (!user) { setPostLoginAction({ type: "report" }); setShowAuthModal(true); return; } setActiveTab("report"); setSelectedIssue(null); setMobileSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-colors text-left ${
                activeTab === "report" ? "bg-indigo-50 text-indigo-700 font-extrabold" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <Plus className="w-4 h-4 text-indigo-600" />
              <span>Report Issue</span>
            </button>

            <button
              onClick={() => { setActiveTab("issues"); setSelectedIssue(null); setMobileSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-colors text-left ${
                activeTab === "issues" ? "bg-indigo-50 text-indigo-700 font-extrabold" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <List className="w-4 h-4 text-blue-500" />
              <span>Issues</span>
              <span className="ml-auto text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-bold">
                {issues.length}
              </span>
            </button>

            <button
              onClick={() => {
                if (!user) {
                  setPostLoginAction({ type: "tab", data: { tabName: "reports" } });
                  setShowAuthModal(true);
                } else {
                  setActiveTab("reports");
                  setSelectedIssue(null);
                }
                setMobileSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-colors text-left ${
                activeTab === "reports" ? "bg-indigo-50 text-indigo-700 font-extrabold" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <Award className="w-4 h-4 text-amber-600" />
              <span>My Reports</span>
            </button>

            <button
              onClick={() => { setActiveTab("dashboard"); setSelectedIssue(null); setMobileSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-colors text-left ${
                activeTab === "dashboard" ? "bg-indigo-50 text-indigo-700 font-extrabold" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <BarChart2 className="w-4 h-4 text-purple-500" />
              <span>Leaderboard</span>
            </button>

            {user && user.role === "admin" && (
              <button
                onClick={() => {
                  setActiveTab("admin");
                  setSelectedIssue(null);
                  setMobileSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-colors text-left border-t border-dashed border-slate-200 mt-2 pt-2.5 ${
                  activeTab === "admin" ? "bg-indigo-50 text-indigo-700 font-extrabold" : "text-red-600 hover:bg-red-50/50"
                }`}
              >
                <Shield className="w-4 h-4 text-rose-600" />
                <span>Admin Dashboard</span>
              </button>
            )}

            {/* Mobile-Only Sign In/Sign Out inside navigation list */}
            <div className="border-t border-slate-100 mt-2 pt-2.5">
              {user ? (
                <button
                  onClick={() => {
                    handleLogout();
                    setMobileSidebarOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-rose-600 hover:bg-rose-50/50 transition-colors text-left font-bold cursor-pointer"
                >
                  <X className="w-4 h-4 text-rose-500" />
                  <span>Sign Out</span>
                </button>
              ) : (
                <button
                  onClick={() => {
                    setIsRegistering(false);
                    setShowAuthModal(true);
                    setMobileSidebarOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-indigo-600 hover:bg-indigo-50/50 transition-colors text-left font-bold cursor-pointer"
                >
                  <User className="w-4 h-4 text-indigo-500" />
                  <span>Sign In / Sign Up</span>
                </button>
              )}
            </div>
          </nav>

          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest text-center border-t border-slate-100 pt-3">
            Civic Control Room
          </div>
        </aside>

        {/* 3. Main Dashboard Workspace Content Area */}
        <main className="flex-1 flex flex-col overflow-hidden relative" id="workspace_viewport">
          
          {/* Map | List Segmented Toggle Sub-header */}
          {(activeTab === "map" || activeTab === "issues") && (
            <div className="bg-white border-b border-slate-200 px-4 py-2.5 flex items-center justify-between shrink-0 z-20">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <span className="text-xs font-black uppercase text-slate-400 tracking-wider hidden sm:inline">View Mode:</span>
                <div className="inline-flex bg-slate-100 p-1 rounded-xl border border-slate-200/60 w-full sm:w-auto">
                  <button
                    onClick={() => {
                      setActiveTab("map");
                      setSelectedIssue(null);
                    }}
                    className={`flex-1 sm:flex-initial px-6 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                      activeTab === "map"
                        ? "bg-white text-indigo-600 shadow-sm font-extrabold"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <MapIcon className="w-3.5 h-3.5" />
                    <span>Map</span>
                  </button>
                  <button
                    onClick={() => {
                      setActiveTab("issues");
                      setSelectedIssue(null);
                    }}
                    className={`flex-1 sm:flex-initial px-6 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                      activeTab === "issues"
                        ? "bg-white text-indigo-600 shadow-sm font-extrabold"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <List className="w-3.5 h-3.5" />
                    <span>List</span>
                  </button>
                </div>
              </div>

              {/* Compact Active stats indicator - hidden on mobile to give room for the segmented toggle */}
              <div className="hidden sm:flex text-xs font-bold text-slate-500 items-center gap-1.5 bg-slate-50 border border-slate-150 px-3 py-1.5 rounded-xl">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse"></span>
                <span>{userLocation ? `${nearbyActiveIssues.length} Active Near You · ${focusedCity}` : `${nearbyActiveIssues.length} Active (All Cities) · Enable GPS`}</span>
              </div>
            </div>
          )}

             {/* Landing / Overview Page */}
          {activeTab === "home" && !selectedIssue && (
            <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-20 md:pb-6 space-y-6" id="view_home">
              
              {/* Simple & Light heading */}
              <div className="bg-gradient-to-r from-indigo-900 to-slate-900 p-5 md:p-6 rounded-2xl border border-indigo-950 shadow-md text-white space-y-4">
                <div>
                  <h1 className="text-xl md:text-2xl font-black tracking-tight text-white">
                    Be the Change Your Neighborhood Needs.
                  </h1>
                  <p className="mt-1.5 text-slate-300 text-xs md:text-sm leading-relaxed max-w-2xl">
                    Report potholes, streetlights, garbage dumps, and water leakages. Our automated AI Agent validates data, filters duplicates, constructs resolution blueprints, and routes them to civic responders in real-time.
                  </p>
                </div>

                {/* Compact Preview Card */}
                <div className="bg-slate-800/80 backdrop-blur-md rounded-xl p-4 border border-slate-700/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                      <MapPin className="w-5 h-5 animate-bounce text-indigo-400" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-white">
                        {userLocation ? `${nearbyActiveIssues.length} Active Issues Near You` : `${nearbyActiveIssues.length} Active Issues (All Cities)`}
                      </h3>
                      {userLocation ? (
                        <p className="text-[11px] text-slate-400">Within 10km · {focusedCity}</p>
                      ) : (
                        <React.Fragment>
                        <button
                          onClick={() => {
                            setLocationBlocked(false);
                            navigator.geolocation?.getCurrentPosition(
                              async (pos) => {
                                const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                                setUserLocation(loc);
                                setMapCenter(loc);
                                setMapZoom(13);
                                try {
                                  const r = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${loc.lat},${loc.lng}&key=${GOOGLE_MAPS_API_KEY}&language=en&result_type=locality|sublocality`);
                                  const d = await r.json();
                                  if (d.status === "OK" && d.results?.length > 0) {
                                    const comps = d.results[0].address_components || [];
                                    const city = comps.find((c: any) => c.types.includes("locality"))?.long_name || comps.find((c: any) => c.types.includes("sublocality"))?.long_name || "";
                                    const state = comps.find((c: any) => c.types.includes("administrative_area_level_1"))?.short_name || "";
                                    if (city) setFocusedCity(`${city}${state ? ", " + state : ""}`);
                                  }
                                } catch {}
                              },
                              (err) => { if (err.code === err.PERMISSION_DENIED) setLocationBlocked(true); },
                              { enableHighAccuracy: false, timeout: 8000, maximumAge: 0 }
                            );
                          }}
                          className="text-[11px] text-indigo-300 hover:text-white underline underline-offset-2 cursor-pointer mt-0.5"
                        >
                          📍 Tap to enable GPS for nearby issues
                        </button>
                        {locationBlocked && (
                          <div className="mt-2 flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2">
                            <span className="text-amber-400 text-sm shrink-0">⚠️</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-[11px] text-amber-200 font-semibold leading-snug">Location access blocked</p>
                              <p className="text-[10px] text-amber-300/70 mt-0.5 leading-snug">Tap the lock icon in your browser's address bar → Site settings → Location → Allow, then try again.</p>
                            </div>
                            <button onClick={() => setLocationBlocked(false)} className="text-amber-400 hover:text-white text-xs shrink-0 mt-0.5">✕</button>
                          </div>
                        )}
                        </React.Fragment>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 shrink-0">
                    <button
                      onClick={() => {
                        setActiveTab("map");
                        setSelectedIssue(null);
                      }}
                      className="px-3.5 py-2 bg-slate-700 hover:bg-slate-650 text-white text-[11px] font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <MapIcon className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Open Map</span>
                    </button>
                    <button
                      onClick={() => {
                        if (!user) { setPostLoginAction({ type: "report" }); setShowAuthModal(true); return; }
                        setActiveTab("report");
                        setSelectedIssue(null);
                      }}
                      className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold rounded-lg transition-all flex items-center gap-1 shadow-md cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Report Issue</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* 2. Nearby / Recent Issues List (Brought right up below the Map) */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 md:p-5">
                <div className="flex items-center justify-between mb-3.5">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full"></span>
                    <h3 className="text-xs md:text-sm font-black text-slate-800">Recent Reported Incidents</h3>
                  </div>
                  <button
                    onClick={() => setActiveTab("issues")}
                    className="text-[11px] font-black text-indigo-600 hover:underline flex items-center gap-0.5"
                  >
                    <span>View All</span>
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>

                <div className="divide-y divide-slate-100 max-h-[300px] overflow-y-auto pr-1">
                  {issues.slice(0, 5).map((issue) => (
                    <div
                      key={issue.id}
                      className="py-3 flex items-start justify-between hover:bg-slate-50/75 rounded-lg p-1.5 md:p-2 transition-all cursor-pointer"
                      onClick={() => selectIssueDetail(issue.id, "home")}
                    >
                      <div className="flex gap-2.5">
                        <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                          issue.category === "pothole" ? "bg-rose-500 animate-pulse" :
                          issue.category === "garbage" ? "bg-amber-500" :
                          issue.category === "water_leakage" ? "bg-blue-500" :
                          "bg-purple-500"
                        }`}></span>
                        <div>
                          <p className="text-xs font-bold text-slate-800 line-clamp-1">{issue.title}</p>
                          <p className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">{issue.address}</p>
                          <div className="flex items-center gap-2.5 mt-1.5">
                            <span className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-extrabold uppercase tracking-wider">
                              {issue.category}
                            </span>
                            <span className="text-[9px] text-slate-400 font-semibold flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {new Date(issue.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full ${getStatusBadge(issue.status)}`}>
                          {issue.status}
                        </span>
                        <p className="text-[9px] text-slate-400 font-bold mt-1.5">
                          {issue.verification_count} verifications
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 3. My Standing Card (Rendered inline on the Home Screen for logged-in citizens) */}
              {user && (
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/60 shadow-xs">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Award className="w-4.5 h-4.5 text-indigo-600" />
                      <p className="text-xs font-black text-slate-800 uppercase tracking-wider">My Citizen Standing</p>
                    </div>
                    <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-black">
                      Level {Math.floor((stats?.leaderboard.find(l => l.id === user.id)?.points || 0) / 25) + 1}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white p-3 rounded-xl border border-slate-200/50 text-center">
                      <p className="text-xl font-black text-indigo-600">
                        {stats?.leaderboard.find(l => l.id === user.id)?.points || 0}
                      </p>
                      <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mt-0.5">Points</p>
                    </div>
                    <div className="bg-white p-3 rounded-xl border border-slate-200/50 text-center">
                      <p className="text-xl font-black text-emerald-600">
                        {stats?.leaderboard.find(l => l.id === user.id)?.stats.resolved || 0}
                      </p>
                      <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest mt-0.5">Resolved</p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 mt-3 text-center font-bold italic">
                    👑 &ldquo;{stats?.leaderboard.find(l => l.id === user.id)?.badge || "Civic Helper"}&rdquo;
                  </p>
                </div>
              )}

              {/* 4. Live Metric Statistics cards (2x2 grid layout, compact padding) */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
                <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-lg font-black text-slate-800">{stats?.totals.total_reported || 0}</p>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Reported Incidents</p>
                  </div>
                </div>

                <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600">
                    <CheckCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-lg font-black text-emerald-600">{stats?.totals.total_resolved || 0}</p>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Fully Resolved</p>
                  </div>
                </div>

                <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600">
                    <ThumbsUp className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-lg font-black text-slate-800">{stats?.totals.total_verifications || 0}</p>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Verifications</p>
                  </div>
                </div>

                <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-lg font-black text-slate-800">{stats?.totals.total_citizens || 0}</p>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Registered Warriors</p>
                  </div>
                </div>
              </div>

              {/* 5. AI Predictive Insights teaser card */}
              <div className="bg-gradient-to-br from-indigo-900 to-slate-900 rounded-2xl border border-indigo-800/40 shadow-md p-5 text-white">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-indigo-300" />
                    <span className="text-xs font-extrabold uppercase tracking-wider text-indigo-200">AI Predictive Insights</span>
                  </div>
                  {insights?.ai?.health_score !== undefined && (
                    <div className={`px-2.5 py-1 rounded-full text-[10px] font-black ${insights.ai.health_score >= 70 ? "bg-emerald-500/20 text-emerald-300" : insights.ai.health_score >= 40 ? "bg-amber-500/20 text-amber-300" : "bg-rose-500/20 text-rose-300"}`}>
                      Health {insights.ai.health_score}/100
                    </div>
                  )}
                </div>

                {insightsLoading ? (
                  <div className="flex items-center gap-2 text-indigo-300 text-xs py-2">
                    <div className="w-4 h-4 border-2 border-indigo-400/30 border-t-indigo-400 rounded-full animate-spin" />
                    <span>Analysing community data…</span>
                  </div>
                ) : insights?.ai ? (
                  <>
                    <p className="text-[11px] text-slate-300 leading-relaxed mb-3">{insights.ai.narrative || insights.ai.summary}</p>
                    <div className="space-y-2">
                      {(insights.ai.predictions || []).slice(0, 2).map((p: any, i: number) => (
                        <div key={i} className="flex items-start gap-2 bg-white/5 rounded-xl px-3 py-2">
                          <span className="text-base">{p.trend === "increasing" ? "📈" : p.trend === "decreasing" ? "📉" : "➡️"}</span>
                          <div className="flex-1 min-w-0">
                            <span className="text-[10px] font-black uppercase text-indigo-300 tracking-wider">{p.category.replace("_", " ")}</span>
                            <p className="text-[11px] text-slate-300 mt-0.5 leading-snug">{p.forecast}</p>
                          </div>
                          <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full shrink-0 ${p.urgency === "critical" ? "bg-rose-500/30 text-rose-300" : p.urgency === "high" ? "bg-amber-500/30 text-amber-300" : "bg-slate-500/30 text-slate-300"}`}>{p.urgency}</span>
                        </div>
                      ))}
                    </div>
                    {user?.role === "admin" && (
                      <button onClick={() => setActiveTab("admin")} className="mt-3 text-[10px] text-indigo-300 hover:text-white font-bold underline underline-offset-2 cursor-pointer">
                        View full insights in Admin Panel →
                      </button>
                    )}
                  </>
                ) : (
                  <p className="text-[11px] text-slate-400">No insights available yet.</p>
                )}
              </div>

              {/* 6. How it works guide */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                <h3 className="text-xs md:text-sm font-black text-slate-800 mb-4 flex items-center gap-2">
                  <Award className="w-4.5 h-4.5 text-indigo-600" />
                  <span>How It Works</span>
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold shrink-0">1</div>
                    <div>
                      <p className="text-xs font-bold text-slate-800">Pin Point on Map</p>
                      <p className="text-[10px] text-slate-400 mt-0.5 leading-normal">Drop coordinates and upload photographic details of the neighborhood issue.</p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold shrink-0">2</div>
                    <div>
                      <p className="text-xs font-bold text-slate-800">AI Classification</p>
                      <p className="text-[10px] text-slate-400 mt-0.5 leading-normal">Gemini evaluates coordinates for duplicates and classifies severity instantly.</p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold shrink-0">3</div>
                    <div>
                      <p className="text-xs font-bold text-slate-800">Citizen Consensus</p>
                      <p className="text-[10px] text-slate-400 mt-0.5 leading-normal">Neighbors upvote/verify the reports to secure data validity before dispatching.</p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold shrink-0">4</div>
                    <div>
                      <p className="text-xs font-bold text-slate-800">Dispatch Automation</p>
                      <p className="text-[10px] text-slate-400 mt-0.5 leading-normal">Municipal responders review priority scoring and action resolution plans.</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* 6. AI Features / Hero Description */}
              <div className="bg-gradient-to-r from-indigo-700 via-indigo-600 to-indigo-800 rounded-2xl p-5 md:p-6 text-white relative overflow-hidden shadow-xs">
                <div className="absolute top-0 right-0 w-80 h-full opacity-10 bg-no-repeat bg-cover pointer-events-none" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1596176530529-78163a4f7af2?auto=format&fit=crop&w=400')" }}></div>
                <div className="relative z-10 max-w-3xl">
                  <div className="bg-white/15 px-3 py-1 rounded-full text-[10px] font-bold tracking-wider inline-flex items-center gap-1.5 mb-2.5 backdrop-blur-xs">
                    <Sparkles className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
                    <span>Empowering Indian Urban Communities with AI Actionability</span>
                  </div>
                  <h1 className="text-lg md:text-2xl font-black tracking-tight">
                    Be the Change Your Neighborhood Needs.
                  </h1>
                  <p className="mt-1.5 text-indigo-100 text-[10px] md:text-xs leading-relaxed">
                    Report potholes, streetlights, garbage dumps, and water leakages. Our automated AI Agent validates data, filters duplicates, constructs action-oriented resolution blueprints, and routes them to civic responders in real-time.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Interactive Map Page */}
          {activeTab === "map" && !selectedIssue && (
            <div className="flex-1 flex flex-col overflow-hidden relative text-slate-100" id="view_map_panel">
              
              {/* Map Canvas Frame */}
              <div className="flex-1 bg-slate-950 relative overflow-hidden flex items-center justify-center min-h-[450px]">
                {!hasValidKey ? (
                  <div className="p-8 text-center max-w-md mx-auto bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-800 shadow-2xl z-10">
                    <MapIcon className="w-12 h-12 text-slate-500 mx-auto mb-4 animate-pulse" />
                    <h3 className="text-sm font-extrabold text-slate-100 mb-2">Live Google Map Experience</h3>
                    <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                      To activate high-precision GIS coordinates and real interactive routing overlays, add your Google Maps Platform API Key to the environment variables.
                    </p>
                    <div className="text-left bg-slate-950 border border-slate-800/80 rounded-xl p-3.5 space-y-2 text-[10px] font-medium text-slate-500">
                      <p><strong>1. Get a key:</strong> <a href="https://console.cloud.google.com/google/maps-apis/start?utm_campaign=gmp-code-assist-ais" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">Google Cloud Console</a></p>
                      <p><strong>2. Save Secret:</strong> Add <code>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> as a project secret in the Settings panel (⚙️ top-right).</p>
                    </div>
                  </div>
                ) : (
                  <APIProvider apiKey={GOOGLE_MAPS_API_KEY} version="weekly">
                    <Map
                      center={{ lat: mapCenter.lat, lng: mapCenter.lng }}
                      zoom={mapZoom}
                      onCenterChanged={(e) => setMapCenter(e.detail.center)}
                      onZoomChanged={(e) => setMapZoom(e.detail.zoom)}
                      mapId="DEMO_MAP_ID"
                      options={{
                        styles: DARK_MAP_STYLE,
                        disableDefaultUI: true,
                        mapTypeControl: false,
                        streetViewControl: false,
                      }}
                      internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                      style={{ width: '100%', height: '100%' }}
                      onClick={(e) => {
                        if (e.detail.latLng && locationSource === "map_picker") {
                          const lat = e.detail.latLng.lat;
                          const lng = e.detail.latLng.lng;
                          setNewLat(Math.round(lat * 100000) / 100000);
                          setNewLng(Math.round(lng * 100000) / 100000);

                          setNewAddress("Fetching address…");
                          reverseGeocode(Math.round(lat * 100000) / 100000, Math.round(lng * 100000) / 100000).then(setNewAddress);
                          if (!user) { setPostLoginAction({ type: "report" }); setShowAuthModal(true); return; }
                          setActiveTab("report");
                        }
                      }}
                    >
                      {/* 1. Issues Layer */}
                      {showIssuesLayer && issues.map((i) => {
                        const colorClass =
                          i.category === "pothole" ? "bg-rose-500 shadow-rose-500/30" :
                          i.category === "garbage" ? "bg-amber-500 shadow-amber-500/30" :
                          i.category === "water_leakage" ? "bg-blue-500 shadow-blue-500/30" :
                          i.category === "streetlight" ? "bg-purple-500 shadow-purple-500/30" :
                          "bg-indigo-500 shadow-indigo-500/30";

                        const emoji =
                          i.category === "pothole" ? "🕳️" :
                          i.category === "garbage" ? "🗑️" :
                          i.category === "water_leakage" ? "💧" :
                          i.category === "streetlight" ? "💡" :
                          "⚠️";

                        return (
                          <React.Fragment key={i.id}>
                            <AdvancedMarker
                              position={{ lat: i.lat, lng: i.lng }}
                              onClick={() => {
                                setActiveMarkerId(i.id);
                              }}
                            >
                              <div className="relative group flex flex-col items-center cursor-pointer">
                                {/* Floating hover tooltip */}
                                <div className="absolute bottom-full mb-2 bg-slate-900 border border-slate-800 text-white text-[10px] font-bold px-2.5 py-1.5 rounded-xl shadow-2xl opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none transition-opacity duration-200 flex flex-col gap-0.5 z-50">
                                  <span className="uppercase text-[8px] tracking-wider text-indigo-400 font-extrabold">{i.category}</span>
                                  <span>{i.title}</span>
                                  <span className="text-[8px] text-slate-400 font-normal">{i.address}</span>
                                </div>
                                <div className={`w-8 h-8 rounded-full border-2 border-slate-950 shadow-lg flex items-center justify-center transition-transform hover:scale-115 active:scale-95 ${colorClass}`}>
                                  <span className="text-xs">{emoji}</span>
                                </div>
                                <span className="absolute inset-0 w-8 h-8 rounded-full bg-white/20 animate-ping -z-10"></span>
                              </div>
                            </AdvancedMarker>

                            {activeMarkerId === i.id && (
                              <InfoWindow
                                position={{ lat: i.lat, lng: i.lng }}
                                onCloseClick={() => setActiveMarkerId(null)}
                              >
                                <div className="p-2 text-slate-800 font-sans max-w-[220px]">
                                  <div className="flex items-center gap-1.5 mb-1">
                                    <span className="text-xs">{emoji}</span>
                                    <p className="text-[10px] font-extrabold text-indigo-600 uppercase tracking-wider">{i.category.replace("_", " ")}</p>
                                  </div>
                                  <h4 className="text-xs font-bold text-slate-900 mb-1">{i.title}</h4>
                                  <p className="text-[10px] text-slate-500 line-clamp-2 mb-1">{i.address}</p>
                                  <div className="flex items-center justify-between gap-2 mt-2 pt-1.5 border-t border-slate-100">
                                    <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 capitalize">
                                      {i.status}
                                    </span>
                                    <span className="text-[9px] font-semibold text-slate-500">
                                      {i.verification_count || 0} Verifications
                                    </span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      selectIssueDetail(i.id, "map");
                                      setActiveMarkerId(null);
                                    }}
                                    className="w-full mt-2 py-1 text-center bg-indigo-600 hover:bg-indigo-700 text-white rounded text-[10px] font-bold"
                                  >
                                    View Full Details & AI Analysis
                                  </button>
                                </div>
                              </InfoWindow>
                            )}
                          </React.Fragment>
                        );
                      })}

                      {/* 2. Hotspots Layer */}
                      {showHotspotsLayer && getHotspotsForCity().map((hs) => (
                        <React.Fragment key={hs.id}>
                          <Circle
                            center={hs.center}
                            radius={hs.radius}
                            strokeColor={hs.color}
                            strokeOpacity={0.8}
                            strokeWeight={2}
                            fillColor={hs.color}
                            fillOpacity={0.15}
                          />
                          <AdvancedMarker position={hs.center}>
                            <div className="bg-slate-900/95 border border-slate-800 text-slate-200 text-[9px] font-black px-2 py-1 rounded-lg shadow-md uppercase whitespace-nowrap pointer-events-none select-none z-10">
                              {hs.label}
                            </div>
                          </AdvancedMarker>
                        </React.Fragment>
                      ))}

                      {/* 3. Nearby Neighborhood Layer */}
                      {showNearbyLayer && userLocation && (
                        <React.Fragment>
                          <Circle
                            center={userLocation}
                            radius={1500}
                            strokeColor="#3b82f6"
                            strokeOpacity={0.7}
                            strokeWeight={2}
                            fillColor="#3b82f6"
                            fillOpacity={0.08}
                          />
                          <AdvancedMarker position={userLocation}>
                            <div className="relative flex items-center justify-center">
                              <div className="w-5 h-5 rounded-full bg-blue-600 border-2 border-white flex items-center justify-center text-[10px] font-bold text-white shadow-lg animate-pulse z-20">
                                👤
                              </div>
                              <span className="absolute -bottom-6 bg-blue-900 border border-blue-700 text-white text-[8px] font-extrabold px-1.5 py-0.5 rounded-md uppercase whitespace-nowrap z-20 shadow-md">
                                My Location
                              </span>
                            </div>
                          </AdvancedMarker>
                        </React.Fragment>
                      )}
                    </Map>
                  </APIProvider>
                )}

                {/* Compact Stats Overlay at Top-Left */}
                <div className="absolute top-4 left-4 bg-slate-900/90 backdrop-blur-md px-3.5 py-2 rounded-xl shadow-xl border border-slate-800/80 z-20 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
                  <span className="text-[10px] font-extrabold uppercase text-slate-200 tracking-wider">
                    {nearbyActiveIssues.length} {userLocation ? "Near You" : "Active"}
                  </span>
                  <span className="text-slate-600">|</span>
                  <span className="text-[10px] font-bold text-slate-400">
                    {issues.length} Total Reports
                  </span>
                </div>

                {/* Controls and Filters Overlay at Top-Right */}
                <div className="absolute top-4 right-4 z-20 flex flex-col items-end gap-2">
                  <button
                    onClick={() => setShowLayerControl(!showLayerControl)}
                    className="p-2.5 bg-slate-900/95 hover:bg-slate-800/95 border border-slate-800 text-slate-200 rounded-xl shadow-lg transition-all hover:scale-105 active:scale-95 flex items-center justify-center cursor-pointer"
                    title="Toggle Layers"
                  >
                    <Layers className="w-4.5 h-4.5 text-indigo-400" />
                  </button>

                  {/* Compact, dismissible Layer Popup */}
                  {showLayerControl && (
                    <div className="bg-slate-900/95 backdrop-blur-md p-4 rounded-xl shadow-2xl border border-slate-800 w-52 flex flex-col gap-3 animate-fade-in text-left">
                      <div className="flex items-center justify-between border-b border-slate-800/80 pb-1.5">
                        <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">
                          Map Layers
                        </span>
                        <button
                          onClick={() => setShowLayerControl(false)}
                          className="p-0.5 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="space-y-2.5">
                        {/* Issues Layer Toggle */}
                        <label className="flex items-center justify-between cursor-pointer group select-none">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={showIssuesLayer}
                              onChange={(e) => setShowIssuesLayer(e.target.checked)}
                              className="w-3.5 h-3.5 text-indigo-600 bg-slate-800 border-slate-700 rounded focus:ring-indigo-500 cursor-pointer"
                            />
                            <span className="text-xs font-bold text-slate-300 group-hover:text-white transition-colors">Issue Pins</span>
                          </div>
                          <span className="text-[9px] bg-indigo-950 text-indigo-400 px-1.5 py-0.5 rounded font-black">
                            {issues.length}
                          </span>
                        </label>

                        {/* Hotspots Layer Toggle */}
                        <label className="flex items-center justify-between cursor-pointer group select-none">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={showHotspotsLayer}
                              onChange={(e) => setShowHotspotsLayer(e.target.checked)}
                              className="w-3.5 h-3.5 text-rose-600 bg-slate-800 border-slate-700 rounded focus:ring-rose-500 cursor-pointer"
                            />
                            <span className="text-xs font-bold text-slate-300 group-hover:text-white transition-colors">Risk Hotspots</span>
                          </div>
                          <span className="text-[9px] bg-rose-950 text-rose-400 px-1.5 py-0.5 rounded font-black">
                            {getHotspotsForCity().length}
                          </span>
                        </label>

                        {/* Nearby Layer Toggle */}
                        <label className="flex items-center justify-between cursor-pointer group select-none">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={showNearbyLayer}
                              onChange={(e) => setShowNearbyLayer(e.target.checked)}
                              className="w-3.5 h-3.5 text-blue-600 bg-slate-800 border-slate-700 rounded focus:ring-blue-500 cursor-pointer"
                            />
                            <span className="text-xs font-bold text-slate-300 group-hover:text-white transition-colors">Nearby (1.5km)</span>
                          </div>
                          <span className="text-[9px] bg-blue-950 text-blue-400 px-1.5 py-0.5 rounded font-black">
                            On
                          </span>
                        </label>
                      </div>
                    </div>
                  )}

                  {/* Zoom/Location Overlay Control */}
                  <div className="flex flex-col gap-1.5 mt-1 bg-slate-900/95 border border-slate-800 rounded-xl p-1 shadow-lg">
                    <button
                      type="button"
                      onClick={() => {
                        if (userLocation) {
                          setMapCenter(userLocation);
                          setMapZoom(15);
                          setShowNearbyLayer(true);
                        } else if (navigator.geolocation) {
                          navigator.geolocation.getCurrentPosition(
                            (pos) => {
                              const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                              setUserLocation(loc);
                              setMapCenter(loc);
                              setMapZoom(15);
                              setShowNearbyLayer(true);
                            },
                            () => {},
                            { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
                          );
                        }
                      }}
                      className="p-2 hover:bg-slate-800 text-slate-200 rounded-lg transition-colors flex items-center justify-center cursor-pointer"
                      title="My Location"
                    >
                      <Navigation className="w-4 h-4 text-sky-400" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setMapZoom(prev => Math.min(prev + 1, 19))}
                      className="p-2 hover:bg-slate-800 text-slate-200 rounded-lg transition-colors flex items-center justify-center cursor-pointer text-xs font-bold"
                      title="Zoom In"
                    >
                      +
                    </button>
                    <button
                      type="button"
                      onClick={() => setMapZoom(prev => Math.max(prev - 1, 3))}
                      className="p-2 hover:bg-slate-800 text-slate-200 rounded-lg transition-colors flex items-center justify-center cursor-pointer text-xs font-bold"
                      title="Zoom Out"
                    >
                      −
                    </button>
                  </div>
                </div>

                {/* Floating "+ Report" button */}
              </div>

            </div>
          )}

          {/* Browse Issues Grid List Page */}
          {activeTab === "issues" && !selectedIssue && (
            <div className="flex-1 flex flex-col overflow-hidden" id="view_issues_panel">
              
              {/* Filter controls panel */}
              <div className="bg-white p-5 border-b border-slate-200 shadow-xs flex flex-wrap gap-4 items-center justify-between shrink-0" id="issues_filter_bar">

                {/* All / Mine toggle */}
                {user && (
                  <div className="flex items-center bg-slate-100 rounded-xl p-1 shrink-0">
                    <button
                      onClick={() => setIssuesView("all")}
                      className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${issuesView === "all" ? "bg-white text-indigo-700 shadow-xs" : "text-slate-500"}`}
                    >All</button>
                    <button
                      onClick={() => setIssuesView("mine")}
                      className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${issuesView === "mine" ? "bg-white text-indigo-700 shadow-xs" : "text-slate-500"}`}
                    >My Issues</button>
                  </div>
                )}

                {/* Search field */}
                <div className="relative w-full max-w-sm">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search title, address, or descriptions..."
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                {/* Filters Row */}
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Filter className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-xs text-slate-500 font-semibold">Category:</span>
                    <select
                      value={filterCategory}
                      onChange={(e) => setFilterCategory(e.target.value)}
                      className="bg-slate-50 border border-slate-200 text-xs font-bold rounded-xl px-2.5 py-1.5 text-slate-700"
                    >
                      <option value="all">All</option>
                      <option value="pothole">Pothole</option>
                      <option value="garbage">Garbage</option>
                      <option value="water_leakage">Water Leakage</option>
                      <option value="streetlight">Streetlight</option>
                      <option value="drain">Drain</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 font-semibold">Status:</span>
                    <select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                      className="bg-slate-50 border border-slate-200 text-xs font-bold rounded-xl px-2.5 py-1.5 text-slate-700"
                    >
                      <option value="all">All</option>
                      <option value="reported">Reported</option>
                      <option value="verified">Verified</option>
                      <option value="in_progress">In Progress</option>
                      <option value="resolved">Resolved</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  </div>
                </div>

              </div>

              {/* Incidents Grid list viewport */}
              <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-20 md:pb-6" id="issues_scroll_frame">
                {filteredIssues.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-dashed border-slate-200">
                    <AlertCircle className="w-12 h-12 text-slate-300 mb-3" />
                    <p className="text-sm font-bold text-slate-600">No issues found matching filters.</p>
                    <p className="text-xs text-slate-400 mt-1">Try adjusting category, status search filters.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {filteredIssues.map((issue) => (
                      <div
                        key={issue.id}
                        onClick={() => selectIssueDetail(issue.id, "issues")}
                        className="bg-white rounded-2xl border border-slate-200/80 hover:border-indigo-300 shadow-xs hover:shadow-md transition-all cursor-pointer flex flex-col overflow-hidden"
                      >
                        {/* Card Image element */}
                        <div className="h-44 w-full bg-slate-100 relative shrink-0">
                          {issue.image_url ? (
                            <img
                              src={issue.image_url}
                              alt={issue.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center text-slate-300">
                              <ImageIcon className="w-10 h-10 mb-2" />
                              <span className="text-[10px] font-bold">No Image Provided</span>
                            </div>
                          )}

                          {/* Float category tag */}
                          <div className="absolute top-3 left-3 flex gap-2 flex-wrap">
                            <span className={`text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-lg ${getCategoryColor(issue.category)} shadow-xs`}>
                              {issue.category}
                            </span>
                            {issue.duplicate_of && (
                              <span className="text-[9px] font-extrabold bg-red-600 text-white px-2 py-1 rounded-lg uppercase tracking-wider">
                                Duplicate Flag
                              </span>
                            )}
                            {isSlaBreached(issue) && (
                              <span className="text-[9px] font-extrabold bg-rose-600 text-white px-2 py-1 rounded-lg uppercase tracking-wider flex items-center gap-1">
                                ⚠ Overdue {getDaysOpen(issue)}d
                              </span>
                            )}
                          </div>

                          <div className="absolute bottom-3 right-3">
                            <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-lg ${getStatusBadge(issue.status)} shadow-xs`}>
                              {issue.status}
                            </span>
                          </div>
                        </div>

                        {/* Content text block */}
                        <div className="p-5 flex-1 flex flex-col justify-between">
                          <div>
                            <h3 className="text-sm font-extrabold text-slate-800 line-clamp-1 mb-1">{issue.title}</h3>
                            <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed mb-3">{issue.description || "No further details submitted."}</p>
                          </div>

                          <div className="border-t border-slate-100 pt-3.5 mt-2">
                            <div className="flex items-center gap-1 text-[11px] text-slate-400 font-semibold mb-2">
                              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="truncate">{issue.address}</span>
                            </div>

                            <div className="flex items-center justify-between text-[11px] text-slate-500">
                              <span>📅 {new Date(issue.created_at).toLocaleDateString()}</span>
                              <span className="font-bold text-slate-600">{issue.verification_count} consensus votes</span>
                            </div>
                          </div>
                        </div>

                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          )}

          {/* Dedicated Report Issue Page */}
          {activeTab === "report" && !selectedIssue && (
            <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-20 md:pb-0" id="view_report_tab">
              {renderSinglePageReportForm(false)}
            </div>
          )}

          {/* Dedicated Report Issue Page - Deprecated */}
          {false && activeTab === "report" && !selectedIssue && (
            <div className="flex-1 overflow-y-auto p-4 md:p-6 max-w-3xl mx-auto space-y-6 animate-fade-in" id="view_report_tab_old">
              <div className="bg-gradient-to-r from-indigo-900 to-slate-900 p-5 md:p-6 rounded-2xl border border-indigo-950 shadow-md text-white">
                <h2 className="text-lg md:text-xl font-black text-white flex items-center gap-2">
                  <Plus className="w-5 h-5 text-indigo-400" />
                  <span>Report Local Civic Complaint</span>
                </h2>
                <p className="text-xs text-slate-300 mt-1">
                  Complete standard details. Our automated AI Agent will instantly check for duplicate complaints and construct resolution blueprints.
                </p>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 md:p-6">
                <form onSubmit={handleCreateIssue} className="space-y-4">
                  {/* General parameters */}
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Issue Title / Subject</label>
                      <input
                        type="text"
                        required
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        placeholder="e.g., Huge pothole in service lane"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">Category Classification</label>
                        <select
                          value={newCategory}
                          onChange={(e) => setNewCategory(e.target.value as Issue["category"])}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="pothole">Pothole</option>
                          <option value="garbage">Garbage Pile</option>
                          <option value="water_leakage">Water Leakage</option>
                          <option value="streetlight">Non-functional Streetlight</option>
                          <option value="drain">Blocked Drain</option>
                          <option value="other">Other Defect</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">Media Format Type</label>
                        <div className="flex gap-4 py-2">
                          <label className="inline-flex items-center gap-1.5 text-xs font-semibold cursor-pointer text-slate-700">
                            <input
                              type="radio"
                              name="mediaTypeTab"
                              checked={newMediaType === "image"}
                              onChange={() => setNewMediaType("image")}
                            />
                            <span>Photo Attachment</span>
                          </label>
                          <label className="inline-flex items-center gap-1.5 text-xs font-semibold cursor-pointer text-slate-700">
                            <input
                              type="radio"
                              name="mediaTypeTab"
                              checked={newMediaType === "video"}
                              onChange={() => setNewMediaType("video")}
                            />
                            <span>Video Incident</span>
                          </label>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Detailed Description</label>
                      <textarea
                        rows={3}
                        value={newDescription}
                        onChange={(e) => setNewDescription(e.target.value)}
                        placeholder="Describe hazards, severity level, or nearby landmarks..."
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      ></textarea>
                    </div>

                    {/* Location picker */}
                    <div className="border border-slate-200 rounded-xl p-4 space-y-3 bg-slate-50/50">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold text-slate-700 flex items-center gap-1">
                          <MapPin className="w-4 h-4 text-indigo-500" />
                          <span>Location Verification</span>
                        </span>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={handleUseCurrentLocation}
                            className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 text-[10px] font-extrabold text-indigo-600 rounded-lg transition-all cursor-pointer"
                          >
                            Use Current Location
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-[11px] font-bold text-slate-600">
                        <div className="bg-white p-2.5 rounded-lg border border-slate-100">
                          <p className="text-[9px] text-slate-400 uppercase">Latitude</p>
                          <p className="font-mono mt-0.5 text-slate-800">{newLat || "Not Set"}</p>
                        </div>
                        <div className="bg-white p-2.5 rounded-lg border border-slate-100">
                          <p className="text-[9px] text-slate-400 uppercase">Longitude</p>
                          <p className="font-mono mt-0.5 text-slate-800">{newLng || "Not Set"}</p>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Calculated Address</label>
                        <input
                          type="text"
                          required
                          value={newAddress}
                          onChange={(e) => setNewAddress(e.target.value)}
                          placeholder="Address is calculated from coordinates automatically"
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold focus:outline-none"
                        />
                        <p className="text-[10px] text-slate-400 mt-1 leading-normal">
                          💡 Tip: You can click anywhere on the <span className="font-bold text-indigo-600 cursor-pointer" onClick={() => setActiveTab("map")}>Map</span> tab to precisely drop a pin, and you will be routed back here automatically.
                        </p>
                      </div>
                    </div>

                    {/* Image preset/upload */}
                    <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3">
                      <span className="text-xs font-extrabold text-slate-700 flex items-center gap-1">
                        <ImageIcon className="w-4 h-4 text-indigo-500" />
                        <span>Incident Visual Evidence</span>
                      </span>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {UNSPLASH_PRESETS.map((p) => (
                          <div
                            key={p.url}
                            onClick={() => setNewImageUrl(p.url)}
                            className={`group relative aspect-video rounded-lg overflow-hidden border-2 cursor-pointer transition-all ${
                              newImageUrl === p.url ? "border-indigo-600 shadow-md scale-95" : "border-slate-200/60 opacity-70 hover:opacity-100"
                            }`}
                          >
                            <img src={p.url} alt={p.name} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-slate-900/40 flex items-end p-1.5">
                              <span className="text-[9px] font-bold text-white uppercase tracking-wider truncate">{p.name}</span>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="text-center pt-2">
                        <span className="text-[10px] text-slate-400 font-medium">Or enter a custom photographic asset URL below:</span>
                        <input
                          type="url"
                          value={newImageUrl}
                          onChange={(e) => setNewImageUrl(e.target.value)}
                          placeholder="https://images.unsplash.com/photo-..."
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold mt-1 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-4">
                    <button
                      type="button"
                      onClick={() => {
                        // Reset forms
                        setNewTitle("");
                        setNewDescription("");
                        setNewAddress("");
                        setNewLat(0);
                        setNewLng(0);
                        setActiveTab("home");
                      }}
                      className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-extrabold transition-all cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black transition-all shadow-md hover:shadow-indigo-500/10 cursor-pointer flex items-center gap-1.5"
                    >
                      <Plus className="w-4 h-4" />
                      <span>File Complaint</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Stats and Leaderboard Dashboard Tab */}
          {activeTab === "dashboard" && !selectedIssue && (
            <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-20 md:pb-6 space-y-6 bg-slate-50/50" id="view_leaderboard">
              
              {/* Modern City Dashboard Header */}
              <div className="bg-slate-950 bg-gradient-to-br from-[#020617] via-[#0f172a] to-[#1e1b4b] p-5 md:p-7 rounded-2xl border border-indigo-900/40 shadow-xl text-white" style={{ background: 'linear-gradient(135deg, #020617 0%, #0f172a 50%, #1e1b4b 100%)' }}>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2.5 py-1 rounded-full font-black uppercase tracking-widest border border-indigo-500/30">
                      Municipal Standing
                    </span>
                    <h2 className="text-lg md:text-xl font-black text-white mt-2 flex items-center gap-2">
                      <BarChart2 className="w-5.5 h-5.5 text-indigo-400" />
                      <span>Civic Engagement & Leaderboard</span>
                    </h2>
                    <p className="text-xs text-slate-100 mt-1.5 max-w-2xl leading-relaxed">
                      Tracking active citizen participation, consensus verifications, and successful resolution blueprints across the municipality.
                    </p>
                  </div>
                  <div className="bg-white/5 backdrop-blur-md px-5 py-3 rounded-xl border border-white/10 text-center shrink-0">
                    <p className="text-xl md:text-2xl font-black text-white">{stats?.totals.total_citizens || 0}</p>
                    <p className="text-[9px] font-bold uppercase tracking-widest text-indigo-200 mt-0.5">Registered Citizens</p>
                  </div>
                </div>
              </div>

              {/* 1. Top row of dynamic micro KPI cards across full width */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
                  <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Total Reported</p>
                  <p className="text-xl md:text-2xl font-black text-slate-800 mt-1">{stats?.totals.total_reported || 0}</p>
                  <p className="text-[10px] text-indigo-600 font-bold mt-1">📁 Complaints Filed</p>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
                  <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Resolutions</p>
                  <p className="text-xl md:text-2xl font-black text-emerald-600 mt-1">{stats?.totals.total_resolved || 0}</p>
                  <p className="text-[10px] text-emerald-600 font-bold mt-1">✅ 100% Verified Resolved</p>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
                  <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Verifications</p>
                  <p className="text-xl md:text-2xl font-black text-amber-600 mt-1">{stats?.totals.total_verifications || 0}</p>
                  <p className="text-[10px] text-amber-600 font-bold mt-1">🛡️ Citizen Consensus</p>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
                  <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Avg. Resolution</p>
                  <p className="text-xl md:text-2xl font-black text-slate-800 mt-1">3.2 Days</p>
                  <p className="text-[10px] text-indigo-600 font-bold mt-1">⚡ AI Agentic Dispatch</p>
                </div>
              </div>

              {/* 2. Compact Category Density & Pipeline Status Banner */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-1.5">
                    <span className="w-1.5 h-3 bg-indigo-600 rounded-full"></span>
                    <span>City Incident Metrics Summary</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">Quick lookup of issue density distributions across the city focus areas.</p>
                </div>

                {/* Categories - Compact row of tags on mobile/tablet, sleek small progress pills on desktop */}
                <div className="hidden sm:grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 pt-1">
                  {stats?.issuesByCategory.map((catObj) => {
                    const percentage = stats?.totals.total_reported
                      ? (catObj.count / stats.totals.total_reported) * 100
                      : 0;
                    return (
                      <div key={catObj.category} className="bg-slate-50/50 p-3 rounded-xl border border-slate-100 flex flex-col justify-between">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight truncate capitalize">
                          {catObj.category.replace("_", " ")}
                        </span>
                        <div className="flex items-baseline justify-between mt-1.5">
                          <span className="text-base font-black text-slate-800">{catObj.count}</span>
                          <span className="text-[10px] font-bold text-indigo-600">{Math.round(percentage)}%</span>
                        </div>
                        <div className="w-full h-1 bg-slate-100 rounded-full mt-2 overflow-hidden">
                          <div
                            className="bg-indigo-600 h-full rounded-full transition-all duration-500"
                            style={{ width: `${percentage}%` }}
                          ></div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Mobile Category Density: Super compact list of chips to avoid tall dashboard-like view */}
                <div className="flex sm:hidden flex-wrap gap-2 pt-1">
                  {stats?.issuesByCategory.map((catObj) => (
                    <div key={catObj.category} className="bg-slate-50 border border-slate-150 rounded-xl px-3 py-1.5 flex items-center gap-2">
                      <span className="text-[11px] font-bold text-slate-700 capitalize">
                        {catObj.category.replace("_", " ")}
                      </span>
                      <span className="text-[10px] bg-slate-200/80 text-slate-800 font-extrabold px-1.5 py-0.5 rounded">
                        {catObj.count}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Status Pipeline: Horizontal bar list instead of large boxes */}
                <div className="border-t border-slate-100 pt-4 flex flex-wrap items-center justify-between gap-4">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Status Pipeline
                  </span>
                  <div className="flex flex-wrap gap-3">
                    {stats?.statusBreakdown.map((stObj) => (
                      <span
                        key={stObj.status}
                        className="inline-flex items-center gap-1.5 text-xs font-bold bg-slate-100 text-slate-700 px-3 py-1 rounded-full border border-slate-200/60"
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          stObj.status === "resolved" ? "bg-emerald-500" :
                          stObj.status === "in_progress" ? "bg-indigo-500" :
                          stObj.status === "verified" ? "bg-amber-500" : "bg-blue-400"
                        }`} />
                        <span className="capitalize">{stObj.status.replace("_", " ")} ({stObj.count})</span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* 3. Spacious, full-width Civic Leaderboard */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 md:p-6">
                <div className="flex items-center justify-between mb-6 border-b border-slate-100 pb-4">
                  <div>
                    <h3 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
                      <Award className="w-5 h-5 text-amber-500" />
                      <span>Citizen Leaderboard Rankings</span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Score calculations: Reports Filed (+10 pts) • Given Verifications (+5 pts) • Received Verifications (+2 pts) • Final Resolutions (+20 pts).
                    </p>
                  </div>
                  <span className="text-xs bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-xl font-extrabold border border-indigo-100">
                    🏆 Top Citizens
                  </span>
                </div>

                {/* Desktop/Tablet Spacious Table - No longer cramped, plenty of space for everything */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-150 text-slate-400 font-bold uppercase tracking-wider text-[10px] bg-slate-50/50">
                        <th className="p-4 w-16 text-center">Rank</th>
                        <th className="p-4">Citizen Profile</th>
                        <th className="p-4">Civic Title / Badge</th>
                        <th className="p-4 text-center">📁 Filed</th>
                        <th className="p-4 text-center">✅ Verified</th>
                        <th className="p-4 text-center">🛠️ Resolved</th>
                        <th className="p-4 text-right pr-6">Total Score</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {stats?.leaderboard.map((u, idx) => (
                        <tr key={u.id} className="hover:bg-slate-50/70 transition-all">
                          {/* Rank */}
                          <td className="p-4 text-center">
                            <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-black ${
                              idx === 0 ? "bg-amber-100 text-amber-800 border border-amber-200" :
                              idx === 1 ? "bg-slate-100 text-slate-800 border border-slate-200" :
                              idx === 2 ? "bg-amber-50 text-amber-700 border border-amber-100" :
                              "text-slate-400 font-bold"
                            }`}>
                              {idx + 1}
                            </span>
                          </td>
                          {/* Profile */}
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-indigo-100 border border-indigo-200 flex items-center justify-center font-bold text-indigo-700 text-xs shadow-xs shrink-0">
                                {u.name.split(" ").map(n => n[0]).join("")}
                              </div>
                              <div>
                                <p className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                                  <span>{u.name}</span>
                                  {u.role === "admin" && (
                                    <span className="text-[8px] bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">Admin</span>
                                  )}
                                </p>
                                <p className="text-[10px] text-slate-400 font-medium">Citizen ID: ...{u.id.slice(-6)}</p>
                              </div>
                            </div>
                          </td>
                          {/* Title / Badge */}
                          <td className="p-4">
                            <span className="inline-flex items-center gap-1 text-[11px] font-black text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100/50">
                              🏆 {u.badge}
                            </span>
                          </td>
                          {/* Stats columns */}
                          <td className="p-4 text-center font-bold text-slate-700 text-xs">
                            {u.stats.reported}
                          </td>
                          <td className="p-4 text-center font-bold text-slate-700 text-xs">
                            {u.stats.verified_given}
                          </td>
                          <td className="p-4 text-center font-bold text-slate-700 text-xs">
                            {u.stats.resolved}
                          </td>
                          {/* Score Points */}
                          <td className="p-4 text-right pr-6">
                            <div className="flex flex-col items-end">
                              <span className="text-sm font-black text-slate-800">{u.points}</span>
                              <span className="text-[8px] text-slate-400 font-extrabold uppercase tracking-widest">Points</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile List Layout (Beautifully structured row cards, not cramped) */}
                <div className="block md:hidden divide-y divide-slate-100">
                  {stats?.leaderboard.map((u, idx) => (
                    <div key={u.id} className="py-4 flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-black ${
                            idx === 0 ? "bg-amber-100 text-amber-800 border border-amber-200" :
                            idx === 1 ? "bg-slate-100 text-slate-800 border border-slate-200" :
                            idx === 2 ? "bg-amber-50 text-amber-700 border border-amber-100" :
                            "text-slate-400 font-bold"
                          }`}>
                            {idx + 1}
                          </span>
                          <div className="w-8 h-8 rounded-full bg-indigo-100 border border-indigo-200 flex items-center justify-center font-bold text-indigo-700 text-xs">
                            {u.name.split(" ").map(n => n[0]).join("")}
                          </div>
                          <div>
                            <p className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                              <span>{u.name}</span>
                              {u.role === "admin" && (
                                <span className="text-[8px] bg-rose-100 text-rose-700 px-1 py-0.5 rounded font-bold uppercase tracking-wider">Admin</span>
                              )}
                            </p>
                            <p className="text-[10px] text-indigo-600 font-bold">🏆 {u.badge}</p>
                          </div>
                        </div>

                        <div className="text-right">
                          <p className="text-sm font-black text-slate-800">{u.points}</p>
                          <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Pts</p>
                        </div>
                      </div>

                      {/* Horizontal Mini Stats Row on Mobile */}
                      <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2 rounded-xl border border-slate-100/80 text-center text-[10px] font-bold text-slate-600">
                        <div>
                          <span className="text-slate-400 block text-[9px] uppercase tracking-wider">Filed</span>
                          <span className="text-slate-800 font-extrabold">{u.stats.reported}</span>
                        </div>
                        <div className="border-x border-slate-200/60">
                          <span className="text-slate-400 block text-[9px] uppercase tracking-wider">Verified</span>
                          <span className="text-slate-800 font-extrabold">{u.stats.verified_given}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[9px] uppercase tracking-wider">Resolved</span>
                          <span className="text-slate-800 font-extrabold">{u.stats.resolved}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

              </div>
            </div>
          )}

          {/* My personal reports overview page */}
          {activeTab === "reports" && user && !selectedIssue && (
            <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-20 md:pb-6 space-y-6" id="view_personal_reports">
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap justify-between items-center gap-4">
                <div>
                  <h2 className="text-base font-extrabold text-slate-800">My Incidents & Standing</h2>
                  <p className="text-xs text-slate-400">Track all your reports, verified consensus statuses, and award achievements.</p>
                </div>
                <div className="bg-indigo-600 text-white rounded-xl px-4 py-3 text-center">
                  <p className="text-2xl font-black">{stats?.leaderboard.find(l => l.id === user.id)?.points || 0}</p>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-indigo-200">Total Score points</p>
                </div>
              </div>

              {/* Private Incident reports lists */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6">
                <h3 className="text-sm font-extrabold text-slate-800 mb-4">Incident Log History</h3>
                {issues.filter(i => i.reporter_id === user.id).length === 0 ? (
                  <div className="py-10 text-center text-slate-400">
                    <p className="text-sm">You haven't filed any complaints yet.</p>
                    <button
                      onClick={() => setShowReportModal(true)}
                      className="mt-3 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold cursor-pointer"
                    >
                      File First Complaint
                    </button>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {issues.filter(i => i.reporter_id === user.id).map(issue => (
                      <div
                        key={issue.id}
                        className="py-3 flex items-center justify-between hover:bg-slate-50 p-2 rounded-xl transition-all cursor-pointer"
                        onClick={() => selectIssueDetail(issue.id, "reports")}
                      >
                        <div>
                          <p className="text-xs font-bold text-slate-800">{issue.title}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">{issue.address}</p>
                          <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded uppercase mt-2 inline-block">
                            {issue.category}
                          </span>
                        </div>

                        <div className="text-right">
                          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${getStatusBadge(issue.status)}`}>
                            {issue.status}
                          </span>
                          <p className="text-[10px] text-slate-400 mt-2 font-semibold">
                            Consensus: {issue.verification_count} verifications
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Admin Command Panel tab */}
          {activeTab === "admin" && user && user.role === "admin" && !selectedIssue && (
            <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-20 md:pb-6 space-y-6" id="view_admin_command">
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-base font-extrabold text-slate-800">Admin Control Center</h2>
                  <p className="text-xs text-slate-400">Municipal dashboard oversight. Review all citizens reports, toggle statuses, and initiate the automated 5-step Agentic Resolution Plan pipeline.</p>
                </div>
                <button
                  onClick={() => document.getElementById("admin-insights")?.scrollIntoView({ behavior: "smooth" })}
                  className="shrink-0 flex items-center gap-1.5 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-xl border border-indigo-200 transition-colors cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  AI Insights
                </button>
              </div>

              {/* Master Issue Database Grid */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="bg-white p-5 border-b border-slate-200 shadow-xs flex flex-wrap gap-4 items-center justify-between shrink-0">
                  <div className="relative w-full max-w-sm">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={adminSearch}
                      onChange={(e) => setAdminSearch(e.target.value)}
                      placeholder="Search title, address..."
                      className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 mr-1">
                      <span className="text-[10px] font-bold text-slate-500">{issues.length} total</span>
                      <span className="text-slate-200">|</span>
                      <span className="text-[10px] font-bold text-rose-500">{issues.filter(i => i.status !== "resolved" && i.status !== "rejected").length} pending</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Filter className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-xs text-slate-500 font-semibold">Category:</span>
                      <select
                        value={adminFilterCategory}
                        onChange={(e) => setAdminFilterCategory(e.target.value)}
                        className="bg-slate-50 border border-slate-200 text-xs font-bold rounded-xl px-2.5 py-1.5 text-slate-700"
                      >
                        <option value="all">All</option>
                        <option value="pothole">Pothole</option>
                        <option value="garbage">Garbage</option>
                        <option value="water_leakage">Water Leakage</option>
                        <option value="streetlight">Streetlight</option>
                        <option value="drain">Drain</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500 font-semibold">Status:</span>
                      <select
                        value={adminFilterStatus}
                        onChange={(e) => setAdminFilterStatus(e.target.value)}
                        className="bg-slate-50 border border-slate-200 text-xs font-bold rounded-xl px-2.5 py-1.5 text-slate-700"
                      >
                        <option value="all">All</option>
                        <option value="reported">Reported</option>
                        <option value="verified">Verified</option>
                        <option value="in_progress">In Progress</option>
                        <option value="resolved">Resolved</option>
                        <option value="rejected">Rejected</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-600 border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-100 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                        <th className="p-4">Incident Details</th>
                        <th className="p-4">Category</th>
                        <th className="p-4">Reporter ID</th>
                        <th className="p-4">Status Dispatch</th>
                        <th className="p-4">AI Agent Engine</th>
                        <th className="p-4">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                      {issues.filter(i =>
                        (adminFilterStatus === "all" || i.status === adminFilterStatus) &&
                        (adminFilterCategory === "all" || i.category === adminFilterCategory) &&
                        (!adminSearch || i.title.toLowerCase().includes(adminSearch.toLowerCase()) || i.address.toLowerCase().includes(adminSearch.toLowerCase()))
                      ).map(issue => (
                        <tr key={issue.id} className="hover:bg-slate-50/50 transition-all">
                          <td className="p-4 max-w-xs">
                            <p className="font-bold text-slate-800 line-clamp-1">{issue.title}</p>
                            <p className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">{issue.address}</p>
                            {isSlaBreached(issue) && (
                              <span className="inline-flex items-center gap-1 text-[9px] font-bold bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full mt-1">
                                ⚠ Overdue {getDaysOpen(issue)}d / SLA {SLA_DAYS[issue.category] ?? 7}d
                              </span>
                            )}
                          </td>
                          <td className="p-4">
                            <span className="capitalize bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-bold">
                              {issue.category}
                            </span>
                          </td>
                          <td className="p-4 text-slate-400 font-mono">{issue.reporter_id}</td>
                          <td className="p-4">
                            <select
                              value={issue.status}
                              onChange={(e) => handleAdminStatusChange(issue.id, e.target.value)}
                              className="bg-white border border-slate-200 rounded-lg p-1 text-xs font-bold text-slate-700 focus:ring-1 focus:ring-indigo-500"
                            >
                              <option value="reported">Reported</option>
                              <option value="verified">Verified</option>
                              <option value="in_progress">In Progress</option>
                              <option value="resolved">Resolved</option>
                              <option value="rejected">Rejected</option>
                            </select>
                          </td>
                          <td className="p-4">
                            {issue.status === "resolved" || issue.status === "rejected" ? (
                              <span className="text-[10px] text-slate-400 italic">—</span>
                            ) : issue.agent_analysis ? (
                              <div className="flex flex-col gap-1">
                                <span className="inline-flex items-center gap-1 text-[9px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full w-max uppercase">
                                  Plan Ready
                                </span>
                                <span className="text-[10px] font-bold text-slate-500">Urgency: {issue.agent_analysis.urgency_score}/100</span>
                              </div>
                            ) : (
                              <button
                                onClick={() => handleRunAgent(issue.id)}
                                disabled={agentRunningId === issue.id}
                                className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-[10px] font-bold flex items-center gap-1 shadow-sm disabled:opacity-50"
                              >
                                {agentRunningId === issue.id ? (
                                  <span className="animate-spin w-3 h-3 border-2 border-white border-t-transparent rounded-full"></span>
                                ) : (
                                  <Play className="w-3 h-3 fill-white" />
                                )}
                                <span>{agentRunningId === issue.id ? "Analyzing..." : "Run AI Agent"}</span>
                              </button>
                            )}
                          </td>
                          <td className="p-4">
                            <button
                              onClick={() => selectIssueDetail(issue.id, "admin")}
                              className="text-xs font-bold text-indigo-600 hover:underline"
                            >
                              Manage
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* AI Predictive Insights — full admin panel */}
              <div id="admin-insights" className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-indigo-50 to-slate-50">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-indigo-600" />
                    <h3 className="text-xs font-extrabold text-slate-700 uppercase tracking-widest">AI Predictive Insights</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    {insights?.generated_at && <span className="text-[9px] text-slate-400">Updated {new Date(insights.generated_at).toLocaleTimeString()}</span>}
                    <button onClick={() => fetchInsights(true)} disabled={insightsLoading} className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 border border-indigo-200 px-2.5 py-1 rounded-lg disabled:opacity-50 cursor-pointer">
                      {insightsLoading ? "Analysing…" : "↻ Refresh"}
                    </button>
                  </div>
                </div>

                {insightsLoading ? (
                  <div className="flex items-center justify-center gap-3 py-12 text-slate-400 text-sm">
                    <div className="w-5 h-5 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" />
                    <span>Generating AI predictions…</span>
                  </div>
                ) : insights?.stats && !insights?.ai ? (
                  <div className="p-5 space-y-4">
                    {insights.ai_error && (
                      <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                        <span className="text-amber-500 shrink-0">⚠️</span>
                        <p className="text-[11px] text-amber-700">{insights.ai_error}</p>
                      </div>
                    )}
                    {insights.stats?.categoryStats && (
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2">Category Breakdown (stats only)</p>
                        <div className="space-y-1.5">
                          {insights.stats.categoryStats.filter((c: any) => c.total > 0).map((c: any) => {
                            const pct = c.total > 0 ? Math.round((c.resolved / c.total) * 100) : 0;
                            return (
                              <div key={c.category} className="flex items-center gap-3">
                                <span className="text-[10px] font-bold text-slate-600 w-24 capitalize shrink-0">{c.category.replace("_", " ")}</span>
                                <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                                  <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${pct}%` }} />
                                </div>
                                <span className="text-[10px] text-slate-400 w-20 text-right shrink-0">{c.resolved}/{c.total} resolved</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                ) : insights?.ai ? (
                  <div className="p-5 space-y-6">
                    {insights.ai_error && (
                      <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                        <span className="text-amber-500 shrink-0">⚠️</span>
                        <p className="text-[11px] text-amber-700">{insights.ai_error}</p>
                      </div>
                    )}
                    {/* Health score + narrative */}
                    <div className="flex items-start gap-4 pb-5 border-b border-slate-100">
                      <div className={`w-16 h-16 rounded-2xl flex flex-col items-center justify-center shrink-0 ${insights.ai.health_score >= 70 ? "bg-emerald-50 border border-emerald-200" : insights.ai.health_score >= 40 ? "bg-amber-50 border border-amber-200" : "bg-rose-50 border border-rose-200"}`}>
                        <span className={`text-xl font-black ${insights.ai.health_score >= 70 ? "text-emerald-600" : insights.ai.health_score >= 40 ? "text-amber-600" : "text-rose-600"}`}>{insights.ai.health_score}</span>
                        <span className="text-[9px] font-bold text-slate-400 uppercase">/ 100</span>
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-extrabold text-slate-700 mb-1.5">Analyst Summary</p>
                        <p className="text-[12px] text-slate-600 leading-relaxed">{insights.ai.narrative || insights.ai.summary}</p>
                      </div>
                    </div>

                    {/* Weekly trend bars */}
                    {insights.stats?.weeklyTrend && (
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-3">Issue Volume — Last 4 Weeks</p>
                        <div className="flex items-end gap-3 h-20">
                          {insights.stats.weeklyTrend.map((w: any, i: number) => {
                            const max = Math.max(...insights.stats.weeklyTrend.map((x: any) => x.total || 0), 1);
                            const h = Math.round((w.total / max) * 100);
                            const isLatest = i === insights.stats.weeklyTrend.length - 1;
                            return (
                              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                                <span className="text-[9px] font-bold text-slate-600">{w.total}</span>
                                <div className={`w-full rounded-t-md transition-all ${isLatest ? "bg-indigo-600" : "bg-indigo-200"}`} style={{ height: `${h}%`, minHeight: w.total > 0 ? "4px" : "0" }} />
                                <span className="text-[9px] text-slate-400">Week {i + 1}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Category breakdown */}
                    {insights.stats?.categoryStats && (
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-3">Resolution Progress by Category</p>
                        <div className="space-y-2">
                          {insights.stats.categoryStats.filter((c: any) => c.total > 0).map((c: any) => {
                            const pct = Math.round((c.resolved / c.total) * 100);
                            return (
                              <div key={c.category} className="flex items-center gap-3">
                                <span className="text-[10px] font-bold text-slate-600 w-24 capitalize shrink-0">{c.category.replace(/_/g, " ")}</span>
                                <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                                  <div className={`h-full rounded-full ${pct === 100 ? "bg-emerald-500" : pct > 50 ? "bg-indigo-500" : "bg-rose-400"}`} style={{ width: `${pct}%` }} />
                                </div>
                                <span className="text-[10px] text-slate-400 w-24 text-right shrink-0">{c.resolved}/{c.total} resolved{c.avg_resolution_days ? ` · ${c.avg_resolution_days}d avg` : ""}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Predictions */}
                    {insights.ai.predictions?.filter((p: any) => p.urgency !== "low" || p.trend !== "stable").length > 0 && (
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-3">30-Day Outlook</p>
                        <div className="space-y-3">
                          {insights.ai.predictions.filter((p: any) => p.trend !== "stable" || p.urgency === "high" || p.urgency === "critical").map((p: any, i: number) => (
                            <div key={i} className={`rounded-xl border p-4 ${p.urgency === "critical" ? "bg-rose-50 border-rose-200" : p.urgency === "high" ? "bg-amber-50 border-amber-200" : "bg-slate-50 border-slate-200"}`}>
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-base">{p.trend === "increasing" ? "📈" : p.trend === "decreasing" ? "📉" : "➡️"}</span>
                                <span className="text-[11px] font-extrabold text-slate-800">{p.headline || p.category.replace(/_/g, " ")}</span>
                                <span className={`ml-auto text-[9px] font-black px-2 py-0.5 rounded-full uppercase ${p.urgency === "critical" ? "bg-rose-200 text-rose-800" : p.urgency === "high" ? "bg-amber-200 text-amber-800" : "bg-slate-200 text-slate-600"}`}>{p.urgency}</span>
                              </div>
                              <p className="text-[11px] text-slate-600 leading-relaxed mb-2">{p.explanation || p.forecast}</p>
                              {(p.suggested_action || p.reason) && (
                                <div className="flex items-start gap-1.5 pt-2 border-t border-slate-200/70">
                                  <span className="text-indigo-500 text-xs shrink-0">→</span>
                                  <p className="text-[11px] text-indigo-700 font-semibold">{p.suggested_action || p.reason}</p>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Risk areas */}
                    {insights.ai.risk_areas?.length > 0 && (
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-3">Areas Requiring Attention</p>
                        <div className="space-y-2">
                          {insights.ai.risk_areas.map((r: any, i: number) => (
                            <div key={i} className="p-4 bg-white border border-slate-200 rounded-xl">
                              <div className="flex items-start justify-between gap-2 mb-1.5">
                                <span className="text-[11px] font-extrabold text-slate-800">{r.area_label || r.description}</span>
                                <span className="text-[9px] font-bold bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full shrink-0">{r.issue_count} issues</span>
                              </div>
                              <p className="text-[11px] text-slate-500 leading-relaxed mb-2">{r.risk_narrative || r.description}</p>
                              <div className="flex items-start gap-1.5 pt-2 border-t border-slate-100">
                                <span className="text-indigo-500 text-xs shrink-0">→</span>
                                <p className="text-[11px] text-indigo-700 font-semibold">{r.recommended_action || r.recommendation}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Key actions */}
                    {(insights.ai.key_actions || insights.ai.recommendations)?.length > 0 && (
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-3">Action Plan</p>
                        <div className="space-y-2">
                          {(insights.ai.key_actions || insights.ai.recommendations.map((r: string) => ({ priority: "this_week", action: r }))).map((a: any, i: number) => (
                            <div key={i} className="flex items-start gap-3 p-3 bg-indigo-50 border border-indigo-100 rounded-xl">
                              <span className={`text-[9px] font-black px-2 py-1 rounded-lg shrink-0 mt-0.5 ${a.priority === "immediate" ? "bg-rose-100 text-rose-700" : a.priority === "this_week" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"}`}>
                                {a.priority === "immediate" ? "NOW" : a.priority === "this_week" ? "THIS WEEK" : "THIS MONTH"}
                              </span>
                              <p className="text-[11px] text-slate-700 font-medium leading-relaxed">{a.action}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="py-10 text-center text-slate-400 text-sm">No insights available. Click Refresh to generate.</div>
                )}
              </div>

            </div>
          )}

          {/* 4. Single Issue Detail view overlay or panel (Unified Details Section) */}
          {selectedIssue && (
            <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-20 md:pb-6 space-y-6 bg-slate-50/50" id="view_issue_detail">
              
              {/* Back button breadcrumb row */}
              <button
                onClick={() => {
                  setActiveTab(referrerTab);
                  setSelectedIssue(null);
                }}
                className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-indigo-600 transition-colors bg-white px-3.5 py-1.5 rounded-xl border border-slate-200/80 w-max"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Back to List Overview</span>
              </button>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Primary detail display */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-xs lg:col-span-2 p-6 space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                    <div>
                      <span className="text-[9px] font-black uppercase tracking-wider bg-slate-100 text-slate-600 px-2.5 py-1 rounded-lg mr-2">
                        {selectedIssue.category}
                      </span>
                      <span className={`text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg ${getStatusBadge(selectedIssue.status)}`}>
                        {selectedIssue.status}
                      </span>
                    </div>

                    <p className="text-xs font-semibold text-slate-400">
                      ID: {selectedIssue.id.toUpperCase()}
                    </p>
                  </div>

                  <div>
                    <h2 className="text-xl font-extrabold text-slate-800 leading-tight">
                      {selectedIssue.title}
                    </h2>
                    <p className="text-xs text-slate-400 font-medium flex items-center gap-1 mt-1">
                      <MapPin className="w-3.5 h-3.5" />
                      <span>{selectedIssue.address} (Coordinates: {selectedIssue.lat.toFixed(4)}, {selectedIssue.lng.toFixed(4)})</span>
                    </p>
                  </div>

                  {/* Main media container */}
                  <div className="rounded-xl overflow-hidden bg-slate-100 border border-slate-200 relative max-h-[380px] flex justify-center items-center">
                    {selectedIssue.image_url ? (
                      selectedIssue.media_type === "video" ? (
                        <video
                          src={selectedIssue.image_url}
                          controls
                          className="w-full max-h-[380px] object-contain bg-slate-950"
                        />
                      ) : (
                        <img
                          src={selectedIssue.image_url}
                          alt={selectedIssue.title}
                          className="w-full h-full object-cover max-h-[380px]"
                        />
                      )
                    ) : (
                      <div className="py-20 text-center text-slate-300">
                        <ImageIcon className="w-12 h-12 mx-auto mb-2" />
                        <span className="text-xs font-bold">No Image/Video Evidence Attached</span>
                      </div>
                    )}
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">Description Detail</h4>
                    <p className="text-sm text-slate-600 leading-relaxed font-medium bg-slate-50 p-4 rounded-xl border border-slate-100">
                      {selectedIssue.description || "The reporter did not provide an extensive textual description. Please reference the category classifications and pinned coordinate location."}
                    </p>
                  </div>

                  {/* Gamified verification box for citizens */}
                  {selectedIssue.status !== "resolved" && selectedIssue.status !== "rejected" && <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div>
                      <h4 className="text-xs font-extrabold text-slate-800">Has this issue been cleared or is it genuine?</h4>
                      <p className="text-[11px] text-slate-400 mt-1 leading-normal">
                        Verify this complaint to confirm validation. Citizens get points for verifying!
                        <br />
                        <span className="text-red-500 font-bold">* You cannot verify your own reported issues.</span>
                      </p>
                    </div>

                    <button
                      onClick={() => handleVerify(selectedIssue.id)}
                      disabled={user ? selectedIssue.reporter_id === user.id : true}
                      className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow-sm hover:bg-indigo-700 disabled:opacity-50 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed flex items-center gap-2 shrink-0 transition-all cursor-pointer"
                    >
                      <Check className="w-4 h-4" />
                      <span>{selectedIssue.verification_count > 0 ? "Toggle Verification" : "Verify Issue (+5 Pts)"}</span>
                    </button>
                  </div>}

                  {/* Chronological Timeline History events */}
                  <div className="space-y-4">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Chronological Timeline & Discussion</h4>
                    
                    <div className="border-l-2 border-indigo-100 pl-4 ml-2 space-y-4 py-1">
                      {timeline.map((ev) => (
                        <div key={ev.id} className="relative">
                          {/* Dot indicator */}
                          <div className="absolute -left-6 top-1.5 w-3.5 h-3.5 rounded-full border-2 border-white bg-indigo-500 shadow-xs"></div>
                          <div className="text-xs">
                            <p className="font-bold text-slate-800">
                              {ev.user_name} ({ev.user_role}){" "}
                              <span className="font-normal text-slate-500">
                                {ev.type === "created" ? "filed this incident" :
                                 ev.type === "status_changed" ? `changed status to "${ev.payload.new}"` :
                                 ev.type === "verified" ? "verified this issue" :
                                 ev.type === "unverified" ? "removed verification" :
                                 "commented:"}
                              </span>
                            </p>
                            
                            {ev.type === "comment" && (
                              <p className="mt-1 text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100 italic">
                                &ldquo;{ev.payload.comment}&rdquo;
                              </p>
                            )}
                            {ev.type === "status_changed" && ev.payload.new === "resolved" && ev.payload.resolution_note && (
                              <div className="mt-2 bg-emerald-50 border border-emerald-200 rounded-xl p-3 space-y-2">
                                <p className="text-[11px] text-emerald-800 font-semibold">{ev.payload.resolution_note}</p>
                                {ev.payload.resolution_image_url && (
                                  <img src={ev.payload.resolution_image_url} alt="Resolution proof" className="w-full max-h-48 object-cover rounded-lg border border-emerald-200" onError={(e) => (e.currentTarget.style.display = "none")} />
                                )}
                              </div>
                            )}

                            <span className="text-[10px] text-slate-400 mt-0.5 inline-block">
                              {new Date(ev.created_at).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Comment box */}
                    {user && selectedIssue.status !== "resolved" && selectedIssue.status !== "rejected" && (
                      <form onSubmit={handleAddComment} className="flex gap-2.5 pt-2">
                        <input
                          type="text"
                          value={newComment}
                          onChange={(e) => setNewComment(e.target.value)}
                          placeholder="Add a comment or operational update..."
                          className="flex-1 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium px-4 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                        <button
                          type="submit"
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
                        >
                          Send
                        </button>
                      </form>
                    )}
                  </div>
                </div>

                {/* Right hand side panels */}
                <div className="space-y-6">
                  
                  {/* AI Metadata Box */}
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
                    <div>
                      <h3 className="text-sm font-extrabold text-slate-800">AI Intake Analysis</h3>
                      <p className="text-[11px] text-slate-400">Classified dynamically at report submission time.</p>
                    </div>

                    <div className="space-y-3.5 border-t border-slate-100 pt-3">
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Confidence Score</p>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-slate-700 capitalize">
                            {selectedIssue.ai_category || selectedIssue.category}
                          </span>
                          <span className="text-emerald-600 font-extrabold text-xs">
                            {selectedIssue.ai_confidence ? `${(selectedIssue.ai_confidence * 100).toFixed(1)}%` : "85%"}
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                          <div
                            className="bg-emerald-500 h-full rounded-full"
                            style={{ width: `${(selectedIssue.ai_confidence || 0.85) * 100}%` }}
                          ></div>
                        </div>
                      </div>

                      {selectedIssue.duplicate_of && (
                        <div className="bg-red-50 p-3 rounded-xl border border-red-100 flex items-start gap-2.5">
                          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-[11px] font-bold text-red-800">Near-distance Duplicate Alert</p>
                            <p className="text-[10px] text-red-600 leading-normal mt-0.5">Another issue of same category was found within 100m. Status tagged to reference duplicate.</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Agent Resolution Plan Pipeline */}
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
                        <Sparkles className="w-4.5 h-4.5 text-indigo-500 fill-indigo-500" />
                        <span>AI Agent: Resolution Pipeline</span>
                      </h3>
                      {user && user.role === "admin" && selectedIssue.status !== "resolved" && selectedIssue.status !== "rejected" && (
                        <button
                          onClick={() => handleRunAgent(selectedIssue.id)}
                          disabled={agentRunningId === selectedIssue.id}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                        >
                          {agentRunningId === selectedIssue.id ? (
                            <span className="animate-spin w-3 h-3 border-2 border-white border-t-transparent rounded-full"></span>
                          ) : (
                            <Sparkles className="w-3 h-3" />
                          )}
                          <span>{selectedIssue.agent_analysis ? "Re-run Agent" : "Run Agent"}</span>
                        </button>
                      )}
                    </div>

                    {selectedIssue.agent_analysis ? (
                      <div className="space-y-4 border-t border-slate-100 pt-3 text-xs">
                        <div className="grid grid-cols-2 gap-2">
                          <div className="bg-indigo-50 p-2.5 rounded-xl border border-indigo-100 text-center">
                            <p className="text-xl font-black text-indigo-600">{selectedIssue.agent_analysis.urgency_score}</p>
                            <p className="text-[9px] text-slate-500 uppercase tracking-widest font-bold">Urgency Score</p>
                          </div>
                          <div className="bg-rose-50 p-2.5 rounded-xl border border-rose-100 text-center">
                            <p className="text-xl font-black text-rose-600 capitalize">{selectedIssue.agent_analysis.severity}</p>
                            <p className="text-[9px] text-slate-500 uppercase tracking-widest font-bold">Severity Level</p>
                          </div>
                        </div>

                        <div>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Target Department</p>
                          <p className="font-bold text-slate-800">{selectedIssue.agent_analysis.resolution_plan.department}</p>
                        </div>

                        <div>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1.5">Action Steps Plan</p>
                          <ul className="space-y-1.5 font-medium text-slate-600">
                            {selectedIssue.agent_analysis.resolution_plan.steps.map((st, i) => (
                              <li key={i} className="flex gap-2">
                                <span className="text-indigo-500 font-bold font-mono">[{i + 1}]</span>
                                <span>{st}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Civic Broadcast Message</p>
                          <p className="text-slate-600 leading-normal italic font-medium">
                            &ldquo;{selectedIssue.agent_analysis.resolution_plan.public_message}&rdquo;
                          </p>
                        </div>

                        {/* Expandable Agent Traces */}
                        <div className="border-t border-slate-100 pt-3">
                          <details className="cursor-pointer">
                            <summary className="text-[10px] text-slate-400 font-bold uppercase tracking-widest hover:text-slate-700 select-none">
                              View Executed Step Traces ({selectedIssue.agent_analysis.steps.length} Steps)
                            </summary>
                            <div className="space-y-2 mt-2 font-mono text-[10px] bg-slate-50 p-3 rounded-xl border border-slate-200 max-h-[180px] overflow-y-auto">
                              {selectedIssue.agent_analysis.steps.map((st: any, i: number) => (
                                <div key={i} className="border-b border-slate-200 pb-2">
                                  <p className="text-emerald-700 font-bold">
                                    Step {st.step}: {st.name} ({st.duration_ms}ms)
                                  </p>
                                  <p className="text-slate-400">Input: {JSON.stringify(st.input)}</p>
                                  <p className="text-slate-600">Output: {typeof st.output === "string" ? st.output : JSON.stringify(st.output)}</p>
                                </div>
                              ))}
                            </div>
                          </details>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-6 text-slate-400 text-xs font-medium">
                        <Clock className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                        <span>AI Agent resolution pathways pending dispatch.</span>
                      </div>
                    )}
                  </div>

                </div>

              </div>
            </div>
          )}

        </main>

        {/* Mobile Bottom Navigation */}
        <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 z-50 md:hidden" id="mobile_bottom_nav">
          <div className="flex h-16">
            <button
              onClick={() => { setActiveTab("home"); setSelectedIssue(null); }}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold transition-colors ${activeTab === "home" ? "text-indigo-600" : "text-slate-400"}`}
            >
              <TrendingUp className="w-5 h-5" />
              <span>Home</span>
            </button>
            <button
              onClick={() => { setActiveTab("map"); setSelectedIssue(null); }}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold transition-colors ${activeTab === "map" ? "text-indigo-600" : "text-slate-400"}`}
            >
              <MapIcon className="w-5 h-5" />
              <span>Map</span>
            </button>
            <button
              onClick={() => {
                if (!user) { setPostLoginAction({ type: "report" }); setShowAuthModal(true); return; }
                setActiveTab("report");
                setSelectedIssue(null);
              }}
              className="flex-1 flex flex-col items-center justify-center"
            >
              <div className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg -mt-6 border-4 border-white ${activeTab === "report" ? "bg-indigo-700" : "bg-indigo-600"}`}>
                <Plus className="w-6 h-6 text-white" />
              </div>
            </button>
            <button
              onClick={() => { setActiveTab("issues"); setSelectedIssue(null); }}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold transition-colors ${activeTab === "issues" ? "text-indigo-600" : "text-slate-400"}`}
            >
              <div className="relative">
                <List className="w-5 h-5" />
                {issues.length > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 text-[8px] bg-indigo-600 text-white rounded-full w-4 h-4 flex items-center justify-center font-black leading-none">
                    {issues.length > 99 ? "99+" : issues.length}
                  </span>
                )}
              </div>
              <span>Issues</span>
            </button>
            <button
              onClick={() => { setActiveTab("dashboard"); setSelectedIssue(null); }}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold transition-colors ${activeTab === "dashboard" ? "text-indigo-600" : "text-slate-400"}`}
            >
              <BarChart2 className="w-5 h-5" />
              <span>Board</span>
            </button>
          </div>
        </nav>
      </div>

      {/* 5. Modal for reporting new civic issues (Citizen Flow) */}
      {showReportModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-end md:items-center justify-center z-50 md:p-4 animate-fade-in" id="report_issue_modal">
          <div className="bg-white rounded-t-2xl md:rounded-2xl border border-slate-200 shadow-2xl w-full md:max-w-2xl h-[92vh] md:h-auto md:max-h-[90vh] overflow-hidden flex flex-col relative">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-gradient-to-r from-indigo-950 via-slate-950 to-purple-955 text-white">
              <div>
                <h3 className="text-base font-extrabold flex items-center gap-2">
                  <Plus className="w-5 h-5 text-indigo-400" />
                  <span>Report an Issue</span>
                </h3>
                <p className="text-xs text-slate-300 mt-0.5">Add details, location, and photo/video proof.</p>
              </div>
              <button
                onClick={() => {
                  setShowReportModal(false);
                  setReportStep(1);
                  setLocationError(null);
                }}
                className="text-slate-400 hover:text-white font-bold text-sm bg-white/10 hover:bg-white/20 w-8 h-8 rounded-full flex items-center justify-center transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Single-page form */}
            <div className="p-6 overflow-y-auto flex-1 relative min-h-[400px]">
              {renderSinglePageReportForm(true, () => setShowReportModal(false))}
            </div>

          </div>
        </div>
      )}

      {/* 5. Modal for reporting new civic issues (Citizen Flow) - Deprecated */}
      {false && showReportModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4" id="report_issue_modal_old">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto flex flex-col">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-base font-extrabold text-slate-800">File Local Civic Complaint</h3>
                <p className="text-xs text-slate-400">Complete standard fields. AI will categorize and check for spatial duplicates upon click.</p>
              </div>
              <button
                onClick={() => setShowReportModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-sm"
              >
                ✕
              </button>
            </div>

            {/* Modal form */}
            <form onSubmit={handleCreateIssue} className="p-6 space-y-4 flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* General parameters */}
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Issue Title / Subject</label>
                    <input
                      type="text"
                      required
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      placeholder="e.g., Huge pothole in service lane"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Category Classification</label>
                    <select
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value as Issue["category"])}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700"
                    >
                      <option value="pothole">Pothole</option>
                      <option value="garbage">Garbage Pile</option>
                      <option value="water_leakage">Water Leakage</option>
                      <option value="streetlight">Non-functional Streetlight</option>
                      <option value="drain">Blocked Drain</option>
                      <option value="other">Other Defect</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Detailed Description</label>
                    <textarea
                      rows={3}
                      value={newDescription}
                      onChange={(e) => setNewDescription(e.target.value)}
                      placeholder="Describe hazards, severity level, or nearby landmarks..."
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium"
                    ></textarea>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Media Format Type</label>
                    <div className="flex gap-4">
                      <label className="inline-flex items-center gap-1.5 text-xs font-semibold cursor-pointer text-slate-700">
                        <input
                          type="radio"
                          name="mediaType"
                          checked={newMediaType === "image"}
                          onChange={() => setNewMediaType("image")}
                        />
                        <span>Photo Attachment</span>
                      </label>
                      <label className="inline-flex items-center gap-1.5 text-xs font-semibold cursor-pointer text-slate-700">
                        <input
                          type="radio"
                          name="mediaType"
                          checked={newMediaType === "video"}
                          onChange={() => setNewMediaType("video")}
                        />
                        <span>Video Snippet</span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Spatial Mapping parameters */}
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Pushed Address / Landmark</label>
                    <input
                      type="text"
                      value={newAddress}
                      onChange={(e) => setNewAddress(e.target.value)}
                      placeholder="e.g., 80 Feet Road near Koramangala 4th Block"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Latitude</label>
                      <input
                        type="number"
                        step="0.0001"
                        required
                        value={newLat}
                        onChange={(e) => setNewLat(parseFloat(e.target.value))}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Longitude</label>
                      <input
                        type="number"
                        step="0.0001"
                        required
                        value={newLng}
                        onChange={(e) => setNewLng(parseFloat(e.target.value))}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold font-mono"
                      />
                    </div>
                  </div>

                  {hasValidKey && (
                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-slate-500">Form Map Location Picker</label>
                      <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm" style={{ height: "160px" }}>
                        <APIProvider apiKey={GOOGLE_MAPS_API_KEY} version="weekly">
                          <Map
                            defaultCenter={{ lat: newLat || 12.9716, lng: newLng || 77.5946 }}
                            defaultZoom={14}
                            mapId="MINI_PICKER_MAP"
                            options={{
                              styles: DARK_MAP_STYLE,
                              disableDefaultUI: true,
                              zoomControl: true,
                            }}
                            internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                            style={{ width: "100%", height: "100%" }}
                            onClick={(e) => {
                              if (e.detail.latLng) {
                                const lat = Math.round(e.detail.latLng.lat * 100000) / 100000;
                                const lng = Math.round(e.detail.latLng.lng * 100000) / 100000;
                                setNewLat(lat);
                                setNewLng(lng);
                              }
                            }}
                          >
                            <AdvancedMarker
                              position={{ lat: newLat || 12.9716, lng: newLng || 77.5946 }}
                            />
                          </Map>
                        </APIProvider>
                      </div>
                      <p className="text-[9px] text-slate-400 font-medium">Click on the mini map to adjust coordinates</p>
                    </div>
                  )}

                  {/* Preset Evidence selector */}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Visual Evidence (Pre-rendered presets)</label>
                    <div className="flex gap-2 mb-2">
                      <button
                        type="button"
                        onClick={() => setImageUploadOption("file")}
                        className={`flex-1 py-1 px-2 text-[10px] font-bold rounded ${imageUploadOption === "file" ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600"}`}
                      >
                        Upload Real File
                      </button>
                      <button
                        type="button"
                        onClick={() => setImageUploadOption("preset")}
                        className={`flex-1 py-1 px-2 text-[10px] font-bold rounded ${imageUploadOption === "preset" ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600"}`}
                      >
                        Indian Preset Files
                      </button>
                      <button
                        type="button"
                        onClick={() => setImageUploadOption("url")}
                        className={`flex-1 py-1 px-2 text-[10px] font-bold rounded ${imageUploadOption === "url" ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600"}`}
                      >
                        Custom URL Link
                      </button>
                    </div>

                    {imageUploadOption === "file" ? (
                      <div
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          const file = e.dataTransfer.files?.[0];
                          if (file) {
                            if (file.size > 50 * 1024 * 1024) {
                              alert("File size exceeds 50MB limit!");
                              return;
                            }
                            setSelectedFile(file);
                          }
                        }}
                        className="border-2 border-dashed border-slate-200 rounded-xl p-4 text-center cursor-pointer hover:bg-slate-50 transition"
                        onClick={() => {
                          const input = document.createElement("input");
                          input.type = "file";
                          input.accept = "image/*,video/*";
                          input.onchange = (e: any) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              if (file.size > 50 * 1024 * 1024) {
                                alert("File size exceeds 50MB limit!");
                                return;
                              }
                              setSelectedFile(file);
                            }
                          };
                          input.click();
                        }}
                      >
                        {selectedFile ? (
                          <div className="text-xs">
                            <p className="font-bold text-indigo-600">Selected File: {selectedFile.name}</p>
                            <p className="text-slate-400 mt-1">{(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • {selectedFile.type.startsWith("video/") ? "Video" : "Image"}</p>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedFile(null);
                              }}
                              className="mt-2 text-[10px] text-red-500 hover:underline font-bold"
                            >
                              Clear File
                            </button>
                          </div>
                        ) : (
                          <div className="text-xs text-slate-500">
                            <p className="font-bold">Click or Drag & Drop image/video</p>
                            <p className="text-[10px] text-slate-400 mt-1">Supports images & videos up to 50MB</p>
                          </div>
                        )}
                      </div>
                    ) : imageUploadOption === "preset" ? (
                      <select
                        value={newImageUrl}
                        onChange={(e) => setNewImageUrl(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700"
                      >
                        <option value="">Select a preset civic photo...</option>
                        {UNSPLASH_PRESETS.map((p) => (
                          <option key={p.url} value={p.url}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={newImageUrl}
                        onChange={(e) => setNewImageUrl(e.target.value)}
                        placeholder="https://images.unsplash.com/..."
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold"
                      />
                    )}
                  </div>
                </div>

              </div>

              {/* Duplicate Detection Live warning feedback */}
              {duplicateWarning && (
                <div className="p-3.5 bg-red-50 rounded-xl border border-red-100 flex items-start gap-2.5">
                  <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <p className="font-bold text-red-800">Potential Duplicate Detected! ⚠️</p>
                    <p className="text-red-600 mt-0.5 leading-normal">
                      Another active issue titled <span className="font-bold">&ldquo;{duplicateWarning.title}&rdquo;</span> already exists within 100 meters of this exact location! We recommend reviewing or verifying that issue instead. If you submit, this report will be grouped automatically.
                    </p>
                  </div>
                </div>
              )}

              {/* Footer action bar */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowReportModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUploading}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 text-white rounded-xl text-xs font-bold shadow-md"
                >
                  {isUploading ? "Uploading Evidence..." : "Submit Civic Report"}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* Auth Modal (Login / Signup) */}
      {showAuthModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in" id="auth_modal">
          <div className="bg-slate-900 rounded-2xl border border-slate-750 shadow-2xl w-full max-w-md overflow-hidden flex flex-col p-6 space-y-4 text-slate-100 relative">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-sm">
                  <Shield className="w-4.5 h-4.5 text-white" />
                </div>
                <h3 className="text-lg font-extrabold text-white">
                  {isRegistering ? "Create your account" : "Welcome to Community Hero"}
                </h3>
              </div>
              <button
                onClick={() => { setShowAuthModal(false); setAuthError(""); setShowPassword(false); }}
                className="text-slate-400 hover:text-slate-200 font-bold text-sm"
              >
                ✕
              </button>
            </div>

            {authError && (
              <div className="bg-rose-500/10 border border-rose-500/25 text-rose-200 text-xs p-3 rounded-xl flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <p>{authError}</p>
              </div>
            )}

            <form onSubmit={isRegistering ? handleRegister : handleLogin} className="space-y-4">
              {isRegistering && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider" htmlFor="modal_name">
                    Full Name
                  </label>
                  <input
                    id="modal_name"
                    type="text"
                    required
                    placeholder="Arjun Mehta"
                    value={authName}
                    onChange={(e) => setAuthName(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-950/50 border border-slate-750 rounded-xl focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-white placeholder-slate-500 focus:outline-none transition-all text-xs"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider" htmlFor="modal_email">
                  Email Address
                </label>
                <input
                  id="modal_email"
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-950/50 border border-slate-750 rounded-xl focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-white placeholder-slate-500 focus:outline-none transition-all text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider" htmlFor="modal_password">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="modal_password"
                    type={showPassword ? "text" : "password"}
                    required
                    placeholder="••••••••"
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    className="w-full px-4 py-2 pr-10 bg-slate-950/50 border border-slate-750 rounded-xl focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-white placeholder-slate-500 focus:outline-none transition-all text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={authLoading}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/50 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-indigo-500/10 focus:outline-none transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {authLoading ? (
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                ) : isRegistering ? (
                  "Create Account"
                ) : (
                  "Sign In"
                )}
              </button>
            </form>

            <div className="text-center pt-1.5">
              <button
                type="button"
                onClick={() => {
                  setIsRegistering(!isRegistering);
                  setAuthError("");
                }}
                className="text-indigo-400 hover:text-indigo-300 text-xs font-medium transition-all cursor-pointer"
              >
                {isRegistering ? "Already have an account? Sign In" : "Don't have an account? Sign Up"}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Resolution proof modal */}
      {resolutionModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md flex flex-col overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <p className="text-sm font-extrabold text-slate-800">Mark as Resolved</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Provide proof of resolution before closing this issue</p>
              </div>
              <button onClick={() => setResolutionModal(null)} className="text-slate-400 hover:text-slate-600 text-lg leading-none">✕</button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Resolution Note <span className="text-rose-500">*</span></label>
                <textarea
                  value={resolutionNote}
                  onChange={(e) => setResolutionNote(e.target.value)}
                  placeholder="Describe what was done to fix this issue (e.g., pothole filled by BBMP crew on 28 Jun)..."
                  rows={3}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl px-3.5 py-2.5 text-xs font-medium focus:outline-none resize-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Proof Photo / Video <span className="text-slate-300">(optional)</span></label>
                {resolutionImageUrl ? (
                  <div className="relative rounded-xl overflow-hidden border border-emerald-200">
                    <img src={resolutionImageUrl} alt="Proof" className="w-full max-h-40 object-cover" onError={(e) => (e.currentTarget.style.display = "none")} />
                    <button onClick={() => setResolutionImageUrl("")} className="absolute top-2 right-2 bg-black/50 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs">✕</button>
                  </div>
                ) : (
                  <label className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-200 rounded-xl py-5 cursor-pointer hover:border-indigo-300 hover:bg-indigo-50/30 transition-all ${resolutionUploading ? "opacity-50 pointer-events-none" : ""}`}>
                    {resolutionUploading ? (
                      <div className="w-5 h-5 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" />
                    ) : (
                      <>
                        <Camera className="w-6 h-6 text-slate-400" />
                        <span className="text-[11px] text-slate-500 font-medium">Tap to upload photo or video</span>
                        <span className="text-[10px] text-slate-400">Camera · Gallery · Files</span>
                      </>
                    )}
                    <input
                      type="file"
                      accept="image/*,video/*"
                      capture="environment"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setResolutionUploading(true);
                        try {
                          const formData = new FormData();
                          formData.append("file", file);
                          const token = localStorage.getItem("sb_token");
                          const res = await fetch("/api/upload", { method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : {}, body: formData });
                          const data = await res.json();
                          if (data.url) setResolutionImageUrl(data.url);
                        } catch { } finally {
                          setResolutionUploading(false);
                        }
                      }}
                    />
                  </label>
                )}
              </div>
            </div>
            <div className="p-5 border-t border-slate-100 flex gap-3">
              <button onClick={() => setResolutionModal(null)} className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50 transition-all">Cancel</button>
              <button
                disabled={!resolutionNote.trim()}
                onClick={() => {
                  handleAdminStatusChange(resolutionModal.issueId, resolutionModal.pendingStatus, resolutionNote.trim(), resolutionImageUrl.trim() || undefined);
                  setResolutionModal(null);
                }}
                className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold transition-all"
              >Confirm Resolution</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
