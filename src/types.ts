export type MessageType = 'text' | 'image' | 'video' | 'audio' | 'document' | 'file';

export interface Message {
  id: string;
  created_at: string;
  type: MessageType;
  content: string;
  username: string;
  recipient_username?: string | null;
  status?: 'sent' | 'delivered' | 'read';
  is_edited?: boolean;
  read_by?: string[];
  avatar?: string;
  file_name?: string;
  file_size?: number;
  reply_to?: {
    id: string;
    username: string;
    content: string;
    type: MessageType;
    file_name?: string;
  } | null;
  reactions?: Record<string, string[]>;
}

export interface UserProfile {
  id?: string;
  username: string;
  email?: string;
  phone?: string;
  bio?: string;
  password?: string;
  avatar_url?: string;
  last_seen?: string;
  blocked_usernames?: string[];
}

export interface OnlineUser {
  username: string;
  avatar?: string;
  onlineAt?: string;
}

export interface BanAppeal {
  username: string;
  message: string;
  created_at: string;
}

export interface GroupSettings {
  id: number;
  name: string;
  description: string;
  avatar_url: string | null;
  owner_username: string;
  admin_usernames: string[];
  leader_usernames?: string[];
  banned_usernames?: string[];
  ban_appeals?: BanAppeal[];
}
export interface UserDailyStats { id?: string; date: string; username: string; active_seconds: number; total_clicks: number; messages_sent: number; }

export interface Lead {
  id?: string;
  created_at?: string;
  business_name: string;
  website?: string;
  phone?: string;
  email?: string;
  instagram?: string;
  facebook?: string;
  linkedin?: string;
  social_links?: string;
  rating?: string;
  location?: string;
  notes?: string;
  assigned_to: string;
  status: 'new' | 'contacted' | 'interested' | 'not_interested' | 'closed';
  added_by: string;
  copied_count?: number;
  assigned_date?: string;
  last_updated_at?: string;
  deal_value?: number;
  whatsapp?: string;
}

export interface LeadActivityLog {
  id?: string;
  created_at: string;
  lead_id?: string;
  lead_name: string;
  username: string;
  action: 'distributed' | 'copied' | 'status_changed' | 'closed' | 'reassigned';
  details?: string;
}

export type AttendanceStatus = 'present' | 'absent' | 'leave' | 'half_day';

export interface AttendanceRecord {
  id?: string;
  date: string; // YYYY-MM-DD
  username: string;
  status: AttendanceStatus;
  first_active_at?: string | null;
  last_active_at?: string | null;
  active_seconds?: number;
  total_clicks?: number;
  messages_sent?: number;
  leads_processed?: number;
  notes?: string;
  marked_by?: string;
  updated_at?: string;
}

export type LeaveType = 'casual' | 'sick' | 'annual' | 'emergency' | 'half_day';
export type LeaveStatus = 'pending' | 'approved' | 'rejected';

export interface LeaveRequest {
  id?: string;
  username: string;
  start_date: string; // YYYY-MM-DD
  end_date: string;   // YYYY-MM-DD
  leave_type: LeaveType;
  reason: string;
  status: LeaveStatus;
  admin_notes?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  created_at: string;
}

