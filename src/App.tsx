/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from './supabase';
import { Message, GroupSettings, UserProfile, OnlineUser, BanAppeal, MessageType, UserDailyStats, CompanyRole, ROLE_HIERARCHY } from './types';
import { Send, Image as ImageIcon, User, Bell, BellOff, BellRing, Volume2, VolumeX, Edit2, Trash2, Check, CheckCheck, X, Info, Copy, ExternalLink, Reply, Settings, Camera, Loader2, Shield, ShieldAlert, ShieldCheck, GraduationCap, Crown, Users, Lock, Mail, Phone, FileText, LogOut, Eye, EyeOff, Clock, Circle, Ban, UserX, UserCheck, UserMinus, AlertTriangle, Mic, MicOff, Play, Pause, Download, Video as VideoIcon, Music, Paperclip, Plus, FileArchive, Star, Sparkles, ShoppingBag, Gift, Activity, BarChart2, Search, Forward, SmilePlus, PhoneCall, PhoneOff, Briefcase, MoreVertical, ArrowLeft } from 'lucide-react';
import { uploadToCloudinary, getCloudinaryDownloadUrl } from './lib/cloudinary';
import { LeadManagement } from './components/LeadManagement';
import { OwnerDashboard } from './components/dashboard/OwnerDashboard';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { getUserRole, canManageUser, getAllowedAssignableRoles, applyRoleChange, ROLE_DETAILS } from './lib/roleHierarchy';

const renderMessageContent = (content: string) => {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = content.split(urlRegex);
  return parts.map((part, i) => {
    if (part.match(urlRegex)) {
      return (
        <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-cyan-300 hover:text-cyan-400 hover:underline inline-flex items-center gap-1 break-all" onClick={(e) => e.stopPropagation()}>
          {part}
          <ExternalLink className="w-3 h-3 flex-shrink-0 inline" />
        </a>
      );
    }
    return part;
  });
};



export default function App() {
  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const saved = localStorage.getItem('chat_messages');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to parse local messages', e);
    }
    return [];
  });
  const [inputMessage, setInputMessage] = useState('');
  const [username, setUsername] = useState(() => localStorage.getItem('chat_username') || '');
  const [userAvatar, setUserAvatar] = useState(() => localStorage.getItem('chat_avatar') || '');
  const [userEmail, setUserEmail] = useState(() => localStorage.getItem('chat_email') || '');
  const [userPhone, setUserPhone] = useState(() => localStorage.getItem('chat_phone') || '');
  const [userBio, setUserBio] = useState(() => localStorage.getItem('chat_bio') || '');
  const [userPassword, setUserPassword] = useState(() => localStorage.getItem('chat_password') || '');
  const [isJoined, setIsJoined] = useState(() => !!localStorage.getItem('chat_username'));

  // Auth / Login states
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regBio, setRegBio] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [showAuthPassword, setShowAuthPassword] = useState(false);
  const [authError, setAuthError] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const [onlineUsersCount, setOnlineUsersCount] = useState(0);
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    try {
      return localStorage.getItem('chat_notifications') === 'true' || (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted');
    } catch {
      return false;
    }
  });
  const [soundEnabled, setSoundEnabled] = useState(() => {
    try {
      return localStorage.getItem('chat_sound') !== 'false';
    } catch {
      return true;
    }
  });
  const [inAppToastsEnabled, setInAppToastsEnabled] = useState(() => {
    try {
      return localStorage.getItem('chat_in_app_toasts') !== 'false';
    } catch {
      return true;
    }
  });
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [toastNotification, setToastNotification] = useState<{
    id: string;
    sender: string;
    avatar?: string;
    content: string;
    type: MessageType;
    isPrivate: boolean;
    targetUsername?: string;
    timestamp: string;
  } | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<Message | null>(null);
  const [viewProfileUser, setViewProfileUser] = useState<UserProfile | null>(null);
  const [activePrivateUser, setActivePrivateUser] = useState<string | null>(null);

  // Moderation & Block states
  const [blockedUsers, setBlockedUsers] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('chat_blocked_users');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [appealInput, setAppealInput] = useState('');
  const [appealSubmittedSuccess, setAppealSubmittedSuccess] = useState(false);
  const [isSubmittingAppeal, setIsSubmittingAppeal] = useState(false);

  // Settings Modal states
  const [showSettings, setShowSettings] = useState(false);
  const [settingsUsername, setSettingsUsername] = useState('');
  const [settingsEmail, setSettingsEmail] = useState('');
  const [settingsPhone, setSettingsPhone] = useState('');
  const [settingsBio, setSettingsBio] = useState('');
  const [settingsPassword, setSettingsPassword] = useState('');
  const [showSettingsPassword, setShowSettingsPassword] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [activeMessageId, setActiveMessageId] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [groupSettings, setGroupSettings] = useState<GroupSettings | null>(null);
  const activeGroupSettings: GroupSettings = useMemo(() => {
    return groupSettings || {
      id: 1,
      name: 'Global Chat',
      description: 'Welcome to the global chat room!',
      avatar_url: null,
      owner_username: '',
      admin_usernames: [],
      leader_usernames: []
    };
  }, [groupSettings]);
  const [showGroupSettings, setShowGroupSettings] = useState(false);
  const [editGroupForm, setEditGroupForm] = useState({ name: '', description: '' });
  const [isUploadingGroupAvatar, setIsUploadingGroupAvatar] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [onlineUsersList, setOnlineUsersList] = useState<OnlineUser[]>([]);
  const [groupMembers, setGroupMembers] = useState<UserProfile[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaFileInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const groupAvatarInputRef = useRef<HTMLInputElement>(null);
  const channelRef = useRef<any>(null);
  const typingUsersTimeoutsRef = useRef<{ [key: string]: NodeJS.Timeout }>({});

  // Analytics states
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showLeadManagement, setShowLeadManagement] = useState(false);
  const [showOwnerDashboard, setShowOwnerDashboard] = useState(false);
  const [analyticsData, setAnalyticsData] = useState<UserDailyStats[]>([]);
  const [totalTeamMembers, setTotalTeamMembers] = useState(0);

  // New Feature States
  const [searchQuery, setSearchQuery] = useState('');
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [forwardingMessage, setForwardingMessage] = useState<Message | null>(null);
  const [showForwardModal, setShowForwardModal] = useState(false);
  
  // Call States
  const [incomingCall, setIncomingCall] = useState<{ from: string, type: 'audio' | 'video', signalData: any } | null>(null);
  const [activeCall, setActiveCall] = useState<{ with: string, type: 'audio' | 'video', isCaller: boolean } | null>(null);
  const [showCallModal, setShowCallModal] = useState(false);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  // Tracking refs (we use refs to avoid interval dependency hell)
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);
  const statsRef = useRef({ clicks: 0, seconds: 0, messages: 0, isFocused: true });
  const typingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isSelfTypingRef = useRef<boolean>(false);

  // Cloudinary Media & Voice Note states
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState('');
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [attachmentAcceptType, setAttachmentAcceptType] = useState('image/*');
  const [selectedMediaType, setSelectedMediaType] = useState<'image' | 'video' | 'audio' | 'document' | 'file'>('image');
  const [downloadingFileId, setDownloadingFileId] = useState<string | null>(null);

  // Voice Recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [mediaErrorToast, setMediaErrorToast] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-dismiss media error notice
  useEffect(() => {
    if (mediaErrorToast) {
      const timer = setTimeout(() => {
        setMediaErrorToast(null);
      }, 7000);
      return () => clearTimeout(timer);
    }
  }, [mediaErrorToast]);

  // Dynamically assign ONLY the very first registered user as CEO.
  // All other users (2nd, 3rd, 4th, etc.) are strictly regular Employees.
  const claimCeoIfUnassigned = async (candidateUsername: string): Promise<boolean> => {
    const cleanCand = candidateUsername.trim();
    if (!cleanCand) return false;
    const candLower = cleanCand.toLowerCase();

    try {
      // 1. Check local storage or active settings for an already established CEO
      const localCeo = (localStorage.getItem('chat_company_ceo') || '').trim();
      const existingOwner = (activeGroupSettings.owner_username || '').trim();

      if (localCeo && localCeo.toLowerCase() !== 'mr saqib' && localCeo.toLowerCase() !== candLower) {
        return false;
      }
      if (existingOwner && existingOwner.toLowerCase() !== 'mr saqib' && existingOwner.toLowerCase() !== candLower) {
        localStorage.setItem('chat_company_ceo', existingOwner);
        return false;
      }

      // 2. Query Supabase group_settings
      const { data: dbSettings } = await supabase.from('group_settings').select('*').eq('id', 1).maybeSingle();
      const dbOwner = (dbSettings?.owner_username || '').trim();
      if (dbOwner && dbOwner.toLowerCase() !== 'mr saqib') {
        localStorage.setItem('chat_company_ceo', dbOwner);
        if (dbOwner.toLowerCase() !== candLower) {
          return false;
        }
      }

      // 3. Query Supabase user_profiles to verify if candidate is the earliest user
      const { data: allProfiles } = await supabase
        .from('user_profiles')
        .select('username, created_at')
        .order('created_at', { ascending: true });

      if (allProfiles && allProfiles.length > 0) {
        const firstEverUser = allProfiles[0].username?.trim();
        if (firstEverUser && firstEverUser.toLowerCase() !== candLower) {
          localStorage.setItem('chat_company_ceo', firstEverUser);
          if (!dbOwner || dbOwner.toLowerCase() === 'mr saqib') {
            await supabase.from('group_settings').update({ owner_username: firstEverUser }).eq('id', 1);
          }
          return false;
        }
      }

      // 4. Candidate is the verified first user!
      const existingAdmins = (dbSettings?.admin_usernames || []).filter((u: string) => u.toLowerCase() !== 'mr saqib');
      const updated: GroupSettings = {
        id: 1,
        name: dbSettings?.name || activeGroupSettings.name || 'Global Chat',
        description: dbSettings?.description || activeGroupSettings.description || 'Welcome to the global chat room!',
        avatar_url: dbSettings?.avatar_url || activeGroupSettings.avatar_url || null,
        owner_username: cleanCand,
        admin_usernames: Array.from(new Set([...existingAdmins, cleanCand])),
        leader_usernames: dbSettings?.leader_usernames || [],
        user_roles: {
          ...(dbSettings?.user_roles || {}),
          [candLower]: 'ceo'
        },
        banned_usernames: dbSettings?.banned_usernames || []
      };

      setGroupSettings(updated);
      localStorage.setItem('chat_group_settings', JSON.stringify(updated));
      localStorage.setItem('chat_company_ceo', cleanCand);

      try {
        await supabase.from('group_settings').upsert(updated);
        await supabase.from('user_profiles').update({ role: 'ceo' }).eq('username', cleanCand);
      } catch {}

      try {
        broadcastChannelRef.current?.postMessage({
          type: 'ANNOUNCE_CEO',
          payload: { owner_username: cleanCand, groupSettings: updated }
        });
      } catch {}

      setMediaErrorToast(`👑 Welcome @${cleanCand}! You have been designated as the CEO of this company.`);
      return true;
    } catch (err) {
      console.warn('claimCeo error:', err);
    }
    return false;
  };

  // PWA (Progressive Web App) States
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);

  // Coins, Shop, and Starred Messages (Local Cache System)
  const [starredIds, setStarredIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('chat_starred_ids');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [showStarredDrawer, setShowStarredDrawer] = useState(false);

  // Periodic timer for live last_seen and online status relative time updates
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 10000);
    return () => clearInterval(timer);
  }, []);

  // Title flashing and unread counter synchronization
  useEffect(() => {
    const handleVisibilityAndFocus = () => {
      if (document.visibilityState === 'visible') {
        setUnreadNotificationCount(0);
        document.title = activeGroupSettings.name ? `${activeGroupSettings.name} • Chat` : 'Global Chat';
      }
    };

    window.addEventListener('visibilitychange', handleVisibilityAndFocus);
    window.addEventListener('focus', handleVisibilityAndFocus);
    return () => {
      window.removeEventListener('visibilitychange', handleVisibilityAndFocus);
      window.removeEventListener('focus', handleVisibilityAndFocus);
    };
  }, [activeGroupSettings?.name]);

  useEffect(() => {
    if (unreadNotificationCount <= 0) {
      document.title = activeGroupSettings.name ? `${activeGroupSettings.name} • Chat` : 'Global Chat';
      return;
    }

    let isAlternate = false;
    const interval = setInterval(() => {
      isAlternate = !isAlternate;
      document.title = isAlternate
        ? `(${unreadNotificationCount}) 💬 New Message!`
        : `${activeGroupSettings.name || 'Global Chat'}`;
    }, 1000);

    return () => {
      clearInterval(interval);
      document.title = activeGroupSettings.name ? `${activeGroupSettings.name} • Chat` : 'Global Chat';
    };
  }, [unreadNotificationCount, activeGroupSettings?.name]);

  // Auto-sync current user profile and avatar whenever username is active
  useEffect(() => {
    if (!username) return;
    const syncCurrentProfile = async () => {
      try {
        const { data } = await supabase
          .from('user_profiles')
          .select('*')
          .ilike('username', username)
          .maybeSingle();
        if (data) {
          if (data.avatar_url && data.avatar_url !== userAvatar) {
            setUserAvatar(data.avatar_url);
            localStorage.setItem('chat_avatar', data.avatar_url);
          }
          if (data.bio && !userBio) {
            setUserBio(data.bio);
            localStorage.setItem('chat_bio', data.bio);
          }
          if (data.email && !userEmail) {
            setUserEmail(data.email);
            localStorage.setItem('chat_email', data.email);
          }
          if (data.phone && !userPhone) {
            setUserPhone(data.phone);
            localStorage.setItem('chat_phone', data.phone);
          }
        }
      } catch (err) {
        console.warn('Could not sync current user profile:', err);
      }
    };
    syncCurrentProfile();
  }, [username]);

  // Sync state functions
  useEffect(() => {
    localStorage.setItem('chat_starred_ids', JSON.stringify(starredIds));
  }, [starredIds]);

  const toggleStarMessage = (id: string) => {
    setStarredIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(x => x !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  // Daily Login Date Check
  useEffect(() => {
    if (!isJoined || !username) return;
    const lastLogin = localStorage.getItem('chat_last_login_date');
    const today = new Date().toDateString();
    if (lastLogin !== today) {
      localStorage.setItem('chat_last_login_date', today);
    }
  }, [isJoined, username]);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      // Prevent the mini-infobar from automatically appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later by the user
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Check if the app is already running in standalone (installed) mode
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstallable(false);
    }

    const handleAppInstalled = () => {
      console.log('PWA installed successfully');
      setDeferredPrompt(null);
      setIsInstallable(false);
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallApp = async () => {
    if (!deferredPrompt) return;
    try {
      // Show the native browser install prompt
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`User response to the PWA install prompt: ${outcome}`);
    } catch (err) {
      console.error('PWA install prompt error:', err);
    } finally {
      // Clear the deferred prompt, it can only be prompted once
      setDeferredPrompt(null);
      setIsInstallable(false);
    }
  };

  useEffect(() => {
    try {
      if (messages.length > 0) {
        const messagesToSave = messages.slice(-200);
        localStorage.setItem('chat_messages', JSON.stringify(messagesToSave));
      }
    } catch (e) {
      console.warn('LocalStorage save error:', e);
    }
  }, [messages]);

  // Cross-tab real-time communication via BroadcastChannel
  useEffect(() => {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      const bc = new BroadcastChannel('global_company_chat');
      broadcastChannelRef.current = bc;

      bc.onmessage = (event) => {
        try {
          const { type, payload } = event.data || {};
          if (type === 'NEW_MESSAGE' && payload) {
            setMessages((prev) => {
              if (prev.some((m) => m.id === payload.id)) return prev;
              const next = [...prev, payload];
              try {
                localStorage.setItem('chat_messages', JSON.stringify(next.slice(-200)));
              } catch {}
              return next;
            });
            if (payload.username?.toLowerCase() !== (username || '').toLowerCase()) {
              triggerIncomingNotification(payload);
            }
          } else if (type === 'DELETE_MESSAGE' && payload?.id) {
            setMessages((prev) => prev.filter((m) => m.id !== payload.id));
          } else if (type === 'UPDATE_MESSAGE' && payload) {
            setMessages((prev) =>
              prev.map((m) => (m.id === payload.id ? { ...m, ...payload } : m))
            );
          } else if (type === 'REACTION' && payload) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === payload.messageId ? { ...m, reactions: payload.reactions } : m
              )
            );
          } else if (type === 'ROLE_UPDATE' && payload?.updatedSettings) {
            setGroupSettings(payload.updatedSettings);
            try {
              localStorage.setItem('chat_group_settings', JSON.stringify(payload.updatedSettings));
              if (payload.updatedSettings.owner_username) {
                localStorage.setItem('chat_company_ceo', payload.updatedSettings.owner_username);
              }
            } catch {}
          } else if (type === 'KICKED_FROM_COMPANY' && payload?.username?.toLowerCase() === (username || '').toLowerCase()) {
            handleLogout();
            alert('You have been removed from the company by administration.');
          } else if (type === 'WHO_IS_CEO') {
            const knownCeo = activeGroupSettings.owner_username || localStorage.getItem('chat_company_ceo');
            if (knownCeo) {
              bc.postMessage({
                type: 'ANNOUNCE_CEO',
                payload: { owner_username: knownCeo, groupSettings: activeGroupSettings }
              });
            }
          } else if (type === 'ANNOUNCE_CEO' && payload?.owner_username) {
            localStorage.setItem('chat_company_ceo', payload.owner_username);
            if (!activeGroupSettings.owner_username || activeGroupSettings.owner_username === 'Mr Saqib') {
              setGroupSettings((prev) => ({
                ...prev,
                owner_username: payload.owner_username,
                ...(payload.groupSettings ? payload.groupSettings : {})
              }));
            }
          }
        } catch (e) {
          console.warn('BroadcastChannel error:', e);
        }
      };

      // Query any existing active tab for current CEO
      try {
        bc.postMessage({ type: 'WHO_IS_CEO' });
      } catch {}

      return () => {
        bc.close();
      };
    }
  }, [username]);

  useEffect(() => {
    if (!isJoined) return;

    const fetchGroupSettings = async () => {
      const local = localStorage.getItem('chat_group_settings');
      let currentLocal: GroupSettings | null = null;
      if (local) {
        try {
          currentLocal = JSON.parse(local);
          if (currentLocal) {
            if (currentLocal.owner_username?.toLowerCase() === 'mr saqib') {
              currentLocal.owner_username = '';
              currentLocal.admin_usernames = (currentLocal.admin_usernames || []).filter(u => u.toLowerCase() !== 'mr saqib');
            }
            setGroupSettings(currentLocal);
          }
        } catch (e) {}
      }

      try {
        const { data, error } = await supabase.from('group_settings').select('*').eq('id', 1).maybeSingle();
        if (!error && data) {
          const settings = data as GroupSettings;
          if (settings.owner_username?.toLowerCase() === 'mr saqib') {
            settings.owner_username = '';
            settings.admin_usernames = (settings.admin_usernames || []).filter(u => u.toLowerCase() !== 'mr saqib');
          }
          if (settings.owner_username) {
            localStorage.setItem('chat_company_ceo', settings.owner_username);
          }
          setGroupSettings(settings);
          localStorage.setItem('chat_group_settings', JSON.stringify(settings));

          if ((!settings.owner_username || settings.owner_username.trim() === '') && username) {
            await claimCeoIfUnassigned(username);
          }
        } else if (!currentLocal) {
          const knownCeo = localStorage.getItem('chat_company_ceo') || '';
          const initial: GroupSettings = {
            id: 1,
            name: 'Global Chat',
            description: 'Welcome to the global chat room!',
            avatar_url: null,
            owner_username: knownCeo,
            admin_usernames: [],
            leader_usernames: [],
            employee_usernames: username ? [username] : [],
            intern_usernames: [],
            user_roles: {}
          };
          setGroupSettings(initial);
          localStorage.setItem('chat_group_settings', JSON.stringify(initial));
          if (knownCeo) {
            await supabase.from('group_settings').upsert(initial).then();
          } else if (username) {
            await claimCeoIfUnassigned(username);
          }
        }
      } catch (err) {
        console.error('Failed to fetch group settings from Supabase', err);
      }
    };
    fetchGroupSettings();

    // Fetch initial user profiles for last_seen & avatars
    const fetchUserProfiles = async () => {
      try {
        const { data } = await supabase.from('user_profiles').select('*');
        if (data && data.length > 0) {
          const profiles = data as UserProfile[];
          setGroupMembers(profiles);
          if (username) {
            const myProf = profiles.find(p => p.username?.toLowerCase() === username.toLowerCase());
            if (myProf) {
              if (myProf.avatar_url && myProf.avatar_url !== userAvatar) {
                setUserAvatar(myProf.avatar_url);
                localStorage.setItem('chat_avatar', myProf.avatar_url);
              }
              if (myProf.bio && !userBio) {
                setUserBio(myProf.bio);
                localStorage.setItem('chat_bio', myProf.bio);
              }
              if (myProf.email && !userEmail) {
                setUserEmail(myProf.email);
                localStorage.setItem('chat_email', myProf.email);
              }
              if (myProf.phone && !userPhone) {
                setUserPhone(myProf.phone);
                localStorage.setItem('chat_phone', myProf.phone);
              }
            }
          }
        }
      } catch (err) {
        console.warn('Could not fetch user profiles initially:', err);
      }
    };
    fetchUserProfiles();

    // Fetch initial messages
    const fetchMessages = async () => {
      try {
        const cleanUsername = username.replace(/"/g, '\\"');
        const { data, error } = await supabase
          .from('messages')
          .select('*')
          .or(`recipient_username.is.null,username.ilike."${cleanUsername}",recipient_username.ilike."${cleanUsername}"`)
          .order('created_at', { ascending: true });
        
        if (!error && data && data.length > 0) {
          // Double-check filtering on client side for bulletproof isolation
          const filteredData = (data as Message[]).filter(m => 
            !m.recipient_username ||
            m.username?.toLowerCase() === username?.toLowerCase() ||
            m.recipient_username?.toLowerCase() === username?.toLowerCase()
          );
          
          setMessages(prev => {
            const map = new Map<string, Message>();
            // Keep local/offline messages so they are never lost
            prev.forEach(m => map.set(m.id, m));
            filteredData.forEach(m => map.set(m.id, m));
            return Array.from(map.values()).sort(
              (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            );
          });
          
          // Mark as read
          const toUpdate = filteredData.filter(msg => 
            msg.username?.toLowerCase() !== username?.toLowerCase() && (!msg.read_by || !msg.read_by.includes(username))
          );
          toUpdate.forEach(async (msg) => {
            const newReadBy = [...(msg.read_by || []), username];
            await supabase.from('messages').update({ read_by: newReadBy }).eq('id', msg.id);
          });
        }
      } catch (err) {
        console.warn('Could not fetch messages from Supabase, local storage active:', err);
      }
    };
    fetchMessages();

    // Subscribe to new messages and presence
    const subscription = supabase
      .channel('public:messages')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newMessage = payload.new as Message;
            
            // Only handle messages if they are public, or sent by me, or sent to me
            const isForMe = !newMessage.recipient_username ||
                            newMessage.username?.toLowerCase() === username?.toLowerCase() ||
                            newMessage.recipient_username?.toLowerCase() === username?.toLowerCase();
            if (!isForMe) return;

            setMessages((prev) => {
              // Check if we already have this message (e.g. from optimistic insert)
              if (prev.some(m => m.id === newMessage.id)) {
                return prev.map(m => m.id === newMessage.id ? newMessage : m);
              }
              return [...prev, newMessage];
            });

            if (newMessage.username?.toLowerCase() !== username?.toLowerCase() && (!newMessage.read_by || !newMessage.read_by.includes(username))) {
              const newReadBy = [...(newMessage.read_by || []), username];
              supabase.from('messages').update({ read_by: newReadBy }).eq('id', newMessage.id);
            }

            // Trigger full multi-tier notification (Sound Chime + Browser Push + In-App Toast Banner + Vibration)
            triggerIncomingNotification(newMessage);
          } else if (payload.eventType === 'UPDATE') {
            const updatedMessage = payload.new as Message;
            setMessages((prev) => prev.map(msg => msg.id === updatedMessage.id ? updatedMessage : msg));
          } else if (payload.eventType === 'DELETE') {
            setMessages((prev) => prev.filter(msg => msg.id !== payload.old.id));
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'group_settings' },
        (payload) => {
          if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
            const newSettings = payload.new as GroupSettings;
            setGroupSettings(newSettings);
            localStorage.setItem('chat_group_settings', JSON.stringify(newSettings));
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_profiles' },
        (payload) => {
          if (payload.new) {
            const updated = payload.new as UserProfile;
            setGroupMembers((prev) => {
              const idx = prev.findIndex(p => p.username?.toLowerCase() === updated.username?.toLowerCase());
              if (idx >= 0) {
                const next = [...prev];
                next[idx] = { ...next[idx], ...updated };
                return next;
              }
              return [...prev, updated];
            });
            setViewProfileUser((curr) => {
              if (curr && curr.username?.toLowerCase() === updated.username?.toLowerCase()) {
                return { ...curr, ...updated };
              }
              return curr;
            });
          }
        }
      )
      .on('broadcast', { event: 'webrtc_signal' }, ({ payload }) => {
        if (payload && payload.target === username) {
          if (payload.type === 'offer') {
            setIncomingCall({ from: payload.from, type: payload.callType, signalData: payload.data });
          } else if (payload.type === 'answer') {
            if (pcRef.current) pcRef.current.setRemoteDescription(new RTCSessionDescription(payload.data));
          } else if (payload.type === 'ice-candidate') {
            if (pcRef.current) pcRef.current.addIceCandidate(new RTCIceCandidate(payload.data)).catch(e => console.error(e));
          } else if (payload.type === 'end-call') {
            endCall();
          }
        }
      })
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (payload && payload.username && payload.username?.toLowerCase() !== username?.toLowerCase()) {
          if (payload.isTyping) {
            setTypingUsers((prev) => {
              if (!prev.includes(payload.username)) {
                return [...prev, payload.username];
              }
              return prev;
            });

            if (typingUsersTimeoutsRef.current[payload.username]) {
              clearTimeout(typingUsersTimeoutsRef.current[payload.username]);
            }
            typingUsersTimeoutsRef.current[payload.username] = setTimeout(() => {
              setTypingUsers((prev) => prev.filter((u) => u !== payload.username));
              delete typingUsersTimeoutsRef.current[payload.username];
            }, 4000);
          } else {
            setTypingUsers((prev) => prev.filter((u) => u !== payload.username));
            if (typingUsersTimeoutsRef.current[payload.username]) {
              clearTimeout(typingUsersTimeoutsRef.current[payload.username]);
              delete typingUsersTimeoutsRef.current[payload.username];
            }
          }
        }
      })
      .on('presence', { event: 'sync' }, () => {
        const state = subscription.presenceState();
        const activeList: OnlineUser[] = [];
        Object.keys(state).forEach((key) => {
          state[key].forEach((pres: any) => {
            if (pres.username && !activeList.some(u => u.username.toLowerCase() === pres.username.toLowerCase())) {
              activeList.push({
                username: pres.username,
                avatar: pres.avatar || '',
                onlineAt: pres.onlineAt || new Date().toISOString()
              });
            }
          });
        });
        setOnlineUsersList(activeList);
        setOnlineUsersCount(activeList.length);
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        if (Array.isArray(newPresences)) {
          setOnlineUsersList(prev => {
            const copy = [...prev];
            newPresences.forEach((p: any) => {
              if (p.username && !copy.some(u => u.username.toLowerCase() === p.username.toLowerCase())) {
                copy.push({
                  username: p.username,
                  avatar: p.avatar || '',
                  onlineAt: p.onlineAt || new Date().toISOString()
                });
              }
            });
            return copy;
          });
        }
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        if (Array.isArray(leftPresences)) {
          const leftNames = leftPresences.map((p: any) => (p.username || '').toLowerCase());
          const nowIso = new Date().toISOString();
          setOnlineUsersList(prev => prev.filter(u => !leftNames.includes(u.username.toLowerCase())));
          setGroupMembers(prev => prev.map(m => leftNames.includes(m.username.toLowerCase()) ? { ...m, last_seen: nowIso } : m));
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          const nowIso = new Date().toISOString();
          const effectiveAvatar = userAvatar || localStorage.getItem('chat_avatar') || '';
          await subscription.track({ username, avatar: effectiveAvatar, onlineAt: nowIso });
          if (username) {
            try {
              await supabase.from('user_profiles').upsert({
                username,
                avatar_url: effectiveAvatar,
                last_seen: nowIso
              });
            } catch (err) {
              console.warn('Could not sync last_seen:', err);
            }
          }
        }
      });

    channelRef.current = subscription;

    // Handle instant offline on window unload / backgrounding
    const handleUnloadOrHide = () => {
      if (channelRef.current && username) {
        channelRef.current.untrack();
      }
    };
    window.addEventListener('beforeunload', handleUnloadOrHide);
    window.addEventListener('pagehide', handleUnloadOrHide);

    return () => {
      window.removeEventListener('beforeunload', handleUnloadOrHide);
      window.removeEventListener('pagehide', handleUnloadOrHide);
      if (channelRef.current) {
        channelRef.current.untrack();
      }
      supabase.removeChannel(subscription);
      channelRef.current = null;
    };
  }, [isJoined, username, notificationsEnabled, userAvatar]);

  useEffect(() => {
    if (!isJoined || !username) return;

    const pulseHeartbeat = async () => {
      const nowIso = new Date().toISOString();
      const currentAv = userAvatar || localStorage.getItem('chat_avatar') || '';
      if (channelRef.current) {
        await channelRef.current.track({ username, avatar: currentAv, onlineAt: nowIso });
      }
      try {
        await supabase.from('user_profiles').upsert({
          username,
          avatar_url: currentAv,
          last_seen: nowIso
        });
      } catch (err) {
        // silent sync catch
      }
    };

    // Heartbeat every 12 seconds for responsive presence
    const timer = setInterval(pulseHeartbeat, 12000);
    return () => clearInterval(timer);
  }, [isJoined, username, userAvatar]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingUsers]);

  // Analytics Tracking (Focus, Clicks, Time Sync)
  useEffect(() => {
    if (!isJoined || !username) return;

    // Track Focus
    const onFocus = () => { statsRef.current.isFocused = true; };
    const onBlur = () => { statsRef.current.isFocused = false; };
    window.addEventListener('focus', onFocus);
    window.addEventListener('blur', onBlur);

    // Track Global Clicks
    const onClick = () => { statsRef.current.clicks++; };
    window.addEventListener('click', onClick);

    // Timer for active seconds
    const tickInterval = setInterval(() => {
      if (statsRef.current.isFocused) {
        statsRef.current.seconds++;
      }
    }, 1000);

    // Sync to Supabase every 60 seconds
    const syncInterval = setInterval(async () => {
      const { clicks, seconds, messages } = statsRef.current;
      if (clicks === 0 && seconds === 0 && messages === 0) return;

      // Reset immediately to avoid double counting
      statsRef.current.clicks = 0;
      statsRef.current.seconds = 0;
      statsRef.current.messages = 0;

      try {
        const today = new Date().toISOString().split('T')[0];
        const { data } = await supabase
          .from('user_daily_stats')
          .select('*')
          .eq('date', today)
          .eq('username', username)
          .single();

        if (data) {
          await supabase.from('user_daily_stats').upsert({
            id: data.id,
            date: today,
            username,
            active_seconds: data.active_seconds + seconds,
            total_clicks: data.total_clicks + clicks,
            messages_sent: data.messages_sent + messages
          });
        } else {
          await supabase.from('user_daily_stats').insert({
            date: today,
            username,
            active_seconds: seconds,
            total_clicks: clicks,
            messages_sent: messages
          });
        }
      } catch (err) {
        // Silently fail if something goes wrong, stats will be added in next successful sync if we hadn't reset, 
        // but since we reset, they might be lost for that minute. Better than crashing or lagging.
        console.warn('Analytics sync error:', err);
      }
    }, 60000);

    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('click', onClick);
      clearInterval(tickInterval);
      clearInterval(syncInterval);
    };
  }, [isJoined, username]);

  // WebRTC Call Logic
  const sendSignal = (target: string, type: string, data: any, callType: 'audio' | 'video' = 'audio') => {
    if (channelRef.current && username) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'webrtc_signal',
        payload: { target, from: username, type, data, callType }
      });
    }
  };

  const endCall = () => {
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    setActiveCall(null);
    setIncomingCall(null);
    setShowCallModal(false);
  };

  const startCall = async (targetUser: string, type: 'audio' | 'video') => {
    setActiveCall({ with: targetUser, type, isCaller: true });
    setShowCallModal(true);
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: type === 'video' });
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
      pcRef.current = pc;

      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      pc.ontrack = (event) => {
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = event.streams[0];
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          sendSignal(targetUser, 'ice-candidate', event.candidate);
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      sendSignal(targetUser, 'offer', offer, type);
    } catch (err: any) {
      const isPermissionDenied = err?.name === 'NotAllowedError' || 
        err?.name === 'PermissionDeniedError' || 
        err?.name === 'SecurityError' ||
        err?.message?.toLowerCase().includes('permission') || 
        err?.message?.toLowerCase().includes('denied');

      console.warn('Media call notice:', err?.message || err);
      if (isPermissionDenied) {
        setMediaErrorToast('Microphone or camera permission was denied. Please allow device permissions in your browser or open the app in a new tab.');
      } else {
        setMediaErrorToast(`Could not start call: ${err?.message || 'Device error'}`);
      }
      endCall();
    }
  };

  const acceptCall = async () => {
    if (!incomingCall) return;
    setActiveCall({ with: incomingCall.from, type: incomingCall.type, isCaller: false });
    setShowCallModal(true);
    const targetUser = incomingCall.from;
    const type = incomingCall.type;
    const offer = incomingCall.signalData;
    setIncomingCall(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: type === 'video' });
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
      pcRef.current = pc;

      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      pc.ontrack = (event) => {
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = event.streams[0];
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          sendSignal(targetUser, 'ice-candidate', event.candidate);
        }
      };

      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      sendSignal(targetUser, 'answer', answer);
    } catch (err: any) {
      const isPermissionDenied = err?.name === 'NotAllowedError' || 
        err?.name === 'PermissionDeniedError' || 
        err?.name === 'SecurityError' ||
        err?.message?.toLowerCase().includes('permission') || 
        err?.message?.toLowerCase().includes('denied');

      console.warn('Accept call notice:', err?.message || err);
      if (isPermissionDenied) {
        setMediaErrorToast('Microphone or camera permission was denied. Please allow device permissions in your browser or open the app in a new tab.');
      } else {
        setMediaErrorToast(`Could not connect call: ${err?.message || 'Device error'}`);
      }
      endCall();
    }
  };

  const rejectCall = () => {
    if (incomingCall) {
      sendSignal(incomingCall.from, 'end-call', null);
      setIncomingCall(null);
    }
  };

  const sendTypingStatus = (isTyping: boolean) => {
    if (channelRef.current && username) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'typing',
        payload: { username, isTyping }
      });
      isSelfTypingRef.current = isTyping;
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInputMessage(val);

    if (val.trim()) {
      if (!isSelfTypingRef.current) {
        sendTypingStatus(true);
      }
      if (typingTimerRef.current) {
        clearTimeout(typingTimerRef.current);
      }
      typingTimerRef.current = setTimeout(() => {
        sendTypingStatus(false);
      }, 2500);
    } else {
      if (typingTimerRef.current) {
        clearTimeout(typingTimerRef.current);
      }
      if (isSelfTypingRef.current) {
        sendTypingStatus(false);
      }
    }
  };

  // Web Audio Synthesizer for high-fidelity zero-latency alert chimes
  const playNotificationSound = (type: 'message' | 'call' | 'test' = 'message') => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      const now = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      if (type === 'test' || type === 'message') {
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(880, now); // A5 note
        osc1.frequency.exponentialRampToValueAtTime(1318.5, now + 0.08); // E6 note

        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(1318.5, now + 0.08);
        osc2.frequency.exponentialRampToValueAtTime(1760, now + 0.18); // A6 note

        gain.gain.setValueAtTime(0.28, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);

        osc1.start(now);
        osc1.stop(now + 0.1);
        osc2.start(now + 0.08);
        osc2.stop(now + 0.38);
      }
    } catch (err) {
      console.warn('Audio playback error:', err);
    }
  };

  // Comprehensive Notification Dispatcher
  const triggerIncomingNotification = (newMessage: Message) => {
    if (!newMessage || !newMessage.username) return;
    const isMine = newMessage.username.toLowerCase() === (username || '').toLowerCase();
    if (isMine) return;

    // 1. Play Sound (if enabled)
    if (soundEnabled) {
      playNotificationSound('message');
    }

    // 2. Mobile Haptic Vibration
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate([100, 50, 100]);
      } catch (e) {}
    }

    const isPrivate = Boolean(newMessage.recipient_username);
    const preview = newMessage.type === 'text'
      ? (newMessage.content.length > 70 ? newMessage.content.substring(0, 70) + '...' : newMessage.content)
      : newMessage.type === 'image' ? '📷 Photo Attachment'
      : newMessage.type === 'audio' ? '🎤 Voice Note'
      : newMessage.type === 'video' ? '🎬 Video Clip'
      : `📎 ${newMessage.file_name || 'File Attachment'}`;

    // 3. Browser Push / Web Desktop Notification
    if (notificationsEnabled && typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        const notifTitle = isPrivate 
          ? `🔒 ${newMessage.username} (Private Message)`
          : `💬 ${newMessage.username} (${activeGroupSettings?.name || 'Group Chat'})`;

        const notif = new Notification(notifTitle, {
          body: preview,
          icon: newMessage.avatar || getAvatarForUser(newMessage.username) || '/favicon.ico',
          badge: '/favicon.ico',
          tag: `chat-msg-${newMessage.id || Date.now()}`
        });

        notif.onclick = () => {
          window.focus();
          if (isPrivate) {
            setActivePrivateUser(newMessage.username);
          } else {
            setActivePrivateUser(null);
          }
          notif.close();
        };
      } catch (err) {
        console.warn('Desktop Notification error:', err);
      }
    }

    // 4. In-App Floating Toast Notification Banner
    const isLookingAtThisExactChat = isPrivate 
      ? activePrivateUser?.toLowerCase() === newMessage.username.toLowerCase()
      : !activePrivateUser;

    if (inAppToastsEnabled && (!isLookingAtThisExactChat || document.visibilityState !== 'visible')) {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
      setToastNotification({
        id: newMessage.id || `toast-${Date.now()}`,
        sender: newMessage.username,
        avatar: newMessage.avatar || getAvatarForUser(newMessage.username),
        content: preview,
        type: newMessage.type,
        isPrivate,
        targetUsername: isPrivate ? newMessage.username : undefined,
        timestamp: new Date().toISOString()
      });
      toastTimeoutRef.current = setTimeout(() => {
        setToastNotification(null);
      }, 5000);
    }

    // 5. Unread badge & Tab Title Flashing
    if (document.visibilityState !== 'visible') {
      setUnreadNotificationCount(prev => prev + 1);
    }
  };

  const requestNotificationPermission = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        const permission = await Notification.requestPermission();
        const granted = permission === 'granted';
        setNotificationsEnabled(granted);
        localStorage.setItem('chat_notifications', granted ? 'true' : 'false');
        if (granted) {
          playNotificationSound('test');
          try {
            new Notification('🔔 Notifications Enabled!', {
              body: 'You will receive instant alerts for incoming messages.',
              icon: userAvatar || '/favicon.ico'
            });
          } catch {}
        }
      } catch (err) {
        console.warn('Notification permission request error:', err);
      }
    } else {
      alert('Browser web notifications are not supported in this browser, but In-App sounds & banners are fully enabled.');
    }
  };

  const toggleSoundAlerts = () => {
    const nextState = !soundEnabled;
    setSoundEnabled(nextState);
    localStorage.setItem('chat_sound', nextState ? 'true' : 'false');
    if (nextState) {
      playNotificationSound('test');
    }
  };

  const toggleInAppToasts = () => {
    const nextState = !inAppToastsEnabled;
    setInAppToastsEnabled(nextState);
    localStorage.setItem('chat_in_app_toasts', nextState ? 'true' : 'false');
  };

  const testNotification = () => {
    // 1. Play sound
    playNotificationSound('test');

    // 2. Mobile vibration
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate([100, 50, 100]); } catch {}
    }

    // 3. In-App Banner
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastNotification({
      id: `test-${Date.now()}`,
      sender: 'Nexus System 🔔',
      avatar: userAvatar || '',
      content: 'Live notification test! Sounds, banners, and real-time alerts are 100% operational.',
      type: 'text',
      isPrivate: false,
      timestamp: new Date().toISOString()
    });
    toastTimeoutRef.current = setTimeout(() => {
      setToastNotification(null);
    }, 5000);

    // 4. Browser Notification
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification('🔔 Notification Test Successful!', {
          body: 'Your live alert system is active and working perfectly.',
          icon: userAvatar || '/favicon.ico'
        });
      } catch {}
    }
  };

  const handleDelete = async (id: string) => {
    setMessages(prev => prev.filter(m => m.id !== id));
    try {
      broadcastChannelRef.current?.postMessage({
        type: 'DELETE_MESSAGE',
        payload: { id }
      });
    } catch {}
    try {
      await supabase.from('messages').delete().eq('id', id);
    } catch (e) {
      console.warn('Supabase delete warning:', e);
    }
  };

  const handleEdit = (msg: Message) => {
    setEditingMessageId(msg.id);
    setEditContent(msg.content);
  };

  const saveEdit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (editingMessageId && editContent.trim()) {
      const newText = editContent.trim();
      setMessages(prev => prev.map(m => m.id === editingMessageId ? { ...m, content: newText, is_edited: true } : m));
      setEditingMessageId(null);
      setEditContent('');
      try {
        broadcastChannelRef.current?.postMessage({
          type: 'UPDATE_MESSAGE',
          payload: { id: editingMessageId, content: newText, is_edited: true }
        });
      } catch {}
      try {
        const { error } = await supabase.from('messages').update({ content: newText, is_edited: true }).eq('id', editingMessageId);
        if (error) {
          console.warn('Supabase edit warning (saved locally):', error);
        }
      } catch (err) {
        console.warn('Supabase edit network error (saved locally):', err);
      }
    }
  };

  const cancelEdit = () => {
    setEditingMessageId(null);
    setEditContent('');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    const idClean = loginIdentifier.trim();
    if (!idClean) {
      setAuthError('Please enter username or email');
      return;
    }

    setIsAuthenticating(true);
    try {
      // Query Supabase user_profiles by email OR username (case-insensitive and safe for spaces)
      const escapedId = idClean.replace(/"/g, '\\"');
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .or(`username.ilike."${escapedId}",email.ilike."${escapedId}"`)
        .maybeSingle();

      if (data) {
        if (data.password && data.password !== loginPassword) {
          setAuthError('Incorrect password! Please check your password.');
          setIsAuthenticating(false);
          return;
        }

        const foundUser = data as UserProfile;
        setUsername(foundUser.username);
        setUserEmail(foundUser.email || '');
        setUserPhone(foundUser.phone || '');
        setUserBio(foundUser.bio || '');
        setUserAvatar(foundUser.avatar_url || '');
        setUserPassword(foundUser.password || '');

        localStorage.setItem('chat_username', foundUser.username);
        if (foundUser.email) localStorage.setItem('chat_email', foundUser.email);
        if (foundUser.phone) localStorage.setItem('chat_phone', foundUser.phone);
        if (foundUser.bio) localStorage.setItem('chat_bio', foundUser.bio);
        if (foundUser.avatar_url) localStorage.setItem('chat_avatar', foundUser.avatar_url);
        if (foundUser.password) localStorage.setItem('chat_password', foundUser.password);

        setIsJoined(true);
        requestNotificationPermission();
        await claimCeoIfUnassigned(foundUser.username);
      } else {
        // Fallback or quick enter with username
        setUsername(idClean);
        localStorage.setItem('chat_username', idClean);
        if (loginPassword) {
          setUserPassword(loginPassword);
          localStorage.setItem('chat_password', loginPassword);
        }

        // Create profile in Supabase
        const newProf: UserProfile = {
          username: idClean,
          email: idClean.includes('@') ? idClean : '',
          password: loginPassword,
          avatar_url: ''
        };
        await supabase.from('user_profiles').upsert(newProf).then();

        setIsJoined(true);
        requestNotificationPermission();
        await claimCeoIfUnassigned(idClean);
      }
    } catch (err) {
      // If table doesn't exist yet or query failed, login directly
      setUsername(idClean);
      localStorage.setItem('chat_username', idClean);
      setIsJoined(true);
      requestNotificationPermission();
      await claimCeoIfUnassigned(idClean);
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    const uClean = regUsername.trim();
    if (!uClean) {
      setAuthError('Username is required');
      return;
    }

    setIsAuthenticating(true);
    try {
      // Check if username already exists case-insensitively
      const { data: existingUser } = await supabase
        .from('user_profiles')
        .select('username')
        .ilike('username', uClean)
        .maybeSingle();

      if (existingUser) {
        setAuthError('Username already taken! Please choose another username.');
        setIsAuthenticating(false);
        return;
      }

      // Check if email already exists case-insensitively
      const emailTrim = regEmail.trim();
      if (emailTrim) {
        const { data: existingEmail } = await supabase
          .from('user_profiles')
          .select('email')
          .ilike('email', emailTrim)
          .maybeSingle();

        if (existingEmail) {
          setAuthError('Email already registered! Please log in instead.');
          setIsAuthenticating(false);
          return;
        }
      }

      const newProf: UserProfile = {
        username: uClean,
        email: emailTrim,
        phone: regPhone.trim(),
        bio: regBio.trim(),
        password: regPassword,
        avatar_url: ''
      };

      setUsername(uClean);
      setUserEmail(newProf.email || '');
      setUserPhone(newProf.phone || '');
      setUserBio(newProf.bio || '');
      setUserPassword(newProf.password || '');

      localStorage.setItem('chat_username', uClean);
      if (newProf.email) localStorage.setItem('chat_email', newProf.email);
      if (newProf.phone) localStorage.setItem('chat_phone', newProf.phone);
      if (newProf.bio) localStorage.setItem('chat_bio', newProf.bio);
      if (newProf.password) localStorage.setItem('chat_password', newProf.password);

      // Save to Supabase user_profiles
      await supabase.from('user_profiles').upsert(newProf).then();

      setIsJoined(true);
      requestNotificationPermission();
      await claimCeoIfUnassigned(uClean);
    } catch (err) {
      console.error('Registration failed:', err);
      setAuthError('An error occurred during registration. Please try again.');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('chat_username');
    localStorage.removeItem('chat_avatar');
    localStorage.removeItem('chat_email');
    localStorage.removeItem('chat_phone');
    localStorage.removeItem('chat_bio');
    localStorage.removeItem('chat_password');
    setIsJoined(false);
    setUsername('');
    setUserAvatar('');
    setUserEmail('');
    setUserPhone('');
    setUserBio('');
    setUserPassword('');
  };

  const openSettings = () => {
    setSettingsUsername(username);
    setSettingsEmail(userEmail);
    setSettingsPhone(userPhone);
    setSettingsBio(userBio);
    setSettingsPassword(userPassword);
    setShowSettings(true);
  };

  const openAnalyticsDashboard = async () => {
    setShowAnalytics(true);
    try {
      // 1. Fetch total team members count
      const { count } = await supabase
        .from('user_profiles')
        .select('*', { count: 'exact', head: true });
      
      if (count !== null) setTotalTeamMembers(count);

      // 2. Fetch today's analytics data
      const today = new Date().toISOString().split('T')[0];
      const { data } = await supabase
        .from('user_daily_stats')
        .select('*')
        .eq('date', today)
        .order('active_seconds', { ascending: false });

      if (data) {
        setAnalyticsData(data as UserDailyStats[]);
      }
    } catch (err) {
      console.error('Failed to load analytics', err);
    }
  };

  const getAvatarForUser = (targetUsername: string) => {
    if (!targetUsername) return '';
    const cleanTarget = targetUsername.trim();
    const lower = cleanTarget.toLowerCase();
    const myLower = (username || '').trim().toLowerCase();

    // 1. If looking up current user, prefer current loaded avatar
    if (lower === myLower && userAvatar) return userAvatar;

    // 2. Lookup in groupMembers (synced from user_profiles table)
    const member = groupMembers.find(m => m.username?.toLowerCase() === lower);
    if (member?.avatar_url) return member.avatar_url;

    // 3. Lookup in active presence users
    const onlineUser = onlineUsersList.find(u => u.username?.toLowerCase() === lower);
    if (onlineUser?.avatar) return onlineUser.avatar;

    // 4. Lookup from recent messages sent by this user
    const msg = messages.slice().reverse().find(m => m.username?.toLowerCase() === lower && m.avatar);
    if (msg?.avatar) return msg.avatar;

    // 5. Local storage fallback for current user
    if (lower === myLower) {
      return localStorage.getItem('chat_avatar') || '';
    }

    return '';
  };

  const openUserProfileCard = async (targetUsername: string) => {
    if (!targetUsername) return;
    const cleanTarget = targetUsername.trim();

    // Is the user currently online in presence list?
    const isTargetOnline = onlineUsersList.some(u => u.username.toLowerCase() === cleanTarget.toLowerCase());

    // Messages authored by this user to get latest activity timestamp
    const userMsgs = messages.filter(m => m.username?.toLowerCase() === cleanTarget.toLowerCase());
    const latestMsgDate = userMsgs.length > 0 ? userMsgs[userMsgs.length - 1].created_at : undefined;
    const fallbackAvatar = getAvatarForUser(cleanTarget);

    if (cleanTarget.toLowerCase() === username.toLowerCase()) {
      setViewProfileUser({
        username,
        email: userEmail,
        phone: userPhone,
        bio: userBio,
        avatar_url: userAvatar || fallbackAvatar,
        last_seen: new Date().toISOString()
      });
      return;
    }

    try {
      const { data } = await supabase
        .from('user_profiles')
        .select('*')
        .ilike('username', cleanTarget)
        .limit(1)
        .maybeSingle();

      if (data) {
        const profileData = data as UserProfile;
        setViewProfileUser({
          ...profileData,
          avatar_url: profileData.avatar_url || fallbackAvatar,
          last_seen: isTargetOnline ? new Date().toISOString() : (profileData.last_seen || latestMsgDate)
        });
      } else {
        const member = groupMembers.find(m => m.username?.toLowerCase() === cleanTarget.toLowerCase());
        setViewProfileUser({
          username: targetUsername,
          avatar_url: fallbackAvatar,
          email: member?.email,
          phone: member?.phone,
          bio: member?.bio || 'Group Member',
          last_seen: isTargetOnline ? new Date().toISOString() : latestMsgDate
        });
      }
    } catch (e) {
      const member = groupMembers.find(m => m.username?.toLowerCase() === cleanTarget.toLowerCase());
      setViewProfileUser({
        username: targetUsername,
        avatar_url: fallbackAvatar,
        email: member?.email,
        phone: member?.phone,
        bio: member?.bio || 'Group Member',
        last_seen: isTargetOnline ? new Date().toISOString() : latestMsgDate
      });
    }
  };

  const handleSettingsSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (settingsUsername.trim()) {
      const oldUsername = username;
      const newUsername = settingsUsername.trim();
      const newEmail = settingsEmail.trim();
      const newPhone = settingsPhone.trim();
      const newBio = settingsBio.trim();
      const newPass = settingsPassword.trim();
      
      // If username has changed, check if the new username already exists case-insensitively
      if (newUsername.toLowerCase() !== oldUsername.toLowerCase()) {
        const { data: existingUser } = await supabase
          .from('user_profiles')
          .select('username')
          .ilike('username', newUsername)
          .maybeSingle();

        if (existingUser) {
          alert('Username already taken by another user! Please choose a different username.');
          return;
        }
      }

      localStorage.setItem('chat_username', newUsername);
      localStorage.setItem('chat_avatar', userAvatar);
      localStorage.setItem('chat_email', newEmail);
      localStorage.setItem('chat_phone', newPhone);
      localStorage.setItem('chat_bio', newBio);
      localStorage.setItem('chat_password', newPass);
      
      setUsername(newUsername);
      setUserEmail(newEmail);
      setUserPhone(newPhone);
      setUserBio(newBio);
      setUserPassword(newPass);
      setShowSettings(false);

      const profilePayload: UserProfile = {
        username: newUsername,
        email: newEmail,
        phone: newPhone,
        bio: newBio,
        password: newPass,
        avatar_url: userAvatar
      };

      try {
        await supabase.from('user_profiles').upsert(profilePayload);
      } catch (err) {
        console.error('Supabase user_profiles sync error:', err);
      }

      if (oldUsername !== newUsername) {
        supabase.from('messages').update({ username: newUsername }).eq('username', oldUsername).then();
      }
    }
  };

  const userLower = (username || '').trim().toLowerCase();
  const ownerLower = (activeGroupSettings.owner_username || '').trim().toLowerCase();
  
  // Hierarchical Role Access Control (RBAC): CEO (1) > Manager (2) > Team Lead (3) > Employee (4) > Intern (5)
  const currentUserRole: CompanyRole = useMemo(() => {
    return getUserRole(username, activeGroupSettings);
  }, [username, activeGroupSettings]);

  const isOwner = currentUserRole === 'ceo';
  const isManager = currentUserRole === 'manager';
  const isTeamLead = currentUserRole === 'team_lead';
  const isEmployee = currentUserRole === 'employee';
  const isIntern = currentUserRole === 'intern';
  const isAdmin = isOwner || isManager;
  const isLeader = isTeamLead;

  // Change user role following strict tree pattern
  const changeUserRole = async (targetUsername: string, newRole: CompanyRole) => {
    const cleanTarget = targetUsername.trim();
    const targetLower = cleanTarget.toLowerCase();
    const myRole = currentUserRole;
    const targetRole = getUserRole(cleanTarget, activeGroupSettings);

    if (targetLower === ownerLower && newRole !== 'ceo') {
      alert("The CEO role cannot be changed directly! Only the current CEO can transfer CEO ownership.");
      return;
    }

    if (!canManageUser(myRole, targetRole)) {
      alert(`Permission Denied: As a ${ROLE_DETAILS[myRole].title}, you cannot modify a ${ROLE_DETAILS[targetRole].title}.`);
      return;
    }

    const allowedRoles = getAllowedAssignableRoles(myRole);
    if (!allowedRoles.includes(newRole) && !(myRole === 'ceo' && newRole === 'ceo')) {
      alert(`Permission Denied: As a ${ROLE_DETAILS[myRole].title}, you can only assign: ${allowedRoles.map(r => ROLE_DETAILS[r].title).join(', ')}.`);
      return;
    }

    if (newRole === 'ceo') {
      await transferOwnership(cleanTarget);
      return;
    }

    const updated = applyRoleChange(activeGroupSettings, cleanTarget, newRole);
    setGroupSettings(updated);
    localStorage.setItem('chat_group_settings', JSON.stringify(updated));

    // Broadcast change across tabs
    try {
      broadcastChannelRef.current?.postMessage({
        type: 'ROLE_UPDATE',
        payload: { targetUsername: cleanTarget, newRole, updatedSettings: updated }
      });
    } catch {}

    try {
      await supabase.from('group_settings').upsert(updated);
      await supabase.from('user_profiles').update({ role: newRole }).eq('username', cleanTarget);
    } catch (err) {
      console.warn('Supabase role update sync (stored locally):', err);
    }

    setMediaErrorToast(`Role of @${cleanTarget} set to ${ROLE_DETAILS[newRole].title} (${ROLE_DETAILS[newRole].urduTitle}).`);
  };

  const makeLeader = (targetUsername: string) => changeUserRole(targetUsername, 'team_lead');
  const dismissLeader = (targetUsername: string) => changeUserRole(targetUsername, 'employee');
  const makeAdmin = (targetUsername: string) => changeUserRole(targetUsername, 'manager');
  const dismissAdmin = (targetUsername: string) => changeUserRole(targetUsername, 'employee');

  const transferOwnership = async (targetUsername: string) => {
    if (!isOwner) {
      alert("Only the current CEO can transfer company ownership!");
      return;
    }
    const cleanTarget = targetUsername.trim();
    if (confirm(`Are you sure you want to appoint @${cleanTarget} as the new CEO? You will remain as a Manager.`)) {
      const updated = applyRoleChange(activeGroupSettings, cleanTarget, 'ceo');
      setGroupSettings(updated);
      localStorage.setItem('chat_group_settings', JSON.stringify(updated));
      localStorage.setItem('chat_company_ceo', cleanTarget);

      try {
        broadcastChannelRef.current?.postMessage({
          type: 'ROLE_UPDATE',
          payload: { updatedSettings: updated }
        });
        broadcastChannelRef.current?.postMessage({
          type: 'ANNOUNCE_CEO',
          payload: { owner_username: cleanTarget, groupSettings: updated }
        });
      } catch {}

      try {
        await supabase.from('group_settings').upsert(updated);
      } catch (e) {}

      setMediaErrorToast(`👑 CEO role has been assigned to @${cleanTarget}.`);
    }
  };

  const removeMember = async (targetUsername: string) => {
    const cleanTarget = targetUsername.trim();
    const targetLower = cleanTarget.toLowerCase();
    const myRole = currentUserRole;
    const targetRole = getUserRole(cleanTarget, activeGroupSettings);

    if (targetLower === ownerLower) {
      alert("The CEO cannot be removed from the company!");
      return;
    }

    if (targetLower === userLower) {
      alert("You cannot remove yourself!");
      return;
    }

    if (!canManageUser(myRole, targetRole)) {
      alert(`Permission Denied: As a ${ROLE_DETAILS[myRole].title}, you cannot remove a ${ROLE_DETAILS[targetRole].title} from the company.`);
      return;
    }

    const roleTitle = ROLE_DETAILS[targetRole].title;
    if (!confirm(`Are you sure you want to remove ${roleTitle} @${cleanTarget} from the company? Their account and access will be revoked immediately.`)) {
      return;
    }

    try {
      // 1. Delete from Supabase user_profiles table
      await supabase.from('user_profiles').delete().eq('username', cleanTarget);

      // 2. Remove from all role lists and add to banned_usernames
      const updatedAdmins = (activeGroupSettings.admin_usernames || []).filter(u => u.toLowerCase() !== targetLower);
      const updatedLeaders = (activeGroupSettings.leader_usernames || []).filter(u => u.toLowerCase() !== targetLower);
      const updatedEmployees = (activeGroupSettings.employee_usernames || []).filter(u => u.toLowerCase() !== targetLower);
      const updatedInterns = (activeGroupSettings.intern_usernames || []).filter(u => u.toLowerCase() !== targetLower);
      const currentBanned = activeGroupSettings.banned_usernames || [];
      const updatedBanned = Array.from(new Set([...currentBanned, cleanTarget]));

      const updatedRoles = { ...(activeGroupSettings.user_roles || {}) };
      delete updatedRoles[targetLower];

      const updated: GroupSettings = {
        ...activeGroupSettings,
        admin_usernames: updatedAdmins,
        leader_usernames: updatedLeaders,
        employee_usernames: updatedEmployees,
        intern_usernames: updatedInterns,
        banned_usernames: updatedBanned,
        user_roles: updatedRoles
      };

      setGroupSettings(updated);
      localStorage.setItem('chat_group_settings', JSON.stringify(updated));

      try {
        broadcastChannelRef.current?.postMessage({
          type: 'KICKED_FROM_COMPANY',
          payload: { username: cleanTarget }
        });
        broadcastChannelRef.current?.postMessage({
          type: 'ROLE_UPDATE',
          payload: { updatedSettings: updated }
        });
      } catch {}

      await supabase.from('group_settings').upsert(updated);

      // 3. Update local state
      setGroupMembers(prev => prev.filter(m => m.username.toLowerCase() !== targetLower));

      if (viewProfileUser && viewProfileUser.username.toLowerCase() === targetLower) {
        setViewProfileUser(null);
      }

      setMediaErrorToast(`@${cleanTarget} (${roleTitle}) has been removed from the company.`);
    } catch (err: any) {
      console.error('Error removing member:', err);
      alert(`Failed to remove member: ${err?.message || 'Unknown error'}`);
    }
  };

  const isBanned = !isOwner && (activeGroupSettings.banned_usernames || []).some(u => u.trim().toLowerCase() === userLower);

  const banUser = async (targetUsername: string) => {
    const cleanTarget = targetUsername.trim();
    const targetLower = cleanTarget.toLowerCase();
    const myRole = currentUserRole;
    const targetRole = getUserRole(cleanTarget, activeGroupSettings);

    if (targetLower === ownerLower) {
      alert("The CEO cannot be banned!");
      return;
    }

    if (!canManageUser(myRole, targetRole)) {
      alert(`Permission Denied: As a ${ROLE_DETAILS[myRole].title}, you cannot ban a ${ROLE_DETAILS[targetRole].title}.`);
      return;
    }

    if (confirm(`Are you sure you want to BAN @${cleanTarget}? They will be blocked from sending or viewing chat messages.`)) {
      const currentBanned = activeGroupSettings.banned_usernames || [];
      if (currentBanned.some(b => b.toLowerCase() === targetLower)) return;
      
      const newBanned = [...currentBanned, cleanTarget];
      const updated: GroupSettings = {
        ...activeGroupSettings,
        banned_usernames: newBanned
      };
      setGroupSettings(updated);
      localStorage.setItem('chat_group_settings', JSON.stringify(updated));

      try {
        broadcastChannelRef.current?.postMessage({
          type: 'ROLE_UPDATE',
          payload: { updatedSettings: updated }
        });
        await supabase.from('group_settings').upsert(updated);
        setMediaErrorToast(`@${cleanTarget} has been banned.`);
      } catch (err) {
        console.error('Supabase banUser sync error:', err);
      }
    }
  };

  const unbanUser = async (targetUsername: string) => {
    const cleanTarget = targetUsername.trim();
    const myRole = currentUserRole;
    const targetRole = getUserRole(cleanTarget, activeGroupSettings);

    if (!canManageUser(myRole, targetRole)) {
      alert(`Permission Denied: As a ${ROLE_DETAILS[myRole].title}, you cannot unban a ${ROLE_DETAILS[targetRole].title}.`);
      return;
    }

    const currentBanned = activeGroupSettings.banned_usernames || [];
    const newBanned = currentBanned.filter(b => b.toLowerCase() !== cleanTarget.toLowerCase());
    const currentAppeals = activeGroupSettings.ban_appeals || [];
    const newAppeals = currentAppeals.filter(a => a.username.toLowerCase() !== cleanTarget.toLowerCase());

    const updated: GroupSettings = {
      ...activeGroupSettings,
      banned_usernames: newBanned,
      ban_appeals: newAppeals
    };
    setGroupSettings(updated);
    localStorage.setItem('chat_group_settings', JSON.stringify(updated));

    try {
      broadcastChannelRef.current?.postMessage({
        type: 'ROLE_UPDATE',
        payload: { updatedSettings: updated }
      });
      await supabase.from('group_settings').upsert(updated);
      setMediaErrorToast(`@${cleanTarget} unbanned.`);
    } catch (err) {
      console.error('Supabase unbanUser sync error:', err);
    }
  };

  const renderRoleBadge = (targetUsername?: string | null, size: 'sm' | 'md' = 'sm') => {
    if (!targetUsername) return null;
    const role = getUserRole(targetUsername, activeGroupSettings);
    const details = ROLE_DETAILS[role];
    return (
      <span 
        title={`${details.title} (${details.urduTitle}) - Hierarchy Level ${details.level}`}
        className={cn(
          "inline-flex items-center gap-1 font-bold rounded-full border shadow-xs whitespace-nowrap",
          size === 'sm' ? "text-[9px] px-1.5 py-0.5" : "text-[10px] px-2 py-0.5",
          details.badgeClass
        )}
      >
        {role === 'ceo' && <Crown className={size === 'sm' ? "w-2.5 h-2.5 text-amber-400" : "w-3 h-3 text-amber-400"} />}
        {role === 'manager' && <Shield className={size === 'sm' ? "w-2.5 h-2.5 text-cyan-400" : "w-3 h-3 text-cyan-400"} />}
        {role === 'team_lead' && <ShieldCheck className={size === 'sm' ? "w-2.5 h-2.5 text-purple-400" : "w-3 h-3 text-purple-400"} />}
        {role === 'employee' && <Briefcase className={size === 'sm' ? "w-2.5 h-2.5 text-blue-400" : "w-3 h-3 text-blue-400"} />}
        {role === 'intern' && <GraduationCap className={size === 'sm' ? "w-2.5 h-2.5 text-slate-400" : "w-3 h-3 text-slate-400"} />}
        <span>{details.title}</span>
      </span>
    );
  };

  const handleBanAppealSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appealInput.trim()) return;
    setIsSubmittingAppeal(true);

    const newAppeal: BanAppeal = {
      username: username,
      message: appealInput.trim(),
      created_at: new Date().toISOString()
    };

    const currentAppeals = activeGroupSettings.ban_appeals || [];
    const filtered = currentAppeals.filter(a => a.username.toLowerCase() !== username.toLowerCase());
    const newAppeals = [newAppeal, ...filtered];

    const updated: GroupSettings = {
      ...activeGroupSettings,
      ban_appeals: newAppeals
    };

    setGroupSettings(updated);
    localStorage.setItem('chat_group_settings', JSON.stringify(updated));

    try {
      await supabase.from('group_settings').upsert(updated);
    } catch (err) {
      console.error('Supabase appeal submit error:', err);
    } finally {
      setIsSubmittingAppeal(false);
      setAppealSubmittedSuccess(true);
      setAppealInput('');
    }
  };

  const dismissAppeal = async (targetUsername: string) => {
    const cleanTarget = targetUsername.trim();
    const targetRole = getUserRole(cleanTarget, activeGroupSettings);
    if (!canManageUser(currentUserRole, targetRole)) {
      alert(`Permission Denied: As a ${ROLE_DETAILS[currentUserRole].title}, you cannot dismiss requests for a ${ROLE_DETAILS[targetRole].title}.`);
      return;
    }
    const currentAppeals = activeGroupSettings.ban_appeals || [];
    const newAppeals = currentAppeals.filter(a => a.username.toLowerCase() !== cleanTarget.toLowerCase());

    const updated: GroupSettings = {
      ...activeGroupSettings,
      ban_appeals: newAppeals
    };
    setGroupSettings(updated);
    localStorage.setItem('chat_group_settings', JSON.stringify(updated));

    try {
      await supabase.from('group_settings').upsert(updated);
    } catch (err) {
      console.error('Dismiss appeal error:', err);
    }
  };

  const blockUser = (targetUsername: string) => {
    const cleanTarget = targetUsername.trim();
    if (cleanTarget.toLowerCase() === ownerLower) {
      alert("You cannot block the company CEO!");
      return;
    }
    if (cleanTarget.toLowerCase() === username.toLowerCase()) {
      alert("You cannot block yourself!");
      return;
    }
    if (blockedUsers.some(u => u.toLowerCase() === cleanTarget.toLowerCase())) return;

    const newBlocked = [...blockedUsers, cleanTarget];
    setBlockedUsers(newBlocked);
    localStorage.setItem('chat_blocked_users', JSON.stringify(newBlocked));
    
    supabase.from('user_profiles').update({ blocked_usernames: newBlocked }).eq('username', username).then();
  };

  const unblockUser = (targetUsername: string) => {
    const cleanTarget = targetUsername.trim();
    const newBlocked = blockedUsers.filter(u => u.toLowerCase() !== cleanTarget.toLowerCase());
    setBlockedUsers(newBlocked);
    localStorage.setItem('chat_blocked_users', JSON.stringify(newBlocked));

    supabase.from('user_profiles').update({ blocked_usernames: newBlocked }).eq('username', username).then();
  };

  const formatLastSeen = (lastSeenIso?: string, isOnline?: boolean) => {
    if (isOnline) {
      return { text: 'Online now', isOnline: true };
    }
    if (!lastSeenIso) {
      return { text: 'Offline', isOnline: false };
    }
    try {
      const diffMs = Math.max(0, Date.now() - new Date(lastSeenIso).getTime());
      if (diffMs < 45000) return { text: 'Offline • Just now', isOnline: false };
      const mins = Math.floor(diffMs / 60000);
      if (mins < 60) return { text: `Offline • ${mins}m ago`, isOnline: false };
      const hours = Math.floor(mins / 60);
      if (hours < 24) return { text: `Offline • ${hours}h ago`, isOnline: false };
      const days = Math.floor(hours / 24);
      if (days < 7) return { text: `Offline • ${days}d ago`, isOnline: false };
      return { text: `Offline • ${new Date(lastSeenIso).toLocaleDateString()}`, isOnline: false };
    } catch {
      return { text: 'Offline', isOnline: false };
    }
  };

  const openGroupSettings = async () => {
    setEditGroupForm({
      name: activeGroupSettings.name || 'Global Chat',
      description: activeGroupSettings.description || 'Welcome to the global chat room!'
    });
    setShowGroupSettings(true);
    try {
      const { data } = await supabase.from('user_profiles').select('*');
      if (data && data.length > 0) {
        setGroupMembers(data as UserProfile[]);
      }
    } catch (err) {
      console.warn('Could not fetch member profiles:', err);
    }
  };

  const getAllGroupMembers = () => {
    const memberMap = new Map<string, UserProfile>();

    // Database user profiles
    groupMembers.forEach((p) => {
      if (p.username) {
        const key = p.username.toLowerCase();
        const userMsgs = messages.filter(m => m.username?.toLowerCase() === key);
        const latestMsgDate = userMsgs.length > 0 ? userMsgs[userMsgs.length - 1].created_at : undefined;
        memberMap.set(key, { ...p, last_seen: p.last_seen || latestMsgDate });
      }
    });

    // Message authors
    messages.forEach((m) => {
      if (m.username) {
        const key = m.username.toLowerCase();
        const existing = memberMap.get(key);
        if (!existing) {
          memberMap.set(key, {
            username: m.username,
            avatar_url: m.avatar || '',
            bio: 'Group Member',
            last_seen: m.created_at
          });
        } else if (!existing.last_seen) {
          memberMap.set(key, { ...existing, last_seen: m.created_at });
        }
      }
    });

    // Online users
    onlineUsersList.forEach((u) => {
      if (u.username) {
        const key = u.username.toLowerCase();
        const existing = memberMap.get(key);
        if (existing) {
          memberMap.set(key, { ...existing, last_seen: new Date().toISOString() });
        } else {
          memberMap.set(key, {
            username: u.username,
            avatar_url: u.avatar || '',
            bio: 'Group Member',
            last_seen: new Date().toISOString()
          });
        }
      }
    });

    // Self
    if (username) {
      const key = username.toLowerCase();
      const existing = memberMap.get(key);
      memberMap.set(key, {
        username,
        avatar_url: userAvatar || existing?.avatar_url || '',
        email: userEmail || existing?.email,
        phone: userPhone || existing?.phone,
        bio: userBio || existing?.bio,
        last_seen: new Date().toISOString()
      });
    }

    return Array.from(memberMap.values());
  };

  const handleGroupSettingsSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    
    const updated: GroupSettings = {
      ...activeGroupSettings,
      name: editGroupForm.name.trim(),
      description: editGroupForm.description.trim()
    };
    
    setGroupSettings(updated);
    localStorage.setItem('chat_group_settings', JSON.stringify(updated));
    setShowGroupSettings(false);

    try {
      await supabase.from('group_settings').upsert(updated);
    } catch (err) {
      console.error('Supabase update group_settings error:', err);
    }
  };

  const handleGroupAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !isAdmin) return;

    setIsUploadingGroupAvatar(true);
    try {
      const result = await uploadToCloudinary(file, `group_avatar_${Date.now()}`);
      if (result.secure_url || result.url) {
        const url = result.secure_url || result.url;
        const updated: GroupSettings = {
          ...activeGroupSettings,
          avatar_url: url
        };
        setGroupSettings(updated);
        localStorage.setItem('chat_group_settings', JSON.stringify(updated));

        try {
          await supabase.from('group_settings').upsert(updated);
        } catch (err) {
          console.error('Group settings upsert error:', err);
        }
      }
    } catch (err) {
      console.error('Group avatar upload failed', err);
      alert('Failed to upload group avatar');
    } finally {
      setIsUploadingGroupAvatar(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingAvatar(true);
    try {
      const result = await uploadToCloudinary(file, `avatar_${username}_${Date.now()}`);
      if (result.secure_url || result.url) {
        const url = result.secure_url || result.url;
        setUserAvatar(url);
        localStorage.setItem('chat_avatar', url);
        
        // Update local state for immediate responsiveness
        setMessages(prev => prev.map(m => m.username?.toLowerCase() === username.toLowerCase() ? { ...m, avatar: url } : m));
        setGroupMembers(prev => prev.map(m => m.username?.toLowerCase() === username.toLowerCase() ? { ...m, avatar_url: url } : m));

        // Update user profile and previous messages in Supabase
        await supabase.from('user_profiles').upsert({ username, avatar_url: url, last_seen: new Date().toISOString() });
        supabase.from('messages').update({ avatar: url }).ilike('username', username).then();

        // Update presence track with new avatar
        if (channelRef.current) {
          channelRef.current.track({ username, avatar: url, onlineAt: new Date().toISOString() });
        }
      }
    } catch (err) {
      console.error('Avatar upload failed', err);
      alert('Failed to upload avatar');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  // Voice Note Recording Functions
  const startVoiceRecording = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setMediaErrorToast('Voice recording is not supported in this browser environment.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        // Stop audio track stream
        stream.getTracks().forEach(track => track.stop());

        if (audioBlob.size > 0 && audioChunksRef.current.length > 0) {
          await handleMediaUpload(audioBlob, `voice_note_${Date.now()}.webm`, 'audio');
        }
      };

      recorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (err: any) {
      const isPermissionDenied = err?.name === 'NotAllowedError' || 
        err?.name === 'PermissionDeniedError' || 
        err?.name === 'SecurityError' ||
        err?.message?.toLowerCase().includes('permission') || 
        err?.message?.toLowerCase().includes('denied');

      console.warn('Microphone access notice:', err?.message || err);
      if (isPermissionDenied) {
        setMediaErrorToast('Microphone permission was denied. Please allow microphone access in your browser address bar settings or try opening the app in a new tab.');
      } else {
        setMediaErrorToast(`Microphone notice: ${err?.message || 'Could not access microphone.'}`);
      }
    }
  };

  const stopVoiceRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    }
  };

  const cancelVoiceRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      audioChunksRef.current = []; // Clear chunks so onstop won't process
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    }
  };

  const formatRecordingTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Main Media & File Upload Handler using Cloudinary
  const handleMediaUpload = async (
    file: File | Blob,
    customName?: string,
    forcedType?: MessageType
  ) => {
    const fileName = customName || (file as File).name || `file_${Date.now()}`;
    const fileSize = file.size;

    // Detect message type
    let msgType: MessageType = forcedType || 'file';
    if (!forcedType) {
      const mime = file.type || '';
      if (mime.startsWith('image/')) msgType = 'image';
      else if (mime.startsWith('video/')) msgType = 'video';
      else if (mime.startsWith('audio/')) msgType = 'audio';
      else if (mime.includes('pdf') || mime.includes('document') || mime.includes('word') || mime.includes('text')) msgType = 'document';
      else msgType = 'file';
    }

    const tempId = `temp-${Date.now()}`;
    const tempUrl = URL.createObjectURL(file);

    const replyData = replyingTo ? {
      id: replyingTo.id,
      username: replyingTo.username,
      content: replyingTo.content,
      type: replyingTo.type,
      file_name: replyingTo.file_name
    } : null;

    const currentSenderAvatar = userAvatar || getAvatarForUser(username) || localStorage.getItem('chat_avatar') || '';

    const tempMessage: Message = {
      id: tempId,
      type: msgType,
      content: tempUrl,
      file_name: fileName,
      file_size: fileSize,
      username,
      recipient_username: activePrivateUser || null,
      avatar: currentSenderAvatar,
      created_at: new Date().toISOString(),
      status: 'sent',
      reply_to: replyData
    };

    setMessages(prev => [...prev, tempMessage]);
    setReplyingTo(null);
    setIsUploadingMedia(true);
    setUploadProgressText(`Uploading ${fileName}...`);

    try {
      const cloudRes = await uploadToCloudinary(file, fileName);

      if (cloudRes.secure_url || cloudRes.url) {
        const finalUrl = cloudRes.secure_url || cloudRes.url;
        const uploadedMsg = { ...tempMessage, content: finalUrl, status: 'sent' as const };

        try {
          broadcastChannelRef.current?.postMessage({
            type: 'NEW_MESSAGE',
            payload: uploadedMsg
          });
        } catch {}

        try {
          const { data, error } = await supabase.from('messages').insert([
            {
              type: msgType,
              content: finalUrl,
              file_name: fileName,
              file_size: fileSize,
              username,
              recipient_username: activePrivateUser || null,
              avatar: currentSenderAvatar,
              read_by: [],
              reply_to: replyData
            }
          ]).select('*');

          if (error) {
            console.warn('Supabase media message insert warning:', error);
          }

          if (data && data[0]) {
            const realMessage = data[0] as Message;
            setMessages(prev => prev.map(m => m.id === tempId ? realMessage : m));
          } else {
            setMessages(prev => prev.map(m => m.id === tempId ? uploadedMsg : m));
          }
        } catch (dbErr) {
          console.warn('Supabase media message sync offline, kept locally:', dbErr);
          setMessages(prev => prev.map(m => m.id === tempId ? uploadedMsg : m));
        }
      }
    } catch (err) {
      console.warn('Media upload error:', err);
      try {
        const localBlobUrl = URL.createObjectURL(file);
        const fallbackMsg = { ...tempMessage, content: localBlobUrl, status: 'sent' as const };
        setMessages(prev => prev.map(m => m.id === tempId ? fallbackMsg : m));
        setMediaErrorToast(`File saved locally. Cloud upload status: ${(err as Error).message || 'Offline mode'}`);
      } catch {
        setMessages(prev => prev.filter(m => m.id !== tempId));
        alert(`Upload failed: ${(err as Error).message || 'Failed to upload file'}`);
      }
    } finally {
      setIsUploadingMedia(false);
      setUploadProgressText('');
    }
  };

  const handleForwardMessage = async (targetUser: string | null) => {
    if (!forwardingMessage) return;
    statsRef.current.messages++;
    
    const currentSenderAvatar = userAvatar || getAvatarForUser(username) || localStorage.getItem('chat_avatar') || '';
    const forwardId = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `fwd-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const newMessage: Message = {
      id: forwardId,
      created_at: new Date().toISOString(),
      type: forwardingMessage.type,
      content: forwardingMessage.content,
      username,
      recipient_username: targetUser,
      status: 'sent',
      avatar: currentSenderAvatar,
      file_name: forwardingMessage.file_name,
      file_size: forwardingMessage.file_size
    };

    setMessages((prev) => {
      const next = [...prev, newMessage];
      try {
        localStorage.setItem('chat_messages', JSON.stringify(next.slice(-200)));
      } catch {}
      return next;
    });
    setShowForwardModal(false);
    setForwardingMessage(null);

    try {
      broadcastChannelRef.current?.postMessage({
        type: 'NEW_MESSAGE',
        payload: newMessage
      });
    } catch {}
    
    const { id, ...messagePayload } = newMessage;
    try {
      const { data, error } = await supabase.from('messages').insert([messagePayload]).select();
      if (data && data.length > 0) {
        setMessages(prev => prev.map(m => m.id === newMessage.id ? (data[0] as Message) : m));
      } else {
        console.warn('Supabase forward message error, message preserved locally:', error);
        setMessages(prev => prev.map(m => m.id === newMessage.id ? { ...m, status: 'sent' } : m));
      }
    } catch (err) {
      console.warn('Supabase offline or forward error, message preserved locally:', err);
      setMessages(prev => prev.map(m => m.id === newMessage.id ? { ...m, status: 'sent' } : m));
    }
  };

  const toggleReaction = async (messageId: string, emoji: string) => {
    const msg = messages.find(m => m.id === messageId);
    if (!msg) return;

    statsRef.current.clicks++;

    const newReactions = { ...(msg.reactions || {}) };
    if (!newReactions[emoji]) newReactions[emoji] = [];
    
    if (newReactions[emoji].includes(username)) {
      newReactions[emoji] = newReactions[emoji].filter(u => u !== username);
      if (newReactions[emoji].length === 0) delete newReactions[emoji];
    } else {
      newReactions[emoji].push(username);
    }

    setMessages(prev => prev.map(m => m.id === messageId ? { ...m, reactions: newReactions } : m));
    
    try {
      broadcastChannelRef.current?.postMessage({
        type: 'REACTION',
        payload: { messageId, reactions: newReactions }
      });
    } catch {}

    try {
      await supabase.from('messages').update({ reactions: newReactions }).eq('id', messageId);
    } catch (err) {
      console.error('Reaction failed:', err);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inputMessage.trim()) {
      statsRef.current.messages++;
      
      if (typingTimerRef.current) {
        clearTimeout(typingTimerRef.current);
      }
      sendTypingStatus(false);

      const messageContent = inputMessage.trim();
      const messageId = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      
      const replyData = replyingTo ? {
        id: replyingTo.id,
        username: replyingTo.username,
        content: replyingTo.content,
        type: replyingTo.type,
        file_name: replyingTo.file_name
      } : null;

      const currentSenderAvatar = userAvatar || getAvatarForUser(username) || localStorage.getItem('chat_avatar') || '';

      const newMessage: Message = {
        id: messageId,
        type: 'text',
        content: messageContent,
        username,
        recipient_username: activePrivateUser || null,
        avatar: currentSenderAvatar,
        created_at: new Date().toISOString(),
        status: 'sent',
        reply_to: replyData
      };
      
      // 1. Immediately update state and localStorage so the message appears instantly and is NEVER lost
      setMessages(prev => {
        const next = [...prev, newMessage];
        try {
          localStorage.setItem('chat_messages', JSON.stringify(next.slice(-200)));
        } catch {}
        return next;
      });
      setInputMessage('');
      setReplyingTo(null);

      // 2. Broadcast across tabs in real-time
      try {
        broadcastChannelRef.current?.postMessage({
          type: 'NEW_MESSAGE',
          payload: newMessage
        });
      } catch (bcErr) {
        console.warn('BroadcastChannel error:', bcErr);
      }

      // 3. Try Supabase cloud sync
      try {
        const { data, error } = await supabase.from('messages').insert([
          {
            type: 'text',
            content: newMessage.content,
            username: newMessage.username,
            recipient_username: activePrivateUser || null,
            avatar: currentSenderAvatar,
            read_by: [],
            reply_to: replyData
          }
        ]).select('*');

        if (data && data[0]) {
          const realMessage = data[0] as Message;
          setMessages(prev => {
            if (prev.some(m => m.id === realMessage.id)) {
              return prev.filter(m => m.id !== messageId);
            }
            return prev.map(m => m.id === messageId ? realMessage : m);
          });
        } else {
          // If Supabase has an error or table schema mismatch, keep the message locally!
          console.warn('Supabase sync notice (message preserved locally):', error);
          setMessages(prev => prev.map(m => m.id === messageId ? { ...m, status: 'sent' } : m));
        }
      } catch (err) {
        // Network / offline error: Keep message locally, NEVER delete it!
        console.warn('Supabase offline or network error, message preserved locally:', err);
        setMessages(prev => prev.map(m => m.id === messageId ? { ...m, status: 'sent' } : m));
      }
    }
  };

  const triggerSelectAttachment = (type: 'image' | 'video' | 'audio' | 'document' | 'file') => {
    setSelectedMediaType(type);
    setShowAttachmentMenu(false);

    let accept = '*/*';
    if (type === 'image') accept = 'image/*';
    else if (type === 'video') accept = 'video/*';
    else if (type === 'audio') accept = 'audio/*';
    else if (type === 'document') accept = '.pdf,.doc,.docx,.xls,.xlsx,.txt,.ppt,.pptx';
    else accept = '.zip,.rar,.7z,.tar,.gz,.pdf,.doc,.docx,.xls,.xlsx,.txt,.mp3,.mp4,*/*';

    setAttachmentAcceptType(accept);

    setTimeout(() => {
      mediaFileInputRef.current?.click();
    }, 100);
  };

  const handleMediaFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      Array.from(files).forEach((f: File) => {
        handleMediaUpload(f);
      });
      if (mediaFileInputRef.current) {
        mediaFileInputRef.current.value = '';
      }
    }
  };

  const triggerBlobDownload = (blob: Blob, fileName: string) => {
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
  };

  const handleDownloadFile = (e: React.MouseEvent, fileUrl: string, fileName?: string, msgId?: string) => {
    e.preventDefault();
    e.stopPropagation();

    if (!fileUrl) return;

    if (msgId) {
      setDownloadingFileId(msgId);
      // Automatically clear downloading status after a split second since download begins instantly
      setTimeout(() => setDownloadingFileId(null), 800);
    }
    
    const nameToSave = fileName || 'download';
    
    // Ensure clean URL without invalid fl_attachment transformations on raw assets
    const cleanUrl = getCloudinaryDownloadUrl(fileUrl, nameToSave);

    try {
      // 1. Direct Blob/Data URI/Local download
      if (cleanUrl.startsWith('data:') || cleanUrl.startsWith('blob:') || cleanUrl.startsWith(window.location.origin)) {
        const a = document.createElement('a');
        a.href = cleanUrl;
        a.download = nameToSave;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        return;
      }

      // 2. Direct external file trigger synchronously
      // Open in new tab or trigger direct download with native user click context
      // This is 100% immune to popup blockers, CORS errors, and iframe white-screen navigation!
      const a = document.createElement('a');
      a.href = cleanUrl;
      a.download = nameToSave;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      console.error('Download error:', err);
      // Synchronous fallback
      window.open(cleanUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      Array.from(e.dataTransfer.files).forEach((f: File) => handleMediaUpload(f));
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    if (e.clipboardData.files && e.clipboardData.files.length > 0) {
      e.preventDefault();
      Array.from(e.clipboardData.files).forEach((f: File) => handleMediaUpload(f));
    }
  };

  const formatTime = (timestamp: string) => {
    if (!timestamp) return '';
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: 'numeric',
      hour12: true,
    }).format(new Date(timestamp));
  };

  // Unique list of users for private messages (Always declared before conditional returns to obey Rules of Hooks)
  const privateMessageUsers = useMemo(() => {
    const list = new Set<string>();
    const currUser = (username || '').toLowerCase();
    messages.forEach((m) => {
      if (m.recipient_username) {
        const mSender = (m.username || '').toLowerCase();
        const mRecip = (m.recipient_username || '').toLowerCase();
        if (currUser && mSender === currUser) {
          list.add(m.recipient_username);
        } else if (currUser && mRecip === currUser) {
          list.add(m.username);
        }
      }
    });
    if (activePrivateUser && !Array.from(list).some(u => (u || '').toLowerCase() === activePrivateUser.toLowerCase())) {
      list.add(activePrivateUser);
    }
    return Array.from(list);
  }, [messages, username, activePrivateUser]);

  // Full roster of organization members for equal lead distribution & master dashboard
  const allOrganizationMembers = useMemo(() => {
    const set = new Set<string>();
    if (username) set.add(username);
    groupMembers.forEach(m => { if (m.username) set.add(m.username); });
    privateMessageUsers.forEach(u => { if (u) set.add(u); });
    onlineUsersList.forEach(u => { if (u.username) set.add(u.username); });
    return Array.from(set).filter(Boolean);
  }, [username, groupMembers, privateMessageUsers, onlineUsersList]);

  // Filter messages for activePrivateUser or Global Chat, excluding blocked users
  const filteredMessages = useMemo(() => {
    const currUser = (username || '').toLowerCase();
    let result = messages.filter((m) => {
      const mSender = (m.username || '').toLowerCase();
      // Hide messages from blocked users (unless message is from self)
      if (mSender && currUser && mSender !== currUser && blockedUsers.some(b => (b || '').toLowerCase() === mSender)) {
        return false;
      }
      if (activePrivateUser) {
        if (!m.recipient_username) return false;
        const mRecip = (m.recipient_username || '').toLowerCase();
        const activeLower = activePrivateUser.toLowerCase();
        const isFromMeToActive =
          currUser &&
          mSender === currUser &&
          mRecip === activeLower;
        const isFromActiveToMe =
          currUser &&
          mSender === activeLower &&
          mRecip === currUser;
        return isFromMeToActive || isFromActiveToMe;
      }
      return !m.recipient_username;
    });

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(m => 
        (m.content && m.content.toLowerCase().includes(q)) || 
        (m.username && m.username.toLowerCase().includes(q))
      );
    }
    
    return result;
  }, [messages, activePrivateUser, username, blockedUsers, searchQuery]);

  if (!isJoined) {
    return (
      <div className="min-h-screen bg-[#0f172a] relative flex items-center justify-center p-4 font-sans text-white overflow-hidden w-full">
        <div className="absolute inset-0 z-0 pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-600/30 rounded-full blur-[120px]"></div>
          <div className="absolute bottom-[10%] right-[-5%] w-[45%] h-[45%] bg-cyan-600/20 rounded-full blur-[100px]"></div>
          <div className="absolute top-[30%] right-[20%] w-[30%] h-[30%] bg-pink-600/10 rounded-full blur-[150px]"></div>
        </div>
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/5 backdrop-blur-2xl p-6 md:p-8 rounded-3xl shadow-2xl w-full max-w-md border border-white/10 relative z-10 my-8"
        >
          <div className="w-14 h-14 bg-gradient-to-tr from-cyan-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-white/20 shadow-lg shadow-cyan-500/20">
            <User className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-center tracking-tight mb-1">Global Chat Room</h1>
          <p className="text-white/60 text-center mb-6 text-xs">Sign in with email/username or create a new profile</p>

          {/* Auth Tab Buttons */}
          <div className="flex bg-white/5 p-1 rounded-xl mb-6 border border-white/10">
            <button
              type="button"
              onClick={() => { setAuthMode('login'); setAuthError(''); }}
              className={cn("flex-1 py-2 text-xs font-semibold rounded-lg transition-all", authMode === 'login' ? "bg-cyan-500 text-white shadow-md" : "text-white/60 hover:text-white")}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setAuthMode('register'); setAuthError(''); }}
              className={cn("flex-1 py-2 text-xs font-semibold rounded-lg transition-all", authMode === 'register' ? "bg-cyan-500 text-white shadow-md" : "text-white/60 hover:text-white")}
            >
              Register
            </button>
          </div>

          {authError && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/20 border border-red-500/40 text-red-300 text-xs flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 flex-shrink-0" />
              <span>{authError}</span>
            </div>
          )}

          {authMode === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-white/80 mb-1 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-cyan-400" /> Username or Email
                </label>
                <input
                  type="text"
                  required
                  value={loginIdentifier}
                  onChange={(e) => setLoginIdentifier(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-white/10 border border-white/10 text-white text-sm placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-transparent transition-all backdrop-blur-md"
                  placeholder="Enter email or username"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-white/80 mb-1 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-cyan-400" /> Password
                </label>
                <div className="relative">
                  <input
                    type={showAuthPassword ? "text" : "password"}
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="w-full px-4 py-2.5 pr-10 rounded-xl bg-white/10 border border-white/10 text-white text-sm placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-transparent transition-all backdrop-blur-md"
                    placeholder="Enter password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAuthPassword(!showAuthPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white text-xs"
                  >
                    {showAuthPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isAuthenticating || !loginIdentifier.trim()}
                className="w-full bg-cyan-500 text-white font-semibold py-3 px-4 rounded-xl hover:bg-cyan-400 transition-colors shadow-lg shadow-cyan-500/20 focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
              >
                {isAuthenticating && <Loader2 className="w-4 h-4 animate-spin" />}
                Enter Chat
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-white/80 mb-1 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-cyan-400" /> Username <span className="text-cyan-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  maxLength={20}
                  value={regUsername}
                  onChange={(e) => setRegUsername(e.target.value)}
                  className="w-full px-4 py-2 rounded-xl bg-white/10 border border-white/10 text-white text-sm placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-transparent transition-all backdrop-blur-md"
                  placeholder="E.g. alex_dev"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-white/80 mb-1 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-cyan-400" /> Email Address
                </label>
                <input
                  type="email"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  className="w-full px-4 py-2 rounded-xl bg-white/10 border border-white/10 text-white text-sm placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-transparent transition-all backdrop-blur-md"
                  placeholder="alex@example.com"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-white/80 mb-1 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-cyan-400" /> Phone Number
                </label>
                <input
                  type="tel"
                  value={regPhone}
                  onChange={(e) => setRegPhone(e.target.value)}
                  className="w-full px-4 py-2 rounded-xl bg-white/10 border border-white/10 text-white text-sm placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-transparent transition-all backdrop-blur-md"
                  placeholder="+1 234 567 8900"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-white/80 mb-1 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-cyan-400" /> Profile Bio / Description
                </label>
                <input
                  type="text"
                  maxLength={60}
                  value={regBio}
                  onChange={(e) => setRegBio(e.target.value)}
                  className="w-full px-4 py-2 rounded-xl bg-white/10 border border-white/10 text-white text-sm placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-transparent transition-all backdrop-blur-md"
                  placeholder="Tell us about yourself..."
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-white/80 mb-1 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-cyan-400" /> Password
                </label>
                <div className="relative">
                  <input
                    type={showAuthPassword ? "text" : "password"}
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    className="w-full px-4 py-2 pr-10 rounded-xl bg-white/10 border border-white/10 text-white text-sm placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-transparent transition-all backdrop-blur-md"
                    placeholder="Set password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAuthPassword(!showAuthPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white text-xs"
                  >
                    {showAuthPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isAuthenticating || !regUsername.trim()}
                className="w-full bg-cyan-500 text-white font-semibold py-3 px-4 rounded-xl hover:bg-cyan-400 transition-colors shadow-lg shadow-cyan-500/20 focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
              >
                {isAuthenticating && <Loader2 className="w-4 h-4 animate-spin" />}
                Create Account & Join
              </button>
            </form>
          )}
        </motion.div>
      </div>
    );
  }

  // Real-time Banned / Suspended Account View
  if (isBanned) {
    const existingAppeal = (activeGroupSettings.ban_appeals || []).find(
      a => a.username.toLowerCase() === username.toLowerCase()
    );

    return (
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-4 sm:p-6 text-white font-sans relative overflow-hidden">
        {/* Ambient blur effects */}
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-red-600/20 rounded-full blur-3xl pointer-events-none animate-pulse" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />

        <div className="w-full max-w-lg bg-slate-900/90 border border-red-500/30 rounded-3xl p-6 md:p-8 shadow-2xl relative z-10 backdrop-blur-xl text-center space-y-6">
          <div className="w-20 h-20 bg-red-500/10 border-2 border-red-500/40 rounded-3xl flex items-center justify-center mx-auto text-red-400 shadow-xl shadow-red-500/10">
            <ShieldAlert className="w-10 h-10 animate-bounce" />
          </div>

          <div>
            <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-red-400 flex items-center justify-center gap-2">
              Account Suspended
            </h2>
            <p className="text-sm text-white/80 mt-2">
              Your account <span className="text-cyan-300 font-semibold">@{username}</span> has been banned by the group owner.
            </p>
            <p className="text-xs text-white/50 mt-1">
              You are currently restricted from sending or viewing chat messages in this group.
            </p>
          </div>

          {/* Appeal / Review Section */}
          <div className="bg-white/5 p-5 rounded-2xl border border-white/10 text-left space-y-3">
            <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm">
              <Mail className="w-4 h-4" /> Request Review / Appeal Ban
            </div>

            {existingAppeal || appealSubmittedSuccess ? (
              <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-xl p-3.5 text-xs text-cyan-200 space-y-1">
                <p className="font-semibold text-cyan-300 flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-green-400" /> Review Request Submitted
                </p>
                <p className="text-white/80">
                  Your review appeal was sent to the group owner. Please wait for the owner to inspect your request.
                </p>
                {(existingAppeal?.message || appealInput) && (
                  <p className="text-[10px] text-white/60 italic pt-1 border-t border-cyan-500/20">
                    "{existingAppeal?.message || appealInput}"
                  </p>
                )}
              </div>
            ) : (
              <form onSubmit={handleBanAppealSubmit} className="space-y-3">
                <p className="text-xs text-white/70">
                  If you believe this ban was a mistake, write a request message to the owner below:
                </p>
                <textarea
                  required
                  rows={3}
                  value={appealInput}
                  onChange={(e) => setAppealInput(e.target.value)}
                  placeholder="Explain why your account should be unbanned..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white text-xs placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 resize-none"
                />
                <button
                  type="submit"
                  disabled={isSubmittingAppeal || !appealInput.trim()}
                  className="w-full bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 cursor-pointer"
                >
                  {isSubmittingAppeal ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Submit Review Request
                </button>
              </form>
            )}
          </div>

          {/* Logout button */}
          <button
            onClick={() => {
              setIsJoined(false);
              localStorage.removeItem('chat_username');
            }}
            className="w-full bg-white/10 hover:bg-red-500/20 text-white hover:text-red-300 font-semibold py-3 px-4 rounded-xl text-xs transition-colors flex items-center justify-center gap-2 border border-white/10 cursor-pointer"
          >
            <LogOut className="w-4 h-4" /> Logout & Switch Account
          </button>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="h-[100dvh] sm:h-screen bg-[#0f172a] relative flex flex-col p-0 sm:p-4 md:p-6 font-sans text-white overflow-hidden w-full"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => setActiveMessageId(null)}
    >
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-600/30 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[10%] right-[-5%] w-[45%] h-[45%] bg-cyan-600/20 rounded-full blur-[100px]"></div>
        <div className="absolute top-[30%] right-[20%] w-[30%] h-[30%] bg-pink-600/10 rounded-full blur-[150px]"></div>
      </div>

      {isDragging && (
        <div className="absolute inset-0 z-[60] bg-[#0f172a]/60 backdrop-blur-sm m-0 sm:m-4 md:m-6 rounded-none sm:rounded-3xl border-2 border-dashed border-cyan-400 flex flex-col items-center justify-center pointer-events-none">
          <div className="bg-slate-900/90 px-8 py-6 rounded-3xl flex flex-col items-center gap-4 shadow-2xl border border-white/10">
            <ImageIcon className="w-12 h-12 text-cyan-400 animate-bounce" />
            <h2 className="text-xl font-bold tracking-tight">Drop image to upload</h2>
          </div>
        </div>
      )}

      {/* Real-time In-App Floating Notification Banner */}
      <AnimatePresence>
        {toastNotification && (
          <motion.div
            initial={{ opacity: 0, y: -25, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -25, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="fixed top-3 sm:top-5 right-3 sm:right-6 left-3 sm:left-auto sm:w-96 z-[130] pointer-events-auto shadow-2xl"
          >
            <div className="bg-slate-900/95 backdrop-blur-2xl border border-cyan-500/40 rounded-2xl p-3 sm:p-3.5 shadow-2xl shadow-cyan-950/60 flex items-start gap-3">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-xs font-bold border border-cyan-400/40 overflow-hidden flex-shrink-0 shadow-md">
                {toastNotification.avatar ? (
                  <img src={toastNotification.avatar} alt={toastNotification.sender} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-white">{toastNotification.sender.substring(0, 2).toUpperCase()}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5 truncate">
                    <span className="text-cyan-400 font-semibold truncate">@{toastNotification.sender}</span>
                    {toastNotification.isPrivate && (
                      <span className="text-[9px] bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded border border-purple-500/30 flex-shrink-0 font-semibold">
                        Private
                      </span>
                    )}
                  </span>
                  <span className="text-[10px] text-white/40 flex-shrink-0">Just now</span>
                </div>
                <p className="text-xs text-white/80 line-clamp-2 mt-0.5 break-words">
                  {toastNotification.content}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <button
                    onClick={() => {
                      if (toastNotification.isPrivate && toastNotification.targetUsername) {
                        setActivePrivateUser(toastNotification.targetUsername);
                      } else {
                        setActivePrivateUser(null);
                      }
                      setToastNotification(null);
                    }}
                    className="text-[11px] font-semibold text-cyan-300 hover:text-cyan-200 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 px-2.5 py-1 rounded-lg transition-colors cursor-pointer active:scale-95"
                  >
                    Open Chat
                  </button>
                  <button
                    onClick={() => setToastNotification(null)}
                    className="text-[11px] text-white/50 hover:text-white/80 px-2 py-1 transition-colors cursor-pointer"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
              <button
                onClick={() => setToastNotification(null)}
                className="text-white/40 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors flex-shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Media / Microphone Permission Notice Banner */}
      <AnimatePresence>
        {mediaErrorToast && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="fixed top-3 sm:top-5 left-1/2 -translate-x-1/2 z-[140] w-[94%] max-w-md pointer-events-auto shadow-2xl"
          >
            <div className="bg-slate-900/95 backdrop-blur-2xl border border-amber-500/40 rounded-2xl p-3.5 shadow-2xl shadow-amber-950/50 flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center flex-shrink-0 border border-amber-500/30">
                <MicOff className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-white flex items-center gap-1.5">
                  Microphone Access Notice
                </p>
                <p className="text-xs text-amber-200/90 mt-1 leading-relaxed break-words">
                  {mediaErrorToast}
                </p>
                <div className="flex items-center gap-2 mt-2.5">
                  <button
                    onClick={() => setMediaErrorToast(null)}
                    className="text-[11px] font-semibold text-white/90 bg-white/10 hover:bg-white/20 border border-white/20 px-3 py-1 rounded-lg transition-colors cursor-pointer active:scale-95"
                  >
                    Got it
                  </button>
                </div>
              </div>
              <button
                onClick={() => setMediaErrorToast(null)}
                className="text-white/40 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors flex-shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 w-full max-w-4xl mx-auto bg-white/5 backdrop-blur-3xl flex flex-col rounded-none sm:rounded-3xl border-0 sm:border border-white/10 overflow-hidden relative z-10 shadow-2xl">
        {/* Header */}
        <header className="px-3 py-2.5 sm:px-5 sm:py-4 md:px-6 border-b border-white/10 flex items-center justify-between gap-2 md:gap-3 bg-slate-900/40 backdrop-blur-md">
          {activePrivateUser ? (
            <div className="flex items-center gap-1.5 sm:gap-3 min-w-0 flex-1">
              {/* Mobile Back Button to Global Chat */}
              <button
                onClick={() => setActivePrivateUser(null)}
                className="p-1.5 -ml-1 text-white/70 hover:text-white rounded-xl hover:bg-white/10 active:scale-95 transition-all flex-shrink-0 sm:hidden"
                title="Back to Global Chat"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>

              <div 
                className="flex items-center gap-2 sm:gap-3 cursor-pointer group min-w-0"
                onClick={() => openUserProfileCard(activePrivateUser)}
                title="Click to view profile"
              >
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-xs sm:text-sm font-bold border border-cyan-400/50 shadow-md flex-shrink-0 overflow-hidden group-hover:scale-105 transition-transform">
                  {getAvatarForUser(activePrivateUser) ? (
                    <img src={getAvatarForUser(activePrivateUser)} alt={activePrivateUser} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-white text-xs sm:text-sm font-bold">{activePrivateUser.substring(0, 2).toUpperCase()}</span>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1 sm:gap-2">
                    <h3 className="text-sm sm:text-base font-bold tracking-tight text-white flex items-center gap-1 group-hover:text-cyan-300 transition-colors truncate">
                      <span className="text-cyan-400 text-xs flex-shrink-0">🔒</span>
                      <span className="text-white/90 truncate">@{activePrivateUser}</span>
                    </h3>
                  </div>
                  <p className="text-[10px] sm:text-xs text-cyan-300 font-medium flex items-center gap-1 truncate">
                    {(() => {
                      const isTargetOnline = onlineUsersList.some(u => u.username.toLowerCase() === activePrivateUser.toLowerCase());
                      const member = groupMembers.find(m => m.username?.toLowerCase() === activePrivateUser.toLowerCase());
                      const userMsgs = messages.filter(m => m.username?.toLowerCase() === activePrivateUser.toLowerCase());
                      const latestMsgDate = userMsgs.length > 0 ? userMsgs[userMsgs.length - 1].created_at : undefined;
                      const status = formatLastSeen(member?.last_seen || latestMsgDate, isTargetOnline);
                      return isTargetOnline ? (
                        <>
                          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse flex-shrink-0"></span>
                          <span className="text-green-400 truncate">Online now</span>
                        </>
                      ) : (
                        <>
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-500 flex-shrink-0"></span>
                          <span className="text-white/60 truncate">{status.text}</span>
                        </>
                      );
                    })()}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 sm:gap-3.5 min-w-0 flex-1">
              <div 
                className={cn("w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-tr from-purple-500 to-pink-500 flex items-center justify-center text-xs sm:text-sm font-bold overflow-hidden border border-white/10 cursor-pointer hover:opacity-80 flex-shrink-0 shadow-md")}
                onClick={openGroupSettings}
                title="Click to view/edit Group Info"
              >
                {activeGroupSettings.avatar_url ? (
                  <img src={activeGroupSettings.avatar_url} alt="Group Avatar" className="w-full h-full object-cover" />
                ) : (
                  "GC"
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1 sm:gap-2">
                  <h3 
                    className="text-sm sm:text-base md:text-lg font-bold tracking-tight cursor-pointer hover:text-cyan-300 transition-colors truncate text-white"
                    onClick={openGroupSettings}
                    title="Click to view/edit Group Info"
                  >
                    {activeGroupSettings.name || 'Global Group Chat'}
                  </h3>
                  <button
                    onClick={openGroupSettings}
                    className="p-1 hover:bg-white/10 rounded-lg text-cyan-400 transition-colors flex-shrink-0"
                    title="Group Settings"
                  >
                    <Edit2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  </button>
                </div>
                <p className="text-[10px] sm:text-xs text-cyan-400 flex items-center gap-1 truncate">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse flex-shrink-0"></span>
                  <span className="truncate">{onlineUsersCount} online<span className="hidden sm:inline"> • {activeGroupSettings.description || 'Real-time Active'}</span></span>
                </p>
              </div>
            </div>
          )}

          {/* Mobile Header Quick Actions */}
          <div className="flex sm:hidden items-center gap-1 flex-shrink-0">
            {activePrivateUser && (
              <>
                <button 
                  onClick={() => startCall(activePrivateUser, 'audio')}
                  className="w-8 h-8 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center justify-center active:scale-95 transition-all"
                  title="Audio Call"
                >
                  <PhoneCall className="w-3.5 h-3.5" />
                </button>
                <button 
                  onClick={() => startCall(activePrivateUser, 'video')}
                  className="w-8 h-8 rounded-full bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 flex items-center justify-center active:scale-95 transition-all"
                  title="Video Call"
                >
                  <VideoIcon className="w-3.5 h-3.5" />
                </button>
              </>
            )}

            <button
              onClick={() => setShowMobileSearch(!showMobileSearch)}
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center border transition-all active:scale-95",
                showMobileSearch || searchQuery
                  ? "bg-cyan-500 text-white border-cyan-400 shadow-sm"
                  : "bg-white/5 text-white/70 border-white/10 hover:text-white"
              )}
              title="Search Messages"
            >
              <Search className="w-3.5 h-3.5" />
            </button>

            <button 
              onClick={() => setShowLeadManagement(true)}
              className="w-8 h-8 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/30 flex items-center justify-center active:scale-95 transition-all"
              title="Lead Management"
            >
              <Briefcase className="w-3.5 h-3.5" />
            </button>

            {(isOwner || isAdmin) && (
              <button 
                onClick={() => setShowOwnerDashboard(true)}
                className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-500/20 to-purple-500/20 text-amber-300 border border-amber-500/40 flex items-center justify-center shadow-sm active:scale-95 transition-all"
                title="Owner & Admin Dashboard"
              >
                <Crown className="w-3.5 h-3.5 text-amber-400" />
              </button>
            )}

            <button
              onClick={() => setShowMobileMenu(true)}
              className="w-8 h-8 rounded-full bg-white/5 border border-white/10 text-white/80 hover:text-white flex items-center justify-center relative active:scale-95 transition-all"
              title="More Actions"
            >
              <MoreVertical className="w-4 h-4" />
              {starredIds.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-amber-400 rounded-full ring-2 ring-slate-900 animate-pulse" />
              )}
            </button>
          </div>

          {/* Desktop Header Actions */}
          <div className="hidden sm:flex gap-1.5 md:gap-2 items-center flex-shrink-0">
            {isInstallable && (
              <button
                onClick={handleInstallApp}
                className="px-2.5 sm:px-3 h-8 sm:h-9 rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-[10px] sm:text-xs font-bold transition-all flex items-center gap-1 shadow-lg shadow-emerald-500/10 border border-emerald-400/30 active:scale-95 cursor-pointer"
                title="Install app on your device"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Install</span>
              </button>
            )}

            {activePrivateUser && (
              <button
                onClick={() => setActivePrivateUser(null)}
                className="px-2.5 sm:px-3 h-8 sm:h-9 rounded-full bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 text-[10px] sm:text-xs font-semibold border border-cyan-500/40 transition-colors flex items-center gap-1 shadow-sm"
              >
                <Users className="w-3.5 h-3.5" />
                <span>Public Chat</span>
              </button>
            )}

            <button 
              onClick={() => openUserProfileCard(username)}
              className="h-8 sm:h-9 px-2 sm:px-3 rounded-full bg-white/5 flex items-center gap-1.5 border border-white/10 hover:bg-white/10 transition-colors text-white text-[10px] sm:text-xs font-medium"
              title="View Profile"
            >
              <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-cyan-500 to-purple-500 flex items-center justify-center overflow-hidden border border-white/20 flex-shrink-0">
                {userAvatar ? (
                  <img src={userAvatar} alt={username} className="w-full h-full object-cover" />
                ) : (
                  <User className="w-3 h-3 text-white" />
                )}
              </div>
              <span className="max-w-[80px] truncate">{username}</span>
            </button>

            {/* Starred Messages Badge */}
            <button
              onClick={() => setShowStarredDrawer(true)}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-slate-800/80 hover:bg-slate-700 text-amber-400 flex items-center justify-center border border-white/10 hover:border-amber-400/30 transition-all flex-shrink-0 relative cursor-pointer active:scale-95"
              title="Starred Bookmarks"
            >
              <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
              {starredIds.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center animate-pulse">
                  {starredIds.length}
                </span>
              )}
            </button>

            {/* Sound alert chime toggle */}
            <button 
              onClick={toggleSoundAlerts}
              className={cn(
                "w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center border transition-all flex-shrink-0 cursor-pointer active:scale-95",
                soundEnabled 
                  ? "bg-cyan-500/15 text-cyan-300 border-cyan-500/30 hover:bg-cyan-500/25 shadow-sm shadow-cyan-500/10" 
                  : "bg-white/5 text-white/40 border-white/10 hover:bg-white/10 hover:text-white"
              )}
              title={soundEnabled ? "Audio chimes: ON (Click to mute)" : "Audio chimes: OFF (Click to enable)"}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4 text-cyan-400" /> : <VolumeX className="w-4 h-4 opacity-60" />}
            </button>

            {/* Desktop Notification toggle & request */}
            <button 
              onClick={requestNotificationPermission}
              className={cn(
                "w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center border transition-all flex-shrink-0 cursor-pointer active:scale-95 relative",
                notificationsEnabled
                  ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25 shadow-sm shadow-emerald-500/10"
                  : "bg-white/5 text-white/40 border-white/10 hover:bg-white/10 hover:text-white"
              )}
              title={notificationsEnabled ? "Push Notifications: ACTIVE" : "Push Notifications: Inactive (Click to allow)"}
            >
              {notificationsEnabled ? <BellRing className="w-4 h-4 text-emerald-400" /> : <BellOff className="w-4 h-4 opacity-60" />}
              {notificationsEnabled && (
                <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              )}
            </button>

            <button 
              onClick={openSettings}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white/5 flex items-center justify-center border border-white/10 hover:bg-white/10 transition-colors text-white/80 hover:text-white flex-shrink-0"
              title="Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
            
            <button 
              onClick={() => setShowLeadManagement(true)}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-blue-500/10 flex items-center justify-center border border-blue-500/30 hover:bg-blue-500/20 transition-colors text-blue-400 flex-shrink-0"
              title="Lead Management"
            >
              <Briefcase className="w-4 h-4" />
            </button>

            {/* Owner & Admin Command Center Dashboard */}
            {(isOwner || isAdmin) && (
              <button 
                onClick={() => setShowOwnerDashboard(true)}
                className="h-8 sm:h-9 px-2.5 sm:px-3 rounded-full bg-gradient-to-r from-amber-500/20 via-purple-500/25 to-purple-600/25 flex items-center justify-center border border-amber-500/40 hover:border-amber-400 hover:scale-105 transition-all text-amber-300 gap-1.5 flex-shrink-0 cursor-pointer shadow-md shadow-purple-500/20"
                title="Owner & Admin Command Center Dashboard"
              >
                <Crown className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-[11px] sm:text-xs font-bold text-amber-200">Dashboard</span>
              </button>
            )}
            
            {isAdmin && (
              <button 
                onClick={openAnalyticsDashboard}
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-purple-500/10 flex items-center justify-center border border-purple-500/30 hover:bg-purple-500/20 transition-colors text-purple-400 flex-shrink-0"
                title="Team Analytics"
              >
                <Activity className="w-4 h-4" />
              </button>
            )}

            <button 
              onClick={handleLogout}
              className="px-2.5 sm:px-3 h-8 sm:h-9 rounded-full bg-white/5 flex items-center justify-center border border-white/10 hover:bg-white/10 transition-colors text-[10px] sm:text-xs font-medium text-red-400 gap-1 flex-shrink-0"
              title="Logout"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Logout</span>
            </button>
          </div>
        </header>

        {/* Mobile Slide-down Search Bar */}
        <AnimatePresence>
          {(showMobileSearch || searchQuery) && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="sm:hidden bg-slate-900/95 border-b border-white/10 px-3 py-2 flex items-center gap-2 backdrop-blur-xl overflow-hidden"
            >
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-white/40 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input 
                  type="text"
                  autoFocus
                  placeholder="Search in messages..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-full py-1.5 pl-8 pr-8 text-xs text-white placeholder:text-white/40 focus:outline-none focus:border-cyan-500/60 transition-all"
                />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <button 
                onClick={() => { setShowMobileSearch(false); setSearchQuery(''); }}
                className="text-xs text-cyan-400 hover:text-cyan-300 font-medium px-2 py-1 flex-shrink-0"
              >
                Done
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Private Messages Bar / Switcher */}
        <div className="flex flex-row flex-nowrap items-center gap-1.5 sm:gap-2 overflow-x-auto px-2.5 sm:px-4 py-1.5 sm:py-2 bg-black/25 border-b border-white/5 custom-scrollbar text-xs scrollbar-none">
          <button
            onClick={() => setActivePrivateUser(null)}
            className={cn(
              "px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full font-medium transition-all flex items-center gap-1.5 flex-shrink-0 text-xs",
              !activePrivateUser 
                ? "bg-cyan-500 text-white font-semibold shadow-md shadow-cyan-500/20" 
                : "bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
            )}
          >
            <Users className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            <span>Global Chat</span>
          </button>

          {privateMessageUsers.map((targetUser) => {
            const isOnline = onlineUsersList.some(u => u.username.toLowerCase() === targetUser.toLowerCase());
            const isSelected = activePrivateUser?.toLowerCase() === targetUser.toLowerCase();
            const hasUnread = messages.some(m => 
              m.recipient_username && 
              m.recipient_username.toLowerCase() === username.toLowerCase() && 
              m.username.toLowerCase() === targetUser.toLowerCase() &&
              (!m.read_by || !m.read_by.includes(username))
            );
            const userAvatarImg = getAvatarForUser(targetUser);

            return (
              <button
                key={targetUser}
                onClick={() => setActivePrivateUser(targetUser)}
                className={cn(
                  "px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full font-medium transition-all flex items-center gap-1.5 flex-shrink-0 text-xs border",
                  isSelected
                    ? "bg-purple-600 border-purple-400 text-white shadow-md shadow-purple-500/20 font-semibold"
                    : "bg-white/5 border-white/10 text-cyan-300 hover:bg-white/10 hover:border-cyan-500/40"
                )}
              >
                <div className="w-4 h-4 rounded-full overflow-hidden bg-cyan-500/30 flex items-center justify-center flex-shrink-0 text-[9px] font-bold">
                  {userAvatarImg ? (
                    <img src={userAvatarImg} alt={targetUser} className="w-full h-full object-cover" />
                  ) : (
                    targetUser.substring(0, 1).toUpperCase()
                  )}
                </div>
                <span>@{targetUser}</span>
                <span className={cn("w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full flex-shrink-0", isOnline ? "bg-green-400 animate-pulse" : "bg-slate-500")} />
                {hasUnread && <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-cyan-400 animate-ping flex-shrink-0" title="New unread message" />}
              </button>
            );
          })}
        </div>

        {/* Tools Header (Search & Calls for Desktop) */}
        <div className="hidden sm:flex bg-black/10 px-4 py-2 border-b border-white/5 items-center justify-between gap-3">
          {/* Search Bar */}
          <div className="relative w-full sm:max-w-md">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
              <Search className="w-4 h-4 text-white/40" />
            </div>
            <input 
              type="text"
              placeholder="Search messages..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-full py-1.5 pl-9 pr-4 text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-3 flex items-center text-white/40 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Call Buttons for Private Chat */}
          {activePrivateUser && (
            <div className="flex items-center gap-2">
              <button 
                onClick={() => startCall(activePrivateUser, 'audio')}
                className="p-2 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 transition-colors cursor-pointer active:scale-95"
                title="Audio Call"
              >
                <PhoneCall className="w-4 h-4" />
              </button>
              <button 
                onClick={() => startCall(activePrivateUser, 'video')}
                className="p-2 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/20 transition-colors cursor-pointer active:scale-95"
                title="Video Call"
              >
                <VideoIcon className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6">
          {filteredMessages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 text-white/50 space-y-3 my-auto">
              {activePrivateUser ? (
                <>
                  <div className="w-16 h-16 rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mb-2">
                    <Lock className="w-8 h-8" />
                  </div>
                  <h4 className="text-lg font-bold text-white">Private Chat with @{activePrivateUser}</h4>
                  <p className="text-xs max-w-xs text-white/60">
                    Send a private message below. Messages sent here are strictly between you and @{activePrivateUser}!
                  </p>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 rounded-full bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 mb-2">
                    <Users className="w-8 h-8" />
                  </div>
                  <h4 className="text-lg font-bold text-white">No Public Messages Yet</h4>
                  <p className="text-xs max-w-xs text-white/60">
                    Be the first to send a message in {activeGroupSettings.name || 'Global Group Chat'}!
                  </p>
                </>
              )}
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {filteredMessages.map((msg, index) => {
                const isMine = (msg.username || '').toLowerCase() === (username || '').toLowerCase();
                const prevUser = filteredMessages[index - 1]?.username || '';
                const currUser = msg.username || '';
                const showUsername = index === 0 || prevUser.toLowerCase() !== currUser.toLowerCase();
                const initialLetters = (msg.username || 'U').substring(0, 2).toUpperCase();
                const effectiveAvatar = (isMine ? (userAvatar || msg.avatar || getAvatarForUser(msg.username)) : (msg.avatar || getAvatarForUser(msg.username))) || '';

              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ type: "spring", stiffness: 400, damping: 25 }}
                  className={cn(
                    "flex items-start gap-3",
                    isMine ? "flex-row-reverse" : ""
                  )}
                >
                  <div 
                    onClick={() => openUserProfileCard(msg.username)}
                    className={cn(
                      "w-8 h-8 rounded-full flex-shrink-0 text-[10px] flex items-center justify-center font-bold border border-white/10 shadow-sm overflow-hidden cursor-pointer hover:scale-105 transition-transform",
                      !effectiveAvatar ? (isMine ? "bg-purple-600" : "bg-slate-700") : "bg-transparent"
                    )}
                  >
                    {effectiveAvatar ? (
                      <img 
                        src={effectiveAvatar} 
                        alt={msg.username} 
                        className="w-full h-full object-cover" 
                        onError={(e) => {
                          (e.currentTarget as HTMLElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      initialLetters
                    )}
                  </div>
                  
                  <div className={cn("max-w-[85%] sm:max-w-[75%] md:max-w-[70%]", isMine ? "flex flex-col items-end" : "")}>
                    <div className="relative">
                      {showUsername && !isMine && (
                        <div className="text-[10px] text-white/50 mb-1 ml-1 font-semibold select-none flex items-center gap-1">
                          <span>@{msg.username}</span>
                        </div>
                      )}
                      {msg.reply_to && (
                        <div className="mb-1 p-2 rounded-lg bg-black/20 border-l-2 border-cyan-500 text-xs text-white/70 overflow-hidden cursor-pointer hover:bg-black/30 transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            // Optional: could scroll to message, here we just show it exists
                          }}
                        >
                          <div className="font-semibold text-cyan-400 mb-0.5">{msg.reply_to.username}</div>
                          <div className="truncate">
                            {msg.reply_to.type === 'image' ? (
                              <span className="flex items-center gap-1"><ImageIcon className="w-3 h-3 text-cyan-400"/> Photo</span>
                            ) : msg.reply_to.type === 'video' ? (
                              <span className="flex items-center gap-1"><VideoIcon className="w-3 h-3 text-cyan-400"/> Video</span>
                            ) : msg.reply_to.type === 'audio' ? (
                              <span className="flex items-center gap-1"><Music className="w-3 h-3 text-cyan-400"/> Voice Note / Audio</span>
                            ) : msg.reply_to.type === 'document' || msg.reply_to.type === 'file' ? (
                              <span className="flex items-center gap-1"><FileText className="w-3 h-3 text-cyan-400"/> {msg.reply_to.file_name || 'Document / Attachment'}</span>
                            ) : (
                              msg.reply_to.content
                            )}
                          </div>
                        </div>
                      )}
                      <div
                        className={cn(
                          "p-3 rounded-2xl relative transition-all cursor-pointer shadow-sm hover:brightness-110",
                          isMine 
                            ? "bg-white/20 border border-white/20 rounded-tr-none" 
                            : "bg-white/10 border border-white/10 rounded-tl-none",
                          activeMessageId === msg.id ? "ring-2 ring-cyan-500/50" : ""
                        )}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!editingMessageId) {
                            setActiveMessageId(activeMessageId === msg.id ? null : msg.id);
                          }
                        }}
                      >
                        {msg.type === 'text' ? (
                          <p className="text-sm break-words whitespace-pre-wrap leading-relaxed">
                            {renderMessageContent(msg.content)}
                          </p>
                        ) : msg.type === 'image' ? (
                          <div className="bg-slate-800 rounded-xl flex items-center justify-center overflow-hidden border border-white/10 max-w-sm">
                            <img 
                              src={msg.content} 
                              alt="Shared image" 
                              className="rounded-lg max-h-72 object-contain cursor-pointer hover:opacity-90 transition-opacity"
                              loading="lazy"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPreviewImage(msg.content);
                              }}
                            />
                          </div>
                        ) : msg.type === 'video' ? (
                          <div className="bg-slate-900/90 rounded-xl overflow-hidden border border-white/10 max-w-sm p-1">
                            <video 
                              src={msg.content} 
                              controls 
                              className="w-full max-h-72 rounded-lg bg-black"
                              preload="metadata"
                            />
                          </div>
                        ) : msg.type === 'audio' ? (
                          <div className="bg-slate-900/90 p-3 rounded-xl border border-cyan-500/30 flex items-center gap-3 min-w-[220px] max-w-sm">
                            <div className="w-10 h-10 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center flex-shrink-0 border border-cyan-500/30">
                              <Music className="w-5 h-5 animate-pulse" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-semibold text-cyan-300 truncate mb-1 flex items-center gap-1">
                                <span>🎙️ {msg.file_name || 'Voice Note'}</span>
                              </div>
                              <audio src={msg.content} controls className="w-full h-8" />
                            </div>
                          </div>
                        ) : (
                          /* Document or Zip File */
                          <div className="bg-slate-900/90 p-3.5 rounded-xl border border-white/15 flex items-center justify-between gap-3 min-w-[220px] max-w-xs shadow-md">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-10 h-10 rounded-lg bg-cyan-500/20 text-cyan-300 flex items-center justify-center flex-shrink-0 border border-cyan-500/30">
                                {msg.file_name?.toLowerCase().endsWith('.zip') || msg.file_name?.toLowerCase().endsWith('.rar') || msg.file_name?.toLowerCase().endsWith('.7z') ? (
                                  <FileArchive className="w-5 h-5" />
                                ) : (
                                  <FileText className="w-5 h-5" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-white truncate" title={msg.file_name || 'Attached File'}>
                                  {msg.file_name || 'Attachment'}
                                </p>
                                {msg.file_size ? (
                                  <p className="text-[10px] text-white/50">
                                    {(msg.file_size / (1024 * 1024)).toFixed(2)} MB
                                  </p>
                                ) : (
                                  <p className="text-[10px] text-cyan-400">Download File</p>
                                )}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => handleDownloadFile(e, msg.content, msg.file_name || 'file', msg.id)}
                              disabled={downloadingFileId === msg.id}
                              className="p-2.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/40 text-cyan-300 border border-cyan-500/40 transition-all flex-shrink-0 cursor-pointer shadow-sm active:scale-95 disabled:opacity-50 flex items-center justify-center"
                              title="Download file directly"
                            >
                              {downloadingFileId === msg.id ? (
                                <Loader2 className="w-4 h-4 animate-spin text-cyan-300" />
                              ) : (
                                <Download className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Reactions Display */}
                      {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                        <div className={cn("flex flex-wrap gap-1 mt-1", isMine ? "justify-end" : "justify-start")}>
                          {Object.entries(msg.reactions).map(([emoji, users]) => {
                            const userList: string[] = Array.isArray(users) ? (users as string[]) : [];
                            return (
                              <button
                                key={emoji}
                                onClick={(e) => { e.stopPropagation(); toggleReaction(msg.id, emoji); }}
                                className={cn(
                                  "flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border transition-colors",
                                  username && userList.includes(username) 
                                    ? "bg-cyan-500/20 border-cyan-500/40 text-cyan-300"
                                    : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:text-white"
                                )}
                                title={userList.join(', ')}
                              >
                                <span>{emoji}</span>
                                <span>{userList.length}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                      
                      <AnimatePresence>
                        {activeMessageId === msg.id && !editingMessageId && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className={cn(
                              "flex flex-col gap-2 w-full overflow-hidden mt-2",
                              isMine ? "items-end" : "items-start"
                            )}
                          >
                            <div className="flex items-center gap-2 bg-black/40 rounded-full p-1.5 border border-white/5">
                              {['👍', '❤️', '😂', '😮', '😢', '🔥'].map(emoji => (
                                <button 
                                  key={emoji}
                                  onClick={(e) => { e.stopPropagation(); toggleReaction(msg.id, emoji); setActiveMessageId(null); }}
                                  className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center text-lg transition-transform hover:scale-125 active:scale-95"
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                            <div className={cn("flex items-center gap-2 flex-wrap", isMine ? "justify-end" : "justify-start")}>
                              <button onClick={(e) => { e.stopPropagation(); setInfoMessage(msg); setActiveMessageId(null); }} className="p-2 text-cyan-400 bg-cyan-400/10 hover:bg-cyan-500/20 rounded-xl transition-colors flex items-center gap-1.5 text-xs font-medium">
                              <Info className="w-4 h-4" /> Info
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); setReplyingTo(msg); setActiveMessageId(null); }} className="p-2 text-blue-400 bg-blue-400/10 hover:bg-blue-400/20 rounded-xl transition-colors flex items-center gap-1.5 text-xs font-medium">
                              <Reply className="w-4 h-4" /> Reply
                            </button>
                            <button 
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                toggleStarMessage(msg.id); 
                                setActiveMessageId(null); 
                              }} 
                              className={cn(
                                "p-2 rounded-xl transition-colors flex items-center gap-1.5 text-xs font-medium",
                                starredIds.includes(msg.id)
                                  ? "text-yellow-400 bg-yellow-400/20 hover:bg-yellow-400/30"
                                  : "text-amber-400 bg-amber-400/10 hover:bg-amber-500/20"
                              )}
                            >
                              <Star className={cn("w-4 h-4", starredIds.includes(msg.id) ? "fill-yellow-400 text-yellow-400" : "text-amber-400")} />
                              <span>{starredIds.includes(msg.id) ? "Starred" : "Star"}</span>
                            </button>
                            {msg.type === 'text' && (
                              <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(msg.content); setActiveMessageId(null); }} className="p-2 text-emerald-400 bg-emerald-400/10 hover:bg-emerald-400/20 rounded-xl transition-colors flex items-center gap-1.5 text-xs font-medium">
                                <Copy className="w-4 h-4" /> Copy
                              </button>
                            )}
                            <button onClick={(e) => { e.stopPropagation(); setForwardingMessage(msg); setShowForwardModal(true); setActiveMessageId(null); }} className="p-2 text-purple-400 bg-purple-400/10 hover:bg-purple-400/20 rounded-xl transition-colors flex items-center gap-1.5 text-xs font-medium">
                              <Forward className="w-4 h-4" /> Forward
                            </button>
                            {isMine && msg.type === 'text' && (
                              <button onClick={(e) => { e.stopPropagation(); handleEdit(msg); setActiveMessageId(null); }} className="p-2 text-white/80 bg-white/5 hover:bg-white/10 hover:text-white rounded-xl transition-colors flex items-center gap-1.5 text-xs font-medium">
                                <Edit2 className="w-4 h-4" /> Edit
                              </button>
                            )}
                            {(isMine || isOwner) && (
                              <button onClick={(e) => { e.stopPropagation(); handleDelete(msg.id); setActiveMessageId(null); }} className="p-2 text-red-400 bg-red-400/10 hover:bg-red-400/20 rounded-xl transition-colors flex items-center gap-1.5 text-xs font-medium">
                                <Trash2 className="w-4 h-4" /> Delete
                              </button>
                            )}
                            {isOwner && !isMine && activeGroupSettings.owner_username?.toLowerCase() !== msg.username?.toLowerCase() && (
                              <>
                                {!activeGroupSettings.admin_usernames?.some(a => a.toLowerCase() === msg.username?.toLowerCase()) ? (
                                  <button onClick={(e) => { e.stopPropagation(); makeAdmin(msg.username); setActiveMessageId(null); }} className="p-2 text-yellow-400 bg-yellow-400/10 hover:bg-yellow-400/20 rounded-xl transition-colors flex items-center gap-1.5 text-xs font-medium">
                                    <Shield className="w-4 h-4" /> Make Admin
                                  </button>
                                ) : (
                                  <button onClick={(e) => { e.stopPropagation(); dismissAdmin(msg.username); setActiveMessageId(null); }} className="p-2 text-orange-400 bg-orange-400/10 hover:bg-orange-400/20 rounded-xl transition-colors flex items-center gap-1.5 text-xs font-medium">
                                    <ShieldAlert className="w-4 h-4" /> Dismiss Admin
                                  </button>
                                )}
                                <button onClick={(e) => { e.stopPropagation(); transferOwnership(msg.username); setActiveMessageId(null); }} className="p-2 text-purple-400 bg-purple-400/10 hover:bg-purple-400/20 rounded-xl transition-colors flex items-center gap-1.5 text-xs font-medium">
                                  <Crown className="w-4 h-4" /> Transfer Ownership
                                </button>
                              </>
                            )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                    <span className="text-[10px] opacity-40 mt-1 flex items-center gap-1">
                      <button 
                        onClick={() => openUserProfileCard(msg.username)} 
                        className="hover:underline font-medium text-white/80"
                      >
                        {isMine ? 'You' : msg.username}
                      </button>
                      {activeGroupSettings.owner_username?.toLowerCase() === msg.username?.toLowerCase() && <span title="Owner"><Crown className="w-3 h-3 text-yellow-500" /></span>}
                      {activeGroupSettings.owner_username?.toLowerCase() !== msg.username?.toLowerCase() && activeGroupSettings.admin_usernames?.some(a => a.toLowerCase() === msg.username?.toLowerCase()) && <span title="Admin"><Shield className="w-3 h-3 text-cyan-500" /></span>}
                      • {formatTime(msg.created_at)}
                      {msg.is_edited && <span>• Edited</span>}
                      {starredIds.includes(msg.id) && (
                        <span className="inline-flex items-center gap-0.5 text-amber-400 font-bold" title="Starred Message">
                          • <Star className="w-3 h-3 fill-amber-400" />
                        </span>
                      )}
                      {isMine && (
                        <span className={cn("ml-1", msg.read_by && msg.read_by.length > 0 ? "text-cyan-400" : "text-white/40")}>
                          {msg.read_by && msg.read_by.length > 0 ? <CheckCheck className="w-3 h-3" /> : <Check className="w-3 h-3" />}
                        </span>
                      )}
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-2.5 sm:p-4 md:p-6 border-t border-white/10 bg-slate-950/40 backdrop-blur-md pb-[max(0.625rem,env(safe-area-inset-bottom))]">
          <AnimatePresence>
            {typingUsers.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 4, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, y: 4, height: 0 }}
                className="flex items-center gap-2 text-xs text-cyan-400 font-medium px-2 pb-2 overflow-hidden"
              >
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce [animation-delay:-0.3s]"></span>
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce [animation-delay:-0.15s]"></span>
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce"></span>
                </span>
                <span>
                  {typingUsers.length === 1
                    ? `${typingUsers[0]} is typing...`
                    : typingUsers.length === 2
                    ? `${typingUsers[0]} and ${typingUsers[1]} are typing...`
                    : `${typingUsers.length} people are typing...`}
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Uploading Media Overlay / Banner */}
          {isUploadingMedia && (
            <div className="mb-2 p-2.5 rounded-xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 text-xs flex items-center justify-between animate-pulse">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                <span className="font-semibold">{uploadProgressText || 'Uploading media...'}</span>
              </div>
              <span className="text-[10px] bg-cyan-500/30 text-cyan-200 px-2 py-0.5 rounded-md font-medium">Sending</span>
            </div>
          )}

          {/* Hidden Media File Input */}
          <input
            type="file"
            ref={mediaFileInputRef}
            accept={attachmentAcceptType}
            onChange={handleMediaFileSelected}
            className="hidden"
            multiple
          />

          {editingMessageId ? (
            <form onSubmit={saveEdit} className="flex flex-col gap-2">
              <div className="flex justify-between items-center text-xs text-cyan-400 px-2">
                <span>Editing message</span>
                <button type="button" onClick={cancelEdit} className="hover:text-white transition-colors">Cancel</button>
              </div>
              <div className="flex items-end gap-4">
                <div className="flex-1 bg-white/5 border border-white/10 rounded-2xl flex items-center px-4 py-3 relative focus-within:bg-white/10 focus-within:border-white/20 transition-all">
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        saveEdit();
                      }
                    }}
                    placeholder="Edit message..."
                    className="bg-transparent border-none outline-none w-full text-sm placeholder:text-white/20 resize-none max-h-32 min-h-[20px]"
                    rows={1}
                    autoFocus
                  />
                </div>
                <button
                  type="submit"
                  disabled={!editContent.trim()}
                  className="w-12 h-12 rounded-2xl bg-cyan-500 flex items-center justify-center shadow-lg shadow-cyan-500/20 flex-shrink-0 disabled:opacity-50 transition-all hover:bg-cyan-400"
                >
                  <Check className="w-5 h-5 text-white" />
                </button>
              </div>
            </form>
          ) : isRecording ? (
            /* Live Voice Note Recording Interface */
            <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/30 rounded-2xl p-3 backdrop-blur-md">
              <div className="flex items-center gap-2 flex-1">
                <span className="w-3 h-3 rounded-full bg-red-500 animate-ping flex-shrink-0" />
                <Mic className="w-5 h-5 text-red-400 animate-bounce flex-shrink-0" />
                <span className="text-xs font-bold text-red-300">Recording Voice Note...</span>
                <span className="font-mono text-sm font-semibold text-white bg-black/40 px-2.5 py-0.5 rounded-lg border border-red-500/20 ml-2">
                  {formatRecordingTime(recordingTime)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={cancelVoiceRecording}
                  className="p-2.5 rounded-xl bg-white/10 hover:bg-red-500/20 text-white/70 hover:text-red-300 transition-colors"
                  title="Cancel Recording"
                >
                  <X className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={stopVoiceRecording}
                  className="px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-cyan-500/20 transition-all cursor-pointer"
                  title="Send Voice Note"
                >
                  <Send className="w-4 h-4" />
                  <span>Send Voice</span>
                </button>
              </div>
            </div>
          ) : (
            /* Standard Input Bar with Media Attachment Popover & Voice Mic Button */
            <form onSubmit={handleSendMessage} className="flex flex-col gap-2 relative">
              <AnimatePresence>
                {replyingTo && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                    animate={{ opacity: 1, height: 'auto', marginBottom: 4 }}
                    exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                    className="flex justify-between items-center bg-black/20 border-l-2 border-cyan-500 rounded-lg p-3 text-sm text-white/70 overflow-hidden"
                  >
                    <div className="flex-1 truncate">
                      <div className="font-bold text-cyan-400 text-xs mb-0.5">Replying to {replyingTo.username}</div>
                      <div className="truncate text-xs">
                        {replyingTo.type === 'image' ? (
                          <span className="inline-flex items-center gap-1"><ImageIcon className="w-3 h-3 text-cyan-400"/> Photo</span>
                        ) : replyingTo.type === 'video' ? (
                          <span className="inline-flex items-center gap-1"><VideoIcon className="w-3 h-3 text-cyan-400"/> Video</span>
                        ) : replyingTo.type === 'audio' ? (
                          <span className="inline-flex items-center gap-1"><Music className="w-3 h-3 text-cyan-400"/> Voice Note / Audio</span>
                        ) : replyingTo.type === 'document' || replyingTo.type === 'file' ? (
                          <span className="inline-flex items-center gap-1"><FileText className="w-3 h-3 text-cyan-400"/> {replyingTo.file_name || 'Document / Attachment'}</span>
                        ) : (
                          replyingTo.content
                        )}
                      </div>
                    </div>
                    <button type="button" onClick={() => setReplyingTo(null)} className="p-1 hover:text-white transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Attachment Popover Menu */}
              <AnimatePresence>
                {showAttachmentMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute bottom-full mb-3 left-0 bg-slate-900/95 border border-white/15 rounded-2xl p-2.5 shadow-2xl backdrop-blur-xl z-50 flex flex-col gap-1 min-w-[210px] max-w-[calc(100vw-32px)]"
                  >
                    <div className="text-[10px] uppercase font-bold tracking-wider text-cyan-400/80 px-2 py-1">
                      Share & Attach
                    </div>
                    <button
                      type="button"
                      onClick={() => triggerSelectAttachment('image')}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/10 text-white text-xs font-semibold transition-colors w-full text-left"
                    >
                      <ImageIcon className="w-4 h-4 text-cyan-400" />
                      <span>Photos & Images</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => triggerSelectAttachment('video')}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/10 text-white text-xs font-semibold transition-colors w-full text-left"
                    >
                      <VideoIcon className="w-4 h-4 text-purple-400" />
                      <span>Video Clips</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => triggerSelectAttachment('audio')}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/10 text-white text-xs font-semibold transition-colors w-full text-left"
                    >
                      <Music className="w-4 h-4 text-pink-400" />
                      <span>Audio / Music File</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => triggerSelectAttachment('document')}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/10 text-white text-xs font-semibold transition-colors w-full text-left"
                    >
                      <FileText className="w-4 h-4 text-amber-400" />
                      <span>Documents (PDF, DOCX)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => triggerSelectAttachment('file')}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/10 text-white text-xs font-semibold transition-colors w-full text-left"
                    >
                      <FileArchive className="w-4 h-4 text-emerald-400" />
                      <span>ZIP / RAR / Any File</span>
                    </button>
                    <div className="h-px bg-white/10 my-1" />
                    <button
                      type="button"
                      onClick={() => {
                        setShowAttachmentMenu(false);
                        startVoiceRecording();
                      }}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-red-500/20 text-red-300 text-xs font-semibold transition-colors w-full text-left"
                    >
                      <Mic className="w-4 h-4 text-red-400" />
                      <span>Record Voice Note</span>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex items-end gap-2 sm:gap-3">
                <div className="flex-1 bg-white/5 border border-white/10 rounded-xl sm:rounded-2xl flex items-center px-3 py-2 sm:px-4 sm:py-3 relative focus-within:bg-white/10 focus-within:border-white/20 transition-all">
                  {/* Plus / Attachment Menu Button */}
                  <button
                    type="button"
                    onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
                    className="p-1 mr-1 sm:mr-2 text-white/50 hover:text-cyan-400 transition-colors flex-shrink-0 cursor-pointer"
                    title="Attach Media & Files"
                  >
                    <Plus className={cn("w-4 h-4 sm:w-5 sm:h-5 transition-transform", showAttachmentMenu ? "rotate-45 text-cyan-400" : "")} />
                  </button>

                  <textarea
                    value={inputMessage}
                    onChange={handleInputChange}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage(e);
                      }
                    }}
                    onPaste={handlePaste}
                    placeholder="Type a message or drag files..."
                    className="bg-transparent border-none outline-none w-full text-xs sm:text-sm placeholder:text-white/30 resize-none max-h-32 min-h-[18px] sm:min-h-[20px]"
                    rows={1}
                    style={{
                      height: inputMessage ? 'auto' : '18px',
                    }}
                  />

                  {/* Microphone Voice Note Button */}
                  <button
                    type="button"
                    onClick={startVoiceRecording}
                    className="p-1 ml-1 sm:ml-2 text-white/50 hover:text-red-400 transition-colors flex-shrink-0 cursor-pointer"
                    title="Record Voice Note"
                  >
                    <Mic className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={!inputMessage.trim()}
                  className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-cyan-500 flex items-center justify-center shadow-lg shadow-cyan-500/20 flex-shrink-0 disabled:opacity-40 transition-all hover:bg-cyan-400 active:scale-95 cursor-pointer"
                  title="Send Message"
                >
                  <Send className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      <AnimatePresence>
        {infoMessage && (() => {
          const currentInfoMessage = messages.find(m => m.id === infoMessage.id) || infoMessage;
          return (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setInfoMessage(null)}
              className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0f172a]/90 backdrop-blur-md p-4 md:p-8"
            >
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-slate-900 border border-white/10 rounded-3xl p-6 w-full max-w-sm shadow-2xl relative"
              >
                <button
                  className="absolute top-4 right-4 p-2 text-white/60 hover:text-white bg-white/5 hover:bg-white/10 rounded-full transition-colors"
                  onClick={() => setInfoMessage(null)}
                >
                  <X className="w-5 h-5" />
                </button>
                <h3 className="text-xl font-bold mb-4 tracking-tight">Message Info</h3>
                
                <div className="space-y-4">
                  <div>
                    <h4 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Read by</h4>
                    {currentInfoMessage.read_by && currentInfoMessage.read_by.length > 0 ? (
                      <ul className="space-y-2">
                        {currentInfoMessage.read_by.map((user, idx) => (
                          <li key={idx} className="flex items-center gap-2">
                            <CheckCheck className="w-4 h-4 text-cyan-400" />
                            <span className="text-sm">{user}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-white/60">No one has read this yet.</p>
                    )}
                  </div>
                </div>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      <AnimatePresence>
        {previewImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setPreviewImage(null)}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0f172a]/95 backdrop-blur-md p-4 md:p-8"
          >
            <div className="absolute top-4 right-4 md:top-8 md:right-8 flex items-center gap-3 z-10">
              <button
                type="button"
                onClick={(e) => handleDownloadFile(e, previewImage, 'image.jpg')}
                className="p-2.5 text-white bg-cyan-500/20 hover:bg-cyan-500/40 border border-cyan-500/40 rounded-xl transition-colors flex items-center gap-1.5 text-xs font-semibold cursor-pointer shadow-lg"
                title="Download Image"
              >
                <Download className="w-4 h-4" /> Download
              </button>
              <button
                type="button"
                className="p-2.5 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-xl transition-colors border border-white/20 cursor-pointer shadow-lg"
                onClick={() => setPreviewImage(null)}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <motion.img
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              src={previewImage}
              alt="Preview Full Size"
              className="max-w-full max-h-[85vh] rounded-2xl object-contain shadow-2xl border border-white/10"
              onClick={(e) => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {viewProfileUser && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setViewProfileUser(null)}
            className="fixed inset-0 z-[100] grid place-items-center bg-[#0f172a]/90 backdrop-blur-md p-4 sm:p-6 overflow-y-auto"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-slate-900 border border-white/10 rounded-3xl p-6 w-full max-w-sm shadow-2xl relative my-auto"
            >
              <button
                className="absolute top-4 right-4 p-2 text-white/60 hover:text-white bg-white/5 hover:bg-white/10 rounded-full transition-colors"
                onClick={() => setViewProfileUser(null)}
              >
                <X className="w-5 h-5" />
              </button>
              
              <div className="flex flex-col items-center text-center">
                <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-cyan-500 to-purple-600 border-2 border-cyan-400 p-0.5 mb-3 shadow-lg flex items-center justify-center overflow-hidden">
                  {viewProfileUser.avatar_url ? (
                    <img src={viewProfileUser.avatar_url} alt={viewProfileUser.username} className="w-full h-full object-cover rounded-full" />
                  ) : (
                    <User className="w-10 h-10 text-white" />
                  )}
                </div>

                <h3 className="text-xl font-bold tracking-tight flex items-center gap-1.5">
                  {viewProfileUser.username}
                  {activeGroupSettings.owner_username?.toLowerCase() === viewProfileUser.username?.toLowerCase() && (
                    <span title="Company CEO" className="inline-flex items-center gap-1 text-xs font-bold text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded-full border border-amber-500/40">
                      <Crown className="w-3.5 h-3.5 text-amber-400" /> CEO
                    </span>
                  )}
                  {activeGroupSettings.owner_username?.toLowerCase() !== viewProfileUser.username?.toLowerCase() && activeGroupSettings.admin_usernames?.some(a => a.toLowerCase() === viewProfileUser.username?.toLowerCase()) && (
                    <span title="Manager" className="inline-flex items-center gap-1 text-xs font-bold text-cyan-300 bg-cyan-500/20 px-2 py-0.5 rounded-full border border-cyan-500/40">
                      <Shield className="w-3.5 h-3.5 text-cyan-400" /> Manager
                    </span>
                  )}
                  {activeGroupSettings.owner_username?.toLowerCase() !== viewProfileUser.username?.toLowerCase() && !activeGroupSettings.admin_usernames?.some(a => a.toLowerCase() === viewProfileUser.username?.toLowerCase()) && (
                    <span title="Team Member" className="inline-flex items-center gap-1 text-xs font-medium text-slate-300 bg-slate-500/20 px-2 py-0.5 rounded-full border border-slate-500/30">
                      <User className="w-3.5 h-3.5 text-slate-400" /> Member
                    </span>
                  )}
                </h3>

                {(() => {
                  const isUserOnline = onlineUsersList.some(u => u.username.toLowerCase() === viewProfileUser.username.toLowerCase());
                  const statusInfo = formatLastSeen(viewProfileUser.last_seen, isUserOnline);
                  return (
                    <div className="flex items-center gap-1.5 text-xs font-medium my-1.5 bg-white/5 px-3 py-1 rounded-full border border-white/10">
                      <span className={cn("w-2 h-2 rounded-full flex-shrink-0", isUserOnline ? "bg-green-400 animate-pulse" : "bg-slate-500")} />
                      <span className={isUserOnline ? "text-green-400 font-semibold" : "text-white/60"}>
                        {statusInfo.text}
                      </span>
                    </div>
                  );
                })()}

                <p className="text-xs text-cyan-300 font-medium mt-1 mb-4">
                  {viewProfileUser.bio || 'No profile bio provided.'}
                </p>

                <div className="w-full space-y-2 text-left bg-white/5 p-4 rounded-2xl border border-white/10 text-xs">
                  {viewProfileUser.email && (
                    <div className="flex items-center gap-2 text-white/80">
                      <Mail className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                      <span className="truncate">{viewProfileUser.email}</span>
                    </div>
                  )}
                  {viewProfileUser.phone && (
                    <div className="flex items-center gap-2 text-white/80">
                      <Phone className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                      <span>{viewProfileUser.phone}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-white/60 pt-1 border-t border-white/5">
                    <User className="w-4 h-4 text-white/40 flex-shrink-0" />
                    <span>Role: {viewProfileUser.username?.toLowerCase() === activeGroupSettings.owner_username?.toLowerCase() ? 'CEO (Chief Executive)' : activeGroupSettings.admin_usernames?.some(a => a.toLowerCase() === viewProfileUser.username?.toLowerCase()) ? 'Manager' : 'Team Member'}</span>
                  </div>
                </div>

                {viewProfileUser.username?.toLowerCase() === username?.toLowerCase() ? (
                  <button
                    onClick={() => { setViewProfileUser(null); openSettings(); }}
                    className="mt-4 w-full bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 font-medium py-2 rounded-xl border border-cyan-500/40 text-xs transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Edit2 className="w-3.5 h-3.5" /> Edit Profile
                  </button>
                ) : (
                  <div className="mt-4 w-full space-y-2">
                    <button
                      onClick={() => {
                        setActivePrivateUser(viewProfileUser.username);
                        setViewProfileUser(null);
                      }}
                      className="w-full bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white font-semibold py-2.5 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-cyan-500/20 cursor-pointer"
                    >
                      <Lock className="w-3.5 h-3.5" /> Send Private Message
                    </button>

                    {/* CEO & Manager Action: Remove Member from Company */}
                    {(() => {
                      const targetLower = viewProfileUser.username.toLowerCase();
                      const isTargetCEO = targetLower === ownerLower;
                      const isTargetManager = (activeGroupSettings.admin_usernames || []).some(a => a.toLowerCase() === targetLower);
                      const canRemove = (isOwner && !isTargetCEO) || (isAdmin && !isOwner && !isTargetCEO && !isTargetManager);

                      if (canRemove) {
                        return (
                          <button
                            type="button"
                            onClick={() => removeMember(viewProfileUser.username)}
                            className="w-full bg-red-600/90 hover:bg-red-600 text-white font-semibold py-2 rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 border border-red-500 cursor-pointer shadow-md shadow-red-600/20"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Remove from Company ({isTargetManager ? 'Manager' : 'Team Member'})</span>
                          </button>
                        );
                      }
                      return null;
                    })()}

                    {/* CEO Exclusive Role Management */}
                    {isOwner && viewProfileUser.username.toLowerCase() !== ownerLower && (
                      <div className="flex gap-2 pt-1">
                        {!activeGroupSettings.admin_usernames?.some(a => a.toLowerCase() === viewProfileUser.username.toLowerCase()) ? (
                          <button
                            type="button"
                            onClick={() => makeAdmin(viewProfileUser.username)}
                            className="flex-1 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 font-semibold py-2 rounded-xl border border-cyan-500/40 text-xs transition-colors flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <Shield className="w-3.5 h-3.5" /> Make Manager
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => dismissAdmin(viewProfileUser.username)}
                            className="flex-1 bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 font-semibold py-2 rounded-xl border border-orange-500/40 text-xs transition-colors flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <ShieldAlert className="w-3.5 h-3.5" /> Dismiss Manager
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => transferOwnership(viewProfileUser.username)}
                          className="flex-1 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 font-semibold py-2 rounded-xl border border-yellow-500/40 text-xs transition-colors flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <Crown className="w-3.5 h-3.5" /> Make CEO
                        </button>
                      </div>
                    )}

                    {/* Block / Unblock Button (Not for owner) */}
                    {viewProfileUser.username.toLowerCase() !== ownerLower && (
                      <button
                        type="button"
                        onClick={() => {
                          if (blockedUsers.some(b => b.toLowerCase() === viewProfileUser.username.toLowerCase())) {
                            unblockUser(viewProfileUser.username);
                          } else {
                            blockUser(viewProfileUser.username);
                          }
                        }}
                        className={cn(
                          "w-full font-semibold py-2 rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 border cursor-pointer",
                          blockedUsers.some(b => b.toLowerCase() === viewProfileUser.username.toLowerCase())
                            ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40 hover:bg-cyan-500/30"
                            : "bg-red-500/10 text-red-300 border-red-500/30 hover:bg-red-500/20"
                        )}
                      >
                        <UserX className="w-3.5 h-3.5" />
                        {blockedUsers.some(b => b.toLowerCase() === viewProfileUser.username.toLowerCase()) ? "Unblock User" : "Block User"}
                      </button>
                    )}

                    {/* Ban / Unban Button (For CEO / Manager, but Manager cannot ban CEO or Manager) */}
                    {(() => {
                      const targetLower = viewProfileUser.username.toLowerCase();
                      const isTargetCEO = targetLower === ownerLower;
                      const isTargetManager = (activeGroupSettings.admin_usernames || []).some(a => a.toLowerCase() === targetLower);
                      const canBan = (isOwner && !isTargetCEO) || (isAdmin && !isOwner && !isTargetCEO && !isTargetManager);

                      if (canBan) {
                        const isTargetBanned = (activeGroupSettings.banned_usernames || []).some(b => b.toLowerCase() === targetLower);
                        return (
                          <button
                            type="button"
                            onClick={() => {
                              if (isTargetBanned) {
                                unbanUser(viewProfileUser.username);
                              } else {
                                banUser(viewProfileUser.username);
                              }
                              setViewProfileUser(null);
                            }}
                            className={cn(
                              "w-full font-semibold py-2 rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 border cursor-pointer",
                              isTargetBanned
                                ? "bg-green-500/20 text-green-300 border-green-500/40 hover:bg-green-500/30"
                                : "bg-red-700/80 text-white border-red-600 hover:bg-red-600 shadow-md shadow-red-700/30"
                            )}
                          >
                            <Ban className="w-3.5 h-3.5" />
                            {isTargetBanned ? "Unban Account" : "Ban Account"}
                          </button>
                        );
                      }
                      return null;
                    })()}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowSettings(false)}
            className="fixed inset-0 z-[100] grid place-items-center bg-[#0f172a]/90 backdrop-blur-md p-4 sm:p-6 overflow-y-auto"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-slate-900 border border-white/10 rounded-3xl p-6 w-full max-w-md shadow-2xl relative max-h-[85vh] overflow-y-auto my-auto"
            >
              <button
                className="absolute top-4 right-4 p-2 text-white/60 hover:text-white bg-white/5 hover:bg-white/10 rounded-full transition-colors"
                onClick={() => setShowSettings(false)}
              >
                <X className="w-5 h-5" />
              </button>
              <h3 className="text-xl font-bold mb-6 tracking-tight">Edit Profile & Account</h3>
              
              <form onSubmit={handleSettingsSave} className="space-y-4">
                <div className="flex flex-col items-center gap-2 mb-2">
                  <div className="relative group">
                    <div className="w-24 h-24 rounded-full bg-slate-800 border-2 border-cyan-500/50 flex items-center justify-center overflow-hidden shadow-lg">
                      {userAvatar ? (
                        <img src={userAvatar} alt="Avatar" className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-10 h-10 text-white/40" />
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => avatarInputRef.current?.click()}
                      className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 rounded-full transition-opacity cursor-pointer"
                    >
                      {isUploadingAvatar ? <Loader2 className="w-6 h-6 animate-spin text-white" /> : <Camera className="w-6 h-6 text-white" />}
                    </button>
                    <input
                      type="file"
                      ref={avatarInputRef}
                      onChange={handleAvatarUpload}
                      accept="image/*"
                      className="hidden"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    className="text-xs text-cyan-400 hover:underline flex items-center gap-1"
                  >
                    <Camera className="w-3 h-3" /> Change Profile Picture
                  </button>
                </div>

                <div>
                  <label htmlFor="settings-username" className="block text-xs font-medium text-white/80 mb-1 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-cyan-400" /> Display Name
                  </label>
                  <input
                    id="settings-username"
                    type="text"
                    value={settingsUsername}
                    onChange={(e) => setSettingsUsername(e.target.value)}
                    maxLength={20}
                    required
                    className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-transparent transition-all"
                  />
                </div>

                <div>
                  <label htmlFor="settings-email" className="block text-xs font-medium text-white/80 mb-1 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-cyan-400" /> Email Address
                  </label>
                  <input
                    id="settings-email"
                    type="email"
                    value={settingsEmail}
                    onChange={(e) => setSettingsEmail(e.target.value)}
                    placeholder="email@example.com"
                    className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-transparent transition-all"
                  />
                </div>

                <div>
                  <label htmlFor="settings-phone" className="block text-xs font-medium text-white/80 mb-1 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-cyan-400" /> Phone Number
                  </label>
                  <input
                    id="settings-phone"
                    type="tel"
                    value={settingsPhone}
                    onChange={(e) => setSettingsPhone(e.target.value)}
                    placeholder="+1 234 567 8900"
                    className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-transparent transition-all"
                  />
                </div>

                <div>
                  <label htmlFor="settings-bio" className="block text-xs font-medium text-white/80 mb-1 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-cyan-400" /> Description / Bio
                  </label>
                  <input
                    id="settings-bio"
                    type="text"
                    maxLength={60}
                    value={settingsBio}
                    onChange={(e) => setSettingsBio(e.target.value)}
                    placeholder="Short bio or status"
                    className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-transparent transition-all"
                  />
                </div>

                <div>
                  <label htmlFor="settings-password" className="block text-xs font-medium text-white/80 mb-1 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-cyan-400" /> Password
                  </label>
                  <div className="relative">
                    <input
                      id="settings-password"
                      type={showSettingsPassword ? "text" : "password"}
                      value={settingsPassword}
                      onChange={(e) => setSettingsPassword(e.target.value)}
                      placeholder="Set or update password"
                      className="w-full px-4 py-2.5 pr-10 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-transparent transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSettingsPassword(!showSettingsPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white text-xs"
                    >
                      {showSettingsPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* NOTIFICATIONS & SOUNDS CONTROL PANEL */}
                <div className="bg-white/5 p-4 rounded-2xl border border-white/10 space-y-3 pt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-cyan-300 uppercase tracking-wider flex items-center gap-1.5">
                      <BellRing className="w-4 h-4 text-cyan-400" /> Notifications & Sounds
                    </span>
                    <button
                      type="button"
                      onClick={testNotification}
                      className="text-[10px] font-bold bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 active:scale-95 cursor-pointer shadow-sm"
                      title="Test live sound and notification alert"
                    >
                      <Bell className="w-3 h-3" /> Test Alert
                    </button>
                  </div>

                  {/* Browser Push Notifications */}
                  <div className="flex items-center justify-between pt-1">
                    <div>
                      <p className="text-xs font-semibold text-white">Browser Notifications</p>
                      <p className="text-[10px] text-white/50">Alerts when chat tab is in background</p>
                    </div>
                    <button
                      type="button"
                      onClick={requestNotificationPermission}
                      className={cn(
                        "text-xs font-semibold px-3 py-1.5 rounded-xl border transition-all active:scale-95 cursor-pointer",
                        notificationsEnabled
                          ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30"
                          : "bg-white/10 text-white/70 border-white/10 hover:bg-white/15"
                      )}
                    >
                      {notificationsEnabled ? "Allowed ✓" : "Enable"}
                    </button>
                  </div>

                  {/* Sound Chimes */}
                  <div className="flex items-center justify-between pt-1 border-t border-white/5">
                    <div>
                      <p className="text-xs font-semibold text-white">Message Alert Chimes</p>
                      <p className="text-[10px] text-white/50">Acoustic audio tone on new messages</p>
                    </div>
                    <button
                      type="button"
                      onClick={toggleSoundAlerts}
                      className={cn(
                        "text-xs font-semibold px-3 py-1.5 rounded-xl border transition-all active:scale-95 cursor-pointer flex items-center gap-1.5",
                        soundEnabled
                          ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40 hover:bg-cyan-500/30"
                          : "bg-white/10 text-white/50 border-white/10 hover:bg-white/15"
                      )}
                    >
                      {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                      <span>{soundEnabled ? "ON" : "OFF"}</span>
                    </button>
                  </div>

                  {/* In-App Floating Toasts */}
                  <div className="flex items-center justify-between pt-1 border-t border-white/5">
                    <div>
                      <p className="text-xs font-semibold text-white">In-App Floating Banners</p>
                      <p className="text-[10px] text-white/50">Show banner toasts when in another chat</p>
                    </div>
                    <button
                      type="button"
                      onClick={toggleInAppToasts}
                      className={cn(
                        "text-xs font-semibold px-3 py-1.5 rounded-xl border transition-all active:scale-95 cursor-pointer",
                        inAppToastsEnabled
                          ? "bg-purple-500/20 text-purple-300 border-purple-500/40 hover:bg-purple-500/30"
                          : "bg-white/10 text-white/50 border-white/10 hover:bg-white/15"
                      )}
                    >
                      {inAppToastsEnabled ? "Active" : "Disabled"}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isUploadingAvatar || !settingsUsername.trim()}
                  className="w-full bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-xl transition-colors shadow-lg shadow-cyan-500/20 mt-2"
                >
                  Save Profile Changes
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showGroupSettings && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowGroupSettings(false)}
            className="fixed inset-0 z-[100] grid place-items-center bg-[#0f172a]/90 backdrop-blur-md p-4 sm:p-6 overflow-y-auto"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-slate-900 border border-white/10 rounded-3xl p-6 w-full max-w-lg shadow-2xl relative max-h-[85vh] overflow-y-auto my-auto"
            >
              <button
                className="absolute top-4 right-4 p-2 text-white/60 hover:text-white bg-white/5 hover:bg-white/10 rounded-full transition-colors z-20"
                onClick={() => setShowGroupSettings(false)}
              >
                <X className="w-5 h-5" />
              </button>
              <h3 className="text-xl font-bold mb-4 tracking-tight flex items-center gap-2">
                <Users className="w-5 h-5 text-cyan-400" /> Group Info & Members
              </h3>
              
              <form onSubmit={handleGroupSettingsSave} className="space-y-5">
                <div className="flex flex-col items-center gap-3 bg-white/5 p-4 rounded-2xl border border-white/10">
                  <div className="relative group">
                    <div 
                      className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-purple-500 to-pink-500 border-2 border-cyan-500/50 flex items-center justify-center overflow-hidden cursor-pointer shadow-xl relative"
                      onClick={() => isAdmin && groupAvatarInputRef.current?.click()}
                    >
                      {activeGroupSettings.avatar_url ? (
                        <img src={activeGroupSettings.avatar_url} alt="Group Avatar" className="w-full h-full object-cover" />
                      ) : (
                        <Users className="w-8 h-8 text-white/80" />
                      )}
                      {isAdmin && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          {isUploadingGroupAvatar ? <Loader2 className="w-5 h-5 animate-spin text-white" /> : <Camera className="w-5 h-5 text-white" />}
                        </div>
                      )}
                    </div>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => groupAvatarInputRef.current?.click()}
                        className="mt-1 text-[11px] text-cyan-400 hover:underline flex items-center gap-1 mx-auto"
                      >
                        <Camera className="w-3 h-3" /> Change Photo
                      </button>
                    )}
                    <input
                      type="file"
                      ref={groupAvatarInputRef}
                      onChange={handleGroupAvatarUpload}
                      accept="image/*"
                      className="hidden"
                    />
                  </div>

                  <div className="w-full space-y-3">
                    <div>
                      <label htmlFor="group-name" className="block text-xs font-medium text-white/80 mb-1">Group Name</label>
                      <input
                        id="group-name"
                        type="text"
                        value={editGroupForm.name}
                        onChange={(e) => setEditGroupForm({...editGroupForm, name: e.target.value})}
                        maxLength={30}
                        required
                        readOnly={!isAdmin}
                        placeholder="Enter group name"
                        className={cn("w-full px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-transparent transition-all", !isAdmin ? "opacity-60 cursor-not-allowed" : "")}
                      />
                    </div>
                    <div>
                      <label htmlFor="group-desc" className="block text-xs font-medium text-white/80 mb-1">Description</label>
                      <input
                        id="group-desc"
                        type="text"
                        value={editGroupForm.description}
                        onChange={(e) => setEditGroupForm({...editGroupForm, description: e.target.value})}
                        maxLength={60}
                        readOnly={!isAdmin}
                        placeholder="Enter group description"
                        className={cn("w-full px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-transparent transition-all", !isAdmin ? "opacity-60 cursor-not-allowed" : "")}
                      />
                    </div>
                  </div>

                  {isAdmin && (
                    <button
                      type="submit"
                      disabled={isUploadingGroupAvatar || !editGroupForm.name.trim()}
                      className="w-full bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-white font-semibold py-2 px-4 rounded-xl text-xs transition-colors shadow-md shadow-cyan-500/20"
                    >
                      Save Group Info
                    </button>
                  )}
                </div>

                {/* ONLINE USERS SECTION */}
                <div className="bg-white/5 p-4 rounded-2xl border border-white/10 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white/90 uppercase tracking-wider flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse"></span>
                      Online Members ({onlineUsersList.length})
                    </span>
                    <span className="text-[10px] text-green-400 font-medium bg-green-500/10 px-2 py-0.5 rounded-full border border-green-500/20">Active Now</span>
                  </div>

                  {onlineUsersList.length === 0 ? (
                    <p className="text-xs text-white/50 italic py-1">No members online right now</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {onlineUsersList.map((u, idx) => (
                        <div
                          key={idx}
                          onClick={() => openUserProfileCard(u.username)}
                          className="flex items-center gap-2 p-2 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors cursor-pointer group"
                        >
                          <div className="relative flex-shrink-0">
                            <div className="w-7 h-7 rounded-full bg-slate-800 border border-cyan-400 flex items-center justify-center overflow-hidden">
                              {u.avatar ? (
                                <img src={u.avatar} alt={u.username} className="w-full h-full object-cover" />
                              ) : (
                                <User className="w-3.5 h-3.5 text-white/80" />
                              )}
                            </div>
                            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-400 border border-slate-900" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-white truncate group-hover:text-cyan-300 transition-colors">
                              {u.username?.toLowerCase() === username?.toLowerCase() ? `${u.username} (You)` : u.username}
                            </p>
                            <p className="text-[10px] text-green-400 font-medium flex items-center gap-1">
                              Online now
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* ALL GROUP MEMBERS & LAST SEEN SECTION */}
                <div className="bg-white/5 p-4 rounded-2xl border border-white/10 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white/90 uppercase tracking-wider flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-cyan-400" /> All Group Members ({getAllGroupMembers().length})
                    </span>
                    <span className="text-[10px] text-white/50">Click to view profile</span>
                  </div>

                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                    {getAllGroupMembers().map((member, idx) => {
                      const isUserOnline = onlineUsersList.some(u => u.username.toLowerCase() === member.username.toLowerCase());
                      const statusInfo = formatLastSeen(member.last_seen, isUserOnline);
                      const isMemberOwner = activeGroupSettings.owner_username?.toLowerCase() === member.username?.toLowerCase();
                      const isMemberAdmin = activeGroupSettings.admin_usernames?.some(a => a.toLowerCase() === member.username?.toLowerCase());
                      const isMemberLeader = (activeGroupSettings.leader_usernames || []).some(l => l.toLowerCase() === member.username?.toLowerCase());

                      return (
                        <div
                          key={idx}
                          className="p-3 rounded-2xl bg-slate-900/80 hover:bg-slate-800/80 border border-white/10 transition-all space-y-2.5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div 
                              onClick={() => openUserProfileCard(member.username)} 
                              className="flex items-center gap-3 min-w-0 cursor-pointer flex-1 group"
                            >
                              <div className="relative flex-shrink-0">
                                <div className="w-9 h-9 rounded-full bg-slate-800 border border-cyan-500/30 flex items-center justify-center overflow-hidden group-hover:scale-105 transition-transform">
                                  {member.avatar_url ? (
                                    <img src={member.avatar_url} alt={member.username} className="w-full h-full object-cover" />
                                  ) : (
                                    <User className="w-4 h-4 text-white/80" />
                                  )}
                                </div>
                                <span className={cn("absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border border-slate-900", isUserOnline ? "bg-green-400 animate-pulse" : "bg-slate-500")} />
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-xs font-bold text-white truncate group-hover:text-cyan-300 transition-colors">
                                    {member.username?.toLowerCase() === username?.toLowerCase() ? `${member.username} (You)` : member.username}
                                  </span>
                                  {isMemberOwner && (
                                    <span className="inline-flex items-center gap-1 bg-yellow-500/20 text-yellow-300 text-[9px] font-bold px-1.5 py-0.5 rounded-md border border-yellow-500/30">
                                      <Crown className="w-2.5 h-2.5" /> CEO
                                    </span>
                                  )}
                                  {!isMemberOwner && isMemberAdmin && (
                                    <span className="inline-flex items-center gap-1 bg-cyan-500/20 text-cyan-300 text-[9px] font-bold px-1.5 py-0.5 rounded-md border border-cyan-500/30">
                                      <Shield className="w-2.5 h-2.5" /> Manager
                                    </span>
                                  )}
                                  {!isMemberOwner && !isMemberAdmin && (
                                    <span className="inline-flex items-center gap-1 bg-slate-500/20 text-slate-300 text-[9px] font-medium px-1.5 py-0.5 rounded-md border border-slate-500/30">
                                      <User className="w-2.5 h-2.5 text-slate-400" /> Member
                                    </span>
                                  )}
                                  {isMemberLeader && (
                                    <span className="inline-flex items-center gap-1 bg-emerald-500/20 text-emerald-300 text-[9px] font-bold px-1.5 py-0.5 rounded-md border border-emerald-500/30">
                                      <Star className="w-2.5 h-2.5 fill-emerald-300" /> Leader
                                    </span>
                                  )}
                                </div>
                                <p className={cn("text-[10px] flex items-center gap-1 mt-0.5", isUserOnline ? "text-green-400 font-medium" : "text-white/50")}>
                                  <Clock className="w-2.5 h-2.5 opacity-70" />
                                  {statusInfo.text}
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Actions row */}
                          <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-white/5">
                            {member.username.toLowerCase() !== username.toLowerCase() && (
                              <button
                                type="button"
                                onClick={() => {
                                  setActivePrivateUser(member.username);
                                  setShowGroupSettings(false);
                                }}
                                className="px-2.5 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 text-[10px] font-semibold border border-cyan-500/40 transition-colors flex items-center gap-1 cursor-pointer"
                                title={`Send private message to ${member.username}`}
                              >
                                <Lock className="w-3 h-3 text-cyan-400" />
                                <span>Message</span>
                              </button>
                            )}

                            {/* Remove Member Action (CEO can remove Manager/Member, Manager can remove Member) */}
                            {(() => {
                              if (member.username.toLowerCase() === username.toLowerCase()) return null;
                              const isTargetCEO = isMemberOwner;
                              const isTargetManager = isMemberAdmin;
                              const canRemove = (isOwner && !isTargetCEO) || (isAdmin && !isOwner && !isTargetCEO && !isTargetManager);
                              if (!canRemove) return null;

                              return (
                                <button
                                  type="button"
                                  onClick={() => removeMember(member.username)}
                                  className="px-2.5 py-1 rounded-lg bg-red-600/30 hover:bg-red-600/50 text-red-200 text-[10px] font-semibold border border-red-500/50 transition-colors flex items-center gap-1 cursor-pointer"
                                  title={`Remove ${isTargetManager ? 'Manager' : 'Team Member'} @${member.username} from company`}
                                >
                                  <Trash2 className="w-3 h-3 text-red-400" />
                                  <span>Remove</span>
                                </button>
                              );
                            })()}

                            {/* Block / Unblock action */}
                            {member.username.toLowerCase() !== username.toLowerCase() && member.username.toLowerCase() !== ownerLower && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (blockedUsers.some(b => b.toLowerCase() === member.username.toLowerCase())) {
                                    unblockUser(member.username);
                                  } else {
                                    blockUser(member.username);
                                  }
                                }}
                                className={cn(
                                  "px-2.5 py-1 rounded-lg text-[10px] font-semibold border transition-colors flex items-center gap-1 cursor-pointer",
                                  blockedUsers.some(b => b.toLowerCase() === member.username.toLowerCase())
                                    ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40 hover:bg-cyan-500/30"
                                    : "bg-white/5 text-white/70 border-white/10 hover:bg-white/10"
                                )}
                                title={blockedUsers.some(b => b.toLowerCase() === member.username.toLowerCase()) ? "Unblock User" : "Block User"}
                              >
                                <UserX className="w-3 h-3" />
                                <span>{blockedUsers.some(b => b.toLowerCase() === member.username.toLowerCase()) ? "Unblock" : "Block"}</span>
                              </button>
                            )}

                            {/* Ban / Unban Action (CEO can ban anyone except self, Manager can only ban regular members) */}
                            {(() => {
                              if (member.username.toLowerCase() === username.toLowerCase()) return null;
                              const isTargetCEO = isMemberOwner;
                              const isTargetManager = isMemberAdmin;
                              const canBan = (isOwner && !isTargetCEO) || (isAdmin && !isOwner && !isTargetCEO && !isTargetManager);
                              if (!canBan) return null;

                              const isTargetBanned = (activeGroupSettings.banned_usernames || []).some(b => b.toLowerCase() === member.username.toLowerCase());
                              return (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (isTargetBanned) {
                                      unbanUser(member.username);
                                    } else {
                                      banUser(member.username);
                                    }
                                  }}
                                  className={cn(
                                    "px-2.5 py-1 rounded-lg text-[10px] font-semibold border transition-colors flex items-center gap-1 cursor-pointer",
                                    isTargetBanned
                                      ? "bg-green-500/20 text-green-300 border-green-500/40 hover:bg-green-500/30"
                                      : "bg-red-500/20 text-red-300 border-red-500/40 hover:bg-red-500/30"
                                  )}
                                  title={isTargetBanned ? "Unban User" : "Ban User"}
                                >
                                  <Ban className="w-3 h-3" />
                                  <span>{isTargetBanned ? "Unban" : "Ban"}</span>
                                </button>
                              );
                            })()}

                            {/* CEO exclusive admin actions */}
                            {isOwner && member.username.toLowerCase() !== username.toLowerCase() && (
                              <>
                                {!isMemberAdmin ? (
                                  <button
                                    type="button"
                                    onClick={() => makeAdmin(member.username)}
                                    className="px-2.5 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 text-[10px] font-semibold border border-cyan-500/40 transition-colors cursor-pointer"
                                    title="Promote to Manager"
                                  >
                                    Make Manager
                                  </button>
                                ) : (
                                  !isMemberOwner && (
                                    <button
                                      type="button"
                                      onClick={() => dismissAdmin(member.username)}
                                      className="px-2.5 py-1 rounded-lg bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 text-[10px] font-semibold border border-orange-500/40 transition-colors cursor-pointer"
                                      title="Dismiss Manager"
                                    >
                                      Dismiss Manager
                                    </button>
                                  )
                                )}
                                {!isMemberOwner && (
                                  <button
                                    type="button"
                                    onClick={() => transferOwnership(member.username)}
                                    className="px-2.5 py-1 rounded-lg bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 text-[10px] font-semibold border border-yellow-500/40 transition-colors cursor-pointer flex items-center gap-1"
                                    title="Appoint as Company CEO"
                                  >
                                    <Crown className="w-3 h-3 text-yellow-400" />
                                    <span>Make CEO</span>
                                  </button>
                                )}
                              </>
                            )}

                            {/* Leader Role Assignment by Admin/Owner */}
                            {isAdmin && (
                              !isMemberLeader ? (
                                <button
                                  type="button"
                                  onClick={() => makeLeader(member.username)}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-[10px] font-semibold border border-emerald-500/40 transition-colors cursor-pointer flex items-center gap-1"
                                  title="Set as Leader (Can upload CSV & distribute leads)"
                                >
                                  <Star className="w-3 h-3" />
                                  <span>Make Leader</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => dismissLeader(member.username)}
                                  className="px-2.5 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 text-[10px] font-semibold border border-red-500/40 transition-colors cursor-pointer flex items-center gap-1"
                                  title="Remove Leader status"
                                >
                                  <Star className="w-3 h-3 fill-red-300" />
                                  <span>Remove Leader</span>
                                </button>
                              )
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* BANNED ACCOUNTS & APPEALS SECTION FOR OWNER / ADMIN */}
                {isAdmin && (
                  <div className="bg-red-500/10 p-4 rounded-2xl border border-red-500/20 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-red-400 uppercase tracking-wider flex items-center gap-1.5">
                        <ShieldAlert className="w-4 h-4 text-red-400" /> Banned Users & Appeals
                      </span>
                      <span className="text-[10px] bg-red-500/20 text-red-300 px-2.5 py-0.5 rounded-full font-bold">
                        {(activeGroupSettings.ban_appeals || []).length} Appeals
                      </span>
                    </div>

                    {/* Review Appeals */}
                    {(activeGroupSettings.ban_appeals || []).length > 0 && (
                      <div className="space-y-2">
                        <p className="text-[11px] font-semibold text-cyan-300 flex items-center gap-1">
                          <Mail className="w-3.5 h-3.5" /> Review Requests / Ban Appeals ({(activeGroupSettings.ban_appeals || []).length})
                        </p>
                        <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                          {(activeGroupSettings.ban_appeals || []).map((appeal, idx) => (
                            <div key={idx} className="p-3 rounded-xl bg-slate-950/80 border border-cyan-500/30 text-xs space-y-1.5">
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-cyan-300">@{appeal.username}</span>
                                <span className="text-[10px] text-white/40">{new Date(appeal.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              </div>
                              <p className="text-white/80 text-[11px] italic bg-white/5 p-2 rounded-lg border border-white/5">
                                "{appeal.message}"
                              </p>
                              <div className="flex items-center gap-2 pt-1">
                                <button
                                  type="button"
                                  onClick={() => unbanUser(appeal.username)}
                                  className="flex-1 py-1.5 rounded bg-green-500/20 hover:bg-green-500/30 text-green-300 font-semibold text-[11px] border border-green-500/40 transition-colors flex items-center justify-center gap-1 cursor-pointer"
                                >
                                  <Check className="w-3.5 h-3.5" /> Accept & Unban User
                                </button>
                                <button
                                  type="button"
                                  onClick={() => dismissAppeal(appeal.username)}
                                  className="py-1.5 px-3 rounded bg-white/10 hover:bg-white/20 text-white/70 font-semibold text-[11px] transition-colors cursor-pointer"
                                >
                                  Dismiss
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Banned Users List */}
                    <div>
                      <p className="text-[11px] font-semibold text-white/70 mb-1.5 flex items-center gap-1">
                        <Ban className="w-3.5 h-3.5 text-red-400" /> Banned Accounts ({(activeGroupSettings.banned_usernames || []).length})
                      </p>
                      {(activeGroupSettings.banned_usernames || []).length === 0 ? (
                        <p className="text-xs text-white/40 italic">No users currently banned.</p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {(activeGroupSettings.banned_usernames || []).map((bannedName, idx) => (
                            <div key={idx} className="flex items-center gap-1.5 bg-red-500/20 text-red-200 border border-red-500/40 px-2.5 py-1 rounded-xl text-xs font-semibold">
                              <span>@{bannedName}</span>
                              <button
                                type="button"
                                onClick={() => unbanUser(bannedName)}
                                className="hover:text-white p-0.5 rounded bg-red-500/30 hover:bg-red-500/50 transition-colors cursor-pointer"
                                title={`Unban @${bannedName}`}
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>



      {/* TEAM ANALYTICS MODAL (Admins Only) */}
      <AnimatePresence>
        {showAnalytics && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
              className="bg-slate-900 border border-purple-500/30 rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col h-[80vh] max-h-[800px]"
            >
              {/* Header */}
              <div className="p-5 sm:p-6 border-b border-white/10 flex items-center justify-between bg-gradient-to-r from-purple-500/10 to-transparent">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400 border border-purple-500/30">
                    <BarChart2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">Team Analytics</h2>
                    <p className="text-xs text-purple-300/70">Real-time engagement & activity metrics</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowAnalytics(false)}
                  className="p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-full transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-5 sm:p-6 custom-scrollbar space-y-6">
                
                {/* Stats Overview */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col items-center justify-center text-center">
                    <span className="text-3xl font-black text-white">{totalTeamMembers}</span>
                    <span className="text-[10px] sm:text-xs text-white/50 uppercase tracking-wider font-bold mt-1">Total Members</span>
                  </div>
                  <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-4 flex flex-col items-center justify-center text-center">
                    <span className="text-3xl font-black text-emerald-400">{analyticsData.length}</span>
                    <span className="text-[10px] sm:text-xs text-emerald-400/50 uppercase tracking-wider font-bold mt-1">Active Today</span>
                  </div>
                  <div className="bg-cyan-500/5 border border-cyan-500/20 rounded-2xl p-4 flex flex-col items-center justify-center text-center">
                    <span className="text-3xl font-black text-cyan-400">
                      {analyticsData.reduce((acc, curr) => acc + curr.total_clicks, 0).toLocaleString()}
                    </span>
                    <span className="text-[10px] sm:text-xs text-cyan-400/50 uppercase tracking-wider font-bold mt-1">Total Clicks Today</span>
                  </div>
                  <div className="bg-purple-500/5 border border-purple-500/20 rounded-2xl p-4 flex flex-col items-center justify-center text-center">
                    <span className="text-3xl font-black text-purple-400">
                      {analyticsData.reduce((acc, curr) => acc + curr.messages_sent, 0).toLocaleString()}
                    </span>
                    <span className="text-[10px] sm:text-xs text-purple-400/50 uppercase tracking-wider font-bold mt-1">Messages Sent</span>
                  </div>
                </div>

                {/* Detailed Table */}
                <div className="bg-black/20 border border-white/10 rounded-2xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-white/80">
                      <thead className="text-xs text-white/50 uppercase bg-black/40 border-b border-white/10">
                        <tr>
                          <th className="px-4 py-3 font-semibold">Rank</th>
                          <th className="px-4 py-3 font-semibold">Team Member</th>
                          <th className="px-4 py-3 font-semibold text-right">Active Time</th>
                          <th className="px-4 py-3 font-semibold text-right">Actions (Clicks)</th>
                          <th className="px-4 py-3 font-semibold text-right">Messages</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analyticsData.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="px-4 py-8 text-center text-white/40 italic">
                              No activity recorded yet for today.
                            </td>
                          </tr>
                        ) : (
                          analyticsData.map((stat, idx) => {
                            const hours = Math.floor(stat.active_seconds / 3600);
                            const minutes = Math.floor((stat.active_seconds % 3600) / 60);
                            const seconds = stat.active_seconds % 60;
                            const timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                            
                            const statAvatar = getAvatarForUser(stat.username);
                            const isTop3 = idx < 3;

                            return (
                              <tr key={stat.id || stat.username} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                <td className="px-4 py-3">
                                  {isTop3 ? (
                                    <Crown className={`w-4 h-4 ${idx === 0 ? 'text-yellow-400' : idx === 1 ? 'text-slate-300' : 'text-amber-600'}`} />
                                  ) : (
                                    <span className="text-white/30 font-bold pl-1">{idx + 1}</span>
                                  )}
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-full bg-slate-800 overflow-hidden flex-shrink-0 flex justify-center items-center text-[10px] font-bold">
                                      {statAvatar ? (
                                        <img src={statAvatar} alt={stat.username} className="w-full h-full object-cover" />
                                      ) : (
                                        stat.username.substring(0, 2).toUpperCase()
                                      )}
                                    </div>
                                    <span className={`font-bold ${isTop3 ? 'text-white' : 'text-white/80'}`}>@{stat.username}</span>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-right font-mono text-cyan-300">{timeStr}</td>
                                <td className="px-4 py-3 text-right">{stat.total_clicks.toLocaleString()}</td>
                                <td className="px-4 py-3 text-right">{stat.messages_sent.toLocaleString()}</td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* STARRED MESSAGES SLIDING DRAWER */}
      <AnimatePresence>
        {showStarredDrawer && (
          <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowStarredDrawer(false)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            />

            {/* Sliding Drawer Content */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="relative w-full max-w-md bg-slate-900 border-l border-white/10 h-full shadow-2xl flex flex-col z-10 text-white"
            >
              {/* Header */}
              <div className="p-4 border-b border-white/10 flex items-center justify-between bg-black/20">
                <div className="flex items-center gap-2">
                  <Star className="w-5 h-5 fill-yellow-400 text-yellow-400 animate-pulse" />
                  <h3 className="text-base font-bold tracking-tight">Starred Messages ({starredIds.length})</h3>
                </div>
                <button
                  onClick={() => setShowStarredDrawer(false)}
                  className="p-1.5 text-white/60 hover:text-white hover:bg-white/5 rounded-full transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                {starredIds.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-8 text-white/40 space-y-3 my-auto">
                    <Star className="w-12 h-12 stroke-1 opacity-40 text-amber-400" />
                    <h4 className="text-sm font-bold text-white/80">No Starred Messages Yet</h4>
                    <p className="text-xs max-w-xs leading-relaxed text-white/50">
                      Bookmark essential text logs, photos, voice recordings, or files by opening a message's menu and clicking "Star".
                    </p>
                  </div>
                ) : (
                  messages
                    .filter((m) => starredIds.includes(m.id))
                    .map((starredMsg) => {
                      const starredAvatar = getAvatarForUser(starredMsg.username);
                      return (
                        <div
                          key={starredMsg.id}
                          className="p-4 rounded-2xl bg-white/5 border border-white/10 hover:border-amber-400/40 transition-all space-y-2.5 relative group shadow-sm"
                        >
                          {/* Unstar floating button */}
                          <button
                            onClick={() => toggleStarMessage(starredMsg.id)}
                            className="absolute top-3 right-3 p-1 rounded-lg bg-yellow-400/10 hover:bg-yellow-400/20 text-yellow-400 border border-yellow-400/20 transition-all cursor-pointer opacity-80 group-hover:opacity-100"
                            title="Unstar Bookmark"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>

                          {/* Sender Info Row */}
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-slate-700 overflow-hidden flex items-center justify-center text-[9px] font-bold border border-white/10 flex-shrink-0">
                              {starredAvatar ? (
                                <img src={starredAvatar} alt={starredMsg.username} className="w-full h-full object-cover" />
                              ) : (
                                starredMsg.username.substring(0, 2).toUpperCase()
                              )}
                            </div>
                            <div>
                              <span className="text-xs font-bold text-white">@{starredMsg.username}</span>
                              <span className="text-[9px] text-white/40 block">
                                {new Date(starredMsg.created_at).toLocaleDateString()} at {new Date(starredMsg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          </div>

                          {/* Message Content render */}
                          <div className="text-xs text-white/90 bg-black/10 p-2.5 rounded-xl border border-white/5 whitespace-pre-wrap break-words leading-relaxed">
                            {starredMsg.type === 'text' ? (
                              renderMessageContent(starredMsg.content)
                            ) : starredMsg.type === 'image' ? (
                              <img src={starredMsg.content} alt="Starred file" className="rounded-lg max-h-40 object-cover w-full cursor-pointer hover:opacity-90 transition-opacity" onClick={() => setPreviewImage(starredMsg.content)} />
                            ) : starredMsg.type === 'audio' ? (
                              <div className="space-y-1">
                                <span className="text-[10px] text-cyan-300 font-semibold block">🎙️ Starred Voice Note</span>
                                <audio src={starredMsg.content} controls className="w-full h-7 text-xs" />
                              </div>
                            ) : (
                              <div className="flex items-center justify-between gap-2">
                                <span className="truncate pr-1 font-bold">📄 {starredMsg.file_name || 'Attachment'}</span>
                                <button
                                  onClick={(e) => handleDownloadFile(e, starredMsg.content, starredMsg.file_name || 'file', starredMsg.id)}
                                  className="px-2 py-1 bg-cyan-500/20 border border-cyan-500/40 text-[10px] rounded text-cyan-300 cursor-pointer flex items-center gap-1"
                                >
                                  <Download className="w-3 h-3" /> Get File
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>


      {/* FORWARD MESSAGE MODAL */}
      <AnimatePresence>
        {showForwardModal && forwardingMessage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="w-full max-w-sm bg-slate-900 border border-white/10 rounded-3xl shadow-2xl overflow-hidden text-white"
            >
              <div className="p-4 border-b border-white/5 flex items-center justify-between">
                <h3 className="font-bold">Forward Message</h3>
                <button onClick={() => { setShowForwardModal(false); setForwardingMessage(null); }} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-4 max-h-[60vh] overflow-y-auto space-y-2">
                <button 
                  onClick={() => handleForwardMessage(null)}
                  className="w-full flex items-center gap-3 p-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 transition-colors text-left"
                >
                  <div className="w-10 h-10 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-bold text-sm">Global Chat</div>
                    <div className="text-xs text-white/50">Forward to everyone</div>
                  </div>
                </button>
                {privateMessageUsers.map(user => (
                  <button 
                    key={user}
                    onClick={() => handleForwardMessage(user)}
                    className="w-full flex items-center gap-3 p-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 transition-colors text-left"
                  >
                    <div className="w-10 h-10 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold">
                      {user.substring(0,2).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-bold text-sm">@{user}</div>
                      <div className="text-xs text-white/50">Forward privately</div>
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* LEAD MANAGEMENT MODAL */}
      <AnimatePresence>
        {showLeadManagement && (
          <LeadManagement 
            onClose={() => setShowLeadManagement(false)}
            currentUser={username!}
            isLeader={isLeader}
            teamMembers={allOrganizationMembers}
          />
        )}
      </AnimatePresence>

      {/* OWNER & ADMIN MASTER DASHBOARD */}
      <AnimatePresence>
        {showOwnerDashboard && (
          <OwnerDashboard
            onClose={() => setShowOwnerDashboard(false)}
            currentUser={username!}
            isOwner={isOwner}
            isAdmin={isAdmin}
            allMembers={allOrganizationMembers}
          />
        )}
      </AnimatePresence>

      {/* INCOMING CALL MODAL */}
      <AnimatePresence>
        {incomingCall && (
          <motion.div 
            initial={{ opacity: 0, y: -50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -50 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] bg-slate-900 border border-white/20 p-4 rounded-3xl shadow-2xl flex items-center gap-4"
          >
            <div className="w-12 h-12 rounded-full bg-slate-800 border border-white/10 overflow-hidden flex justify-center items-center font-bold text-white relative">
              <span className="absolute inset-0 bg-emerald-500/20 animate-ping rounded-full" />
              {incomingCall.from.substring(0,2).toUpperCase()}
            </div>
            <div>
              <p className="text-white font-bold">Incoming {incomingCall.type} call</p>
              <p className="text-white/60 text-xs">@{incomingCall.from}</p>
            </div>
            <div className="flex items-center gap-2 ml-4">
              <button onClick={rejectCall} className="w-10 h-10 rounded-full bg-red-500/20 text-red-500 flex items-center justify-center hover:bg-red-500/30 transition-colors">
                <PhoneOff className="w-5 h-5" />
              </button>
              <button onClick={acceptCall} className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center hover:bg-emerald-600 transition-colors animate-pulse">
                {incomingCall.type === 'video' ? <VideoIcon className="w-5 h-5" /> : <PhoneCall className="w-5 h-5" />}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ACTIVE CALL MODAL */}
      <AnimatePresence>
        {showCallModal && activeCall && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-4"
          >
            <div className="w-full max-w-4xl bg-black rounded-3xl overflow-hidden border border-white/10 relative shadow-2xl aspect-video flex items-center justify-center">
              
              {/* Remote Video / Audio indicator */}
              <video 
                ref={remoteVideoRef} 
                autoPlay 
                playsInline 
                className={`w-full h-full object-cover ${activeCall.type === 'audio' ? 'hidden' : ''}`}
              />
              {activeCall.type === 'audio' && (
                <div className="flex flex-col items-center justify-center text-white/50">
                  <div className="w-32 h-32 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-4">
                    <span className="text-4xl font-bold">{activeCall.with.substring(0,2).toUpperCase()}</span>
                  </div>
                  <span className="animate-pulse">Audio Call in progress...</span>
                </div>
              )}

              {/* Local Video PIP */}
              <div className={`absolute bottom-6 right-6 w-32 md:w-48 aspect-video bg-slate-900 rounded-2xl overflow-hidden border border-white/20 shadow-xl ${activeCall.type === 'audio' ? 'hidden' : ''}`}>
                <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
              </div>

              {/* Call Controls */}
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-slate-900/80 backdrop-blur-md p-3 rounded-full border border-white/10">
                <div className="px-4 border-r border-white/10 flex flex-col items-center justify-center">
                  <span className="text-xs text-white/50 uppercase tracking-widest font-bold">Talking to</span>
                  <span className="text-sm font-bold text-white">@{activeCall.with}</span>
                </div>
                <button onClick={endCall} className="w-12 h-12 rounded-full bg-red-500 hover:bg-red-600 transition-colors text-white flex items-center justify-center shadow-lg cursor-pointer">
                  <PhoneOff className="w-5 h-5" />
                </button>
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MOBILE ACTIONS BOTTOM SHEET DRAWER */}
      <AnimatePresence>
        {showMobileMenu && (
          <div className="fixed inset-0 z-50 sm:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/75 backdrop-blur-sm"
              onClick={() => setShowMobileMenu(false)}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="fixed bottom-0 inset-x-0 bg-slate-900/95 border-t border-white/15 rounded-t-3xl p-5 shadow-2xl backdrop-blur-2xl max-h-[85vh] overflow-y-auto z-10"
            >
              {/* Drag bar indicator */}
              <div className="w-12 h-1 bg-white/25 rounded-full mx-auto mb-4" />

              {/* User Profile Mini Card */}
              <div className="flex items-center justify-between bg-white/5 border border-white/10 rounded-2xl p-3.5 mb-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-cyan-500 to-purple-600 flex items-center justify-center overflow-hidden border border-white/20 flex-shrink-0 shadow-md">
                    {userAvatar ? (
                      <img src={userAvatar} alt={username} className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-5 h-5 text-white" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-sm text-white truncate">@{username}</div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {isOwner ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30">Owner</span>
                      ) : isAdmin ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">Admin</span>
                      ) : (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-700 text-white/70">Member</span>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowMobileMenu(false);
                    openUserProfileCard(username);
                  }}
                  className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold px-3 py-1.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 active:scale-95 transition-all"
                >
                  View Profile
                </button>
              </div>

              {/* Navigation Actions */}
              <div className="space-y-1.5">
                {(isOwner || isAdmin) && (
                  <button
                    onClick={() => {
                      setShowMobileMenu(false);
                      setShowOwnerDashboard(true);
                    }}
                    className="w-full flex items-center justify-between p-3 rounded-2xl bg-gradient-to-r from-amber-500/15 via-purple-500/15 to-purple-600/15 border border-amber-500/30 text-amber-200 text-xs font-bold active:scale-[0.99] transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-300 border border-amber-500/30">
                        <Crown className="w-4 h-4" />
                      </div>
                      <span>Owner Command Center</span>
                    </div>
                    <span className="text-[10px] bg-amber-400/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-400/30 font-semibold">Dashboard</span>
                  </button>
                )}

                <button
                  onClick={() => {
                    setShowMobileMenu(false);
                    setShowLeadManagement(true);
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-medium active:scale-[0.99] transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-400 border border-blue-500/30">
                      <Briefcase className="w-4 h-4" />
                    </div>
                    <span>Lead Management CRM</span>
                  </div>
                </button>

                <button
                  onClick={() => {
                    setShowMobileMenu(false);
                    setShowStarredDrawer(true);
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-medium active:scale-[0.99] transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-400 border border-amber-500/30">
                      <Star className="w-4 h-4 fill-amber-400" />
                    </div>
                    <span>Starred Messages</span>
                  </div>
                  {starredIds.length > 0 && (
                    <span className="text-xs bg-red-500 text-white font-bold px-2 py-0.5 rounded-full">
                      {starredIds.length}
                    </span>
                  )}
                </button>

                {isAdmin && (
                  <button
                    onClick={() => {
                      setShowMobileMenu(false);
                      openAnalyticsDashboard();
                    }}
                    className="w-full flex items-center justify-between p-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-medium active:scale-[0.99] transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-400 border border-purple-500/30">
                        <Activity className="w-4 h-4" />
                      </div>
                      <span>Team Analytics & Activity</span>
                    </div>
                  </button>
                )}

                <div className="bg-white/5 border border-white/10 rounded-2xl p-3 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-xl bg-cyan-500/20 flex items-center justify-center text-cyan-400 border border-cyan-500/30">
                        {notificationsEnabled ? <BellRing className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5 opacity-60" />}
                      </div>
                      <span className="text-xs font-medium text-white">Push Notifications</span>
                    </div>
                    <button
                      onClick={requestNotificationPermission}
                      className={cn(
                        "text-[10px] font-bold px-2.5 py-1 rounded-lg border transition-all active:scale-95",
                        notificationsEnabled ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" : "bg-white/10 text-white/60 border-white/10"
                      )}
                    >
                      {notificationsEnabled ? "Enabled ✓" : "Enable"}
                    </button>
                  </div>

                  <div className="flex items-center justify-between pt-1.5 border-t border-white/5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-400 border border-purple-500/30">
                        {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5 opacity-60" />}
                      </div>
                      <span className="text-xs font-medium text-white">Sound Alerts</span>
                    </div>
                    <button
                      onClick={toggleSoundAlerts}
                      className={cn(
                        "text-[10px] font-bold px-2.5 py-1 rounded-lg border transition-all active:scale-95",
                        soundEnabled ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/30" : "bg-white/10 text-white/50 border-white/10"
                      )}
                    >
                      {soundEnabled ? "Sound ON" : "Muted"}
                    </button>
                  </div>

                  <div className="pt-1 flex justify-end">
                    <button
                      onClick={testNotification}
                      className="text-[10px] font-bold text-cyan-300 hover:text-cyan-200 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 px-3 py-1 rounded-lg transition-all active:scale-95 flex items-center gap-1 cursor-pointer"
                    >
                      <Bell className="w-3 h-3" /> Test Alert & Sound
                    </button>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setShowMobileMenu(false);
                    openSettings();
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-medium active:scale-[0.99] transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-slate-700/50 flex items-center justify-center text-white/80 border border-white/10">
                      <Settings className="w-4 h-4" />
                    </div>
                    <span>Account & Chat Settings</span>
                  </div>
                </button>

                <button
                  onClick={() => {
                    setShowMobileMenu(false);
                    openGroupSettings();
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-medium active:scale-[0.99] transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-pink-500/20 flex items-center justify-center text-pink-400 border border-pink-500/30">
                      <Users className="w-4 h-4" />
                    </div>
                    <span>Group Information</span>
                  </div>
                </button>

                {isInstallable && (
                  <button
                    onClick={() => {
                      setShowMobileMenu(false);
                      handleInstallApp();
                    }}
                    className="w-full flex items-center justify-between p-3 rounded-2xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-xs font-semibold active:scale-[0.99] transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-emerald-500/30 flex items-center justify-center text-emerald-300">
                        <Download className="w-4 h-4" />
                      </div>
                      <span>Install App to Home Screen</span>
                    </div>
                  </button>
                )}

                <div className="pt-2">
                  <button
                    onClick={() => {
                      setShowMobileMenu(false);
                      handleLogout();
                    }}
                    className="w-full flex items-center justify-center gap-2 p-3 rounded-2xl bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-300 text-xs font-bold transition-colors active:scale-95"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sign Out (@{username})</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

