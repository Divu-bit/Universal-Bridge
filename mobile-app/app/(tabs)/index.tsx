import { useEffect, useState, useRef, useCallback } from 'react';
import { StyleSheet, Text, View, ScrollView, Platform, Animated, TouchableOpacity, Alert, Share, AppState } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import axios from 'axios';
import ActionParser from '../../components/ActionParser';

Notifications.setNotificationHandler({
  handleNotification: async (): Promise<Notifications.NotificationBehavior> => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// ============================================================
// MODULE-LEVEL cold-start catcher — runs BEFORE React mounts.
// This is critical: on Android standalone APKs, when the app is
// fully killed and user taps a notification, the response event
// fires before any React component useEffect can register a
// listener. We catch it here at the JS module level.
// ============================================================
let coldStartNotificationResponse: Notifications.NotificationResponse | null = null;
const coldStartListener = Notifications.addNotificationResponseReceivedListener((response) => {
  coldStartNotificationResponse = response;
});
// We only need this to capture the very first response, so we
// remove it after a short window (the component will set up its
// own listener in useEffect).
setTimeout(() => {
  coldStartListener.remove();
}, 5000);

const BRIDGE_SERVER_URL = 'https://universal-bridge.onrender.com';

interface NotificationItem {
  id: string;
  notificationId?: string;
  title: string;
  body: string;
  schema: any[];
  timestamp: Date;
  status: 'pending' | 'completed';
}

export default function HomeScreen() {
  const [expoPushToken, setExpoPushToken] = useState<string | undefined>('');
  const [appUserId, setAppUserId] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const notificationListener = useRef<any>(null);
  const responseListener = useRef<any>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const lastNotificationResponse = Notifications.useLastNotificationResponse();

  const addNotification = useCallback((title: string, body: string, schema: any[], identifier?: string, timestamp?: Date, notificationId?: string) => {
    const targetId = identifier || (Date.now().toString() + Math.random().toString(36).substr(2, 5));
    
    setNotifications(prev => {
      if (identifier && prev.some(n => n.id === identifier)) {
        return prev;
      }
      
      const newNotif: NotificationItem = {
        id: targetId,
        notificationId,
        title,
        body,
        schema,
        timestamp: timestamp || new Date(),
        status: 'pending',
      };
      return [newNotif, ...prev];
    });
    setExpandedId(targetId);
  }, []);

  const processNotificationContent = useCallback((content: any, identifier: string) => {
    const data = content.data;
    if (data && data.interactiveSchema) {
       try {
         const parsedSchema = JSON.parse(data.interactiveSchema);
         const timestamp = data.createdAt ? new Date(data.createdAt) : new Date();
         const notificationId = data.notificationId || undefined;
         addNotification(content.title || 'Notification', content.body || '', parsedSchema, identifier, timestamp, notificationId);
       } catch(e) {
         console.log("Failed to parse schema", e);
       }
    }
  }, [addNotification]);

  // Process the hook-based last notification response, but ONLY after data is loaded
  // to prevent the race condition where loadData overwrites the notification.
  useEffect(() => {
    if (!isDataLoaded) return;
    if (lastNotificationResponse && lastNotificationResponse.notification) {
      processNotificationContent(
          lastNotificationResponse.notification.request.content,
          lastNotificationResponse.notification.request.identifier
      );
    }
  }, [lastNotificationResponse, processNotificationContent, isDataLoaded]);

  const markCompleted = useCallback((id: string) => {
    setNotifications(prev => {
      const target = prev.find(n => n.id === id);
      // Sync completion to server if we have a server-side notificationId
      if (target?.notificationId) {
        axios.patch(`${BRIDGE_SERVER_URL}/api/notify/${target.notificationId}/complete`).catch(console.error);
      }
      return prev.map(n => n.id === id ? { ...n, status: 'completed' as const } : n);
    });
    setExpandedId(null);
  }, []);

  const clearCompleted = useCallback(() => {
    setNotifications(prev => {
      const completed = prev.filter(n => n.status === 'completed');
      // Delete each completed notification from server
      completed.forEach(n => {
        if (n.notificationId) {
          axios.delete(`${BRIDGE_SERVER_URL}/api/notify/${n.notificationId}`).catch(console.error);
        }
      });
      return prev.filter(n => n.status !== 'completed');
    });
  }, []);

  const pendingCount = notifications.filter(n => n.status === 'pending').length;
  const completedCount = notifications.filter(n => n.status === 'completed').length;

  useEffect(() => {
    const loadData = async () => {
      try {
        const storedUserId = await AsyncStorage.getItem('@appUserId');
        if (storedUserId) setAppUserId(storedUserId);

        const storedNotifs = await AsyncStorage.getItem('@notifications');
        if (storedNotifs) {
          const parsed = JSON.parse(storedNotifs);
          setNotifications(parsed.map((n: any) => ({ ...n, timestamp: new Date(n.timestamp) })));
        }
      } catch (e) {
        console.error('Failed to load storage', e);
      } finally {
        setIsDataLoaded(true);
      }
    };
    loadData();
  }, []);

  useEffect(() => {
    if (isDataLoaded) {
      AsyncStorage.setItem('@notifications', JSON.stringify(notifications)).catch(console.error);
    }
  }, [notifications, isDataLoaded]);

  // ========== ANIMATIONS & REGISTRATION (runs once on mount) ==========
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.4, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    ).start();

    registerForPushNotificationsAsync().then((token) => {
       setExpoPushToken(token);
       if(token) {
          AsyncStorage.getItem('@appUserId').then(storedUserId => {
            axios.post(`${BRIDGE_SERVER_URL}/api/users/register`, {
              pushToken: token,
              ...(storedUserId ? { appUserId: storedUserId } : {})
            }).then(res => {
              console.log('Registered user', res.data);
              if (res.data.appUserId) {
                setAppUserId(res.data.appUserId);
                AsyncStorage.setItem('@appUserId', res.data.appUserId).catch(console.error);
              }
            }).catch(err => console.log('Register failed. Server might be off or IP is wrong.'));
          }).catch(console.error);
       }
    });

    // Foreground listener — always safe, app is active so data is loaded
    notificationListener.current = Notifications.addNotificationReceivedListener((notification: any) => {
      processNotificationContent(
          notification.request.content,
          notification.request.identifier
      );
    });

    // Response listener for taps while app is in foreground/background
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response: any) => {
      processNotificationContent(
          response.notification.request.content,
          response.notification.request.identifier
      );
    });

    return () => {
      if (notificationListener.current) notificationListener.current.remove();
      if (responseListener.current) responseListener.current.remove();
    };
  }, []);

  // ========== COLD-START & BACKGROUND PROCESSING (runs AFTER data is loaded) ==========
  // This is the critical fix: we must wait for AsyncStorage data to finish loading
  // before we inject cold-start/background notifications into state, otherwise
  // loadData's setNotifications() will overwrite them.
  useEffect(() => {
    if (!isDataLoaded) return;

    // 1. COLD START — Process notification captured at module level (before React mounted)
    if (coldStartNotificationResponse) {
      const resp = coldStartNotificationResponse;
      coldStartNotificationResponse = null;
      processNotificationContent(
        resp.notification.request.content,
        resp.notification.request.identifier
      );
    }

    // 2. FALLBACK — Also check via async API in case the module-level listener missed it
    Notifications.getLastNotificationResponseAsync().then(response => {
      if (response && response.notification) {
        processNotificationContent(
          response.notification.request.content,
          response.notification.request.identifier
        );
      }
    });

    // 3. Fetch notifications from server database (the reliable source of truth)
    const fetchFromServer = async () => {
      try {
        const userId = appUserId || await AsyncStorage.getItem('@appUserId');
        if (!userId) return;
        const res = await axios.get(`${BRIDGE_SERVER_URL}/api/notify/${userId}`);
        const serverNotifs = res.data;
        if (Array.isArray(serverNotifs)) {
          serverNotifs.forEach((sn: any) => {
            if (sn.interactiveSchema && sn.status === 'pending') {
              const schema = typeof sn.interactiveSchema === 'string'
                ? JSON.parse(sn.interactiveSchema)
                : sn.interactiveSchema;
              addNotification(
                sn.title,
                sn.body || '',
                schema,
                sn._id, // use server _id as the unique identifier
                new Date(sn.createdAt),
                sn._id
              );
            }
          });
        }
      } catch (e) {
        console.log('Failed to fetch notifications from server', e);
      }
    };
    fetchFromServer();

    // 4. Fetch notifications currently in the tray (received while app was backgrounded)
    const fetchPresented = async () => {
      try {
        const presented = await Notifications.getPresentedNotificationsAsync();
        presented.forEach(notification => {
          processNotificationContent(
            notification.request.content,
            notification.request.identifier
          );
        });
      } catch (e) {
        console.log("Error fetching presented notifications", e);
      }
    };
    fetchPresented();

    // 4. Listen to AppState to re-fetch presented when coming back to foreground
    const appStateSubscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active') {
        fetchPresented();
      }
    });

    return () => {
      appStateSubscription.remove();
    };
  }, [isDataLoaded]);

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <View style={styles.background}>
      <Animated.ScrollView
        contentContainerStyle={styles.container}
        style={{ opacity: fadeAnim }}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.emoji}>🌉</Text>
          <Text style={styles.title}>Universal Bridge</Text>
          <Text style={styles.tagline}>Your notification command center</Text>
        </View>

        {/* Status Card */}
        <View style={styles.statusCard}>
          <View style={styles.statusRow}>
            <Animated.View style={[styles.statusDot, { transform: [{ scale: pulseAnim }] }]} />
            <Text style={styles.statusText}>Connected & Listening</Text>
          </View>
        </View>

        {/* User ID Card — This is what developers need */}
        <View style={styles.userIdCard}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardIcon}>👤</Text>
            <Text style={styles.cardTitle}>Your User ID</Text>
          </View>
          <Text style={styles.userIdHint}>
            Share this ID with any app to receive notifications
          </Text>
          <View style={styles.userIdRow}>
            <Text selectable style={styles.userId}>
              {appUserId || 'Connecting...'}
            </Text>
            <TouchableOpacity
              style={[styles.copyButton, copied && styles.copyButtonDone]}
              onPress={async () => {
                if (appUserId) {
                  await Clipboard.setStringAsync(appUserId);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }
              }}
              activeOpacity={0.7}
            >
              <Text style={[styles.copyButtonText, copied && styles.copyButtonTextDone]}>
                {copied ? '✓ Copied' : '📋 Copy'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Push Token — smaller, for debugging */}
        <TouchableOpacity
          style={styles.tokenRow}
          onPress={() => {
            if (expoPushToken) {
              Share.share({ message: expoPushToken });
            }
          }}
          activeOpacity={0.7}
        >
          <Text style={styles.tokenLabel}>🔑 Push Token</Text>
          <Text style={styles.tokenValue} numberOfLines={1}>
            {expoPushToken || 'Fetching...'}
          </Text>
        </TouchableOpacity>

        {/* Notifications Header */}
        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>
            NOTIFICATIONS{pendingCount > 0 ? ` (${pendingCount})` : ''}
          </Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Notification List */}
        {notifications.length > 0 ? (
          <View style={styles.notifList}>
            {/* Clear completed button */}
            {completedCount > 0 && (
              <TouchableOpacity style={styles.clearButton} onPress={clearCompleted} activeOpacity={0.7}>
                <Text style={styles.clearButtonText}>🗑️ Clear {completedCount} completed</Text>
              </TouchableOpacity>
            )}

            {notifications.map((notif) => {
              const isExpanded = expandedId === notif.id;
              const isPending = notif.status === 'pending';

              return (
                <View key={notif.id} style={[
                  styles.notifCard,
                  isPending ? styles.notifCardPending : styles.notifCardCompleted,
                ]}>
                  {/* Notification Header — tappable to expand/collapse */}
                  <TouchableOpacity
                    onPress={() => setExpandedId(isExpanded ? null : notif.id)}
                    activeOpacity={0.7}
                    style={styles.notifHeader}
                  >
                    <View style={styles.notifHeaderLeft}>
                      <Text style={styles.notifStatusIcon}>
                        {isPending ? '⚡' : '✅'}
                      </Text>
                      <View style={styles.notifHeaderText}>
                        <Text style={[
                          styles.notifTitle,
                          !isPending && styles.notifTitleCompleted,
                        ]} numberOfLines={isExpanded ? undefined : 1}>
                          {notif.title}
                        </Text>
                        {notif.body ? (
                          <Text style={styles.notifBody} numberOfLines={isExpanded ? undefined : 1}>
                            {notif.body}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                    <View style={styles.notifHeaderRight}>
                      <Text style={styles.notifTime}>{formatTime(notif.timestamp)}</Text>
                      <Text style={styles.notifChevron}>{isExpanded ? '▲' : '▼'}</Text>
                    </View>
                  </TouchableOpacity>

                  {/* Expanded Content — shows interactive form */}
                  {isExpanded && (
                    <View style={styles.notifExpandedContent}>
                      <View style={styles.notifExpandedDivider} />
                      {isPending ? (
                        <ActionParser
                          schema={notif.schema}
                          onActionCompleted={() => markCompleted(notif.id)}
                        />
                      ) : (
                        <View style={styles.completedBadge}>
                          <Text style={styles.completedBadgeText}>✅ Action completed</Text>
                        </View>
                      )}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        ) : (
          <View style={styles.waitingCard}>
            <Text style={styles.waitingEmoji}>📡</Text>
            <Text style={styles.waitingTitle}>All Clear</Text>
            <Text style={styles.waitingSubtitle}>
              Waiting for interactive notifications...
            </Text>
            <View style={styles.waitingDots}>
              <View style={[styles.dot, { opacity: 0.3 }]} />
              <View style={[styles.dot, { opacity: 0.6 }]} />
              <View style={[styles.dot, { opacity: 1 }]} />
            </View>
          </View>
        )}

        <View style={{ height: 40 }} />
      </Animated.ScrollView>
    </View>
  );
}

async function registerForPushNotificationsAsync() {
  let token;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      alert('Failed to get push token for push notification!');
      return;
    }
    try {
        const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
        token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    } catch (e) {
        token = `Error: ${(e as Error).message}`;
    }
  } else {
    alert('Must use physical device for Push Notifications');
  }

  return token;
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    backgroundColor: '#0F0F1A',
  },
  container: {
    padding: 20,
    paddingTop: 60,
    flexGrow: 1,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  emoji: {
    fontSize: 48,
    marginBottom: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  tagline: {
    fontSize: 14,
    color: '#7B7FA0',
    marginTop: 4,
    letterSpacing: 0.5,
  },
  statusCard: {
    backgroundColor: 'rgba(34, 197, 94, 0.08)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.2)',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22C55E',
    marginRight: 10,
  },
  statusText: {
    color: '#22C55E',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: '#1A1A2E',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#2A2A40',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#E0E0F0',
    letterSpacing: 0.5,
  },
  userIdCard: {
    backgroundColor: '#1A1A2E',
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#6C5CE7',
    shadowColor: '#6C5CE7',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  userIdHint: {
    fontSize: 12,
    color: '#5A5A7A',
    marginBottom: 12,
  },
  userIdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  userId: {
    flex: 1,
    fontSize: 14,
    color: '#A78BFA',
    backgroundColor: '#12121F',
    padding: 12,
    borderRadius: 10,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: '600',
    borderWidth: 1,
    borderColor: '#1E1E35',
  },
  copyButton: {
    backgroundColor: 'rgba(108, 92, 231, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(108, 92, 231, 0.35)',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  copyButtonDone: {
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    borderColor: 'rgba(34, 197, 94, 0.35)',
  },
  copyButtonText: {
    color: '#A78BFA',
    fontSize: 13,
    fontWeight: '700',
  },
  copyButtonTextDone: {
    color: '#22C55E',
  },
  tokenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#12121F',
    borderRadius: 10,
    padding: 10,
    paddingHorizontal: 14,
    marginBottom: 20,
    gap: 8,
  },
  tokenLabel: {
    fontSize: 11,
    color: '#4A4A6A',
    fontWeight: '600',
  },
  tokenValue: {
    flex: 1,
    fontSize: 10,
    color: '#3A3A5A',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  token: {
    fontSize: 11,
    color: '#8B8FA3',
    backgroundColor: '#12121F',
    padding: 14,
    borderRadius: 10,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#1E1E35',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#2A2A40',
  },
  dividerText: {
    color: '#4A4A6A',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    paddingHorizontal: 12,
  },

  // Notification List
  notifList: {
    gap: 12,
  },
  clearButton: {
    alignSelf: 'flex-end',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
    marginBottom: 4,
  },
  clearButtonText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '600',
  },

  // Notification Card
  notifCard: {
    backgroundColor: '#1A1A2E',
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  notifCardPending: {
    borderColor: '#6C5CE7',
    shadowColor: '#6C5CE7',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  notifCardCompleted: {
    borderColor: '#2A2A40',
    opacity: 0.7,
  },
  notifHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  notifHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  notifStatusIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  notifHeaderText: {
    flex: 1,
  },
  notifTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  notifTitleCompleted: {
    color: '#7B7FA0',
    textDecorationLine: 'line-through',
  },
  notifBody: {
    fontSize: 13,
    color: '#7B7FA0',
    marginTop: 2,
  },
  notifHeaderRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  notifTime: {
    fontSize: 11,
    color: '#4A4A6A',
    fontWeight: '500',
  },
  notifChevron: {
    fontSize: 10,
    color: '#4A4A6A',
  },

  // Expanded Content
  notifExpandedContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  notifExpandedDivider: {
    height: 1,
    backgroundColor: '#2A2A45',
    marginBottom: 16,
  },
  completedBadge: {
    backgroundColor: 'rgba(34, 197, 94, 0.08)',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  completedBadgeText: {
    color: '#22C55E',
    fontSize: 14,
    fontWeight: '600',
  },

  // Waiting State
  waitingCard: {
    backgroundColor: '#1A1A2E',
    borderRadius: 20,
    padding: 40,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2A2A40',
  },
  waitingEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  waitingTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#E0E0F0',
    marginBottom: 8,
  },
  waitingSubtitle: {
    fontSize: 14,
    color: '#5A5A7A',
    textAlign: 'center',
    lineHeight: 20,
  },
  waitingDots: {
    flexDirection: 'row',
    marginTop: 20,
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#6C5CE7',
  },
});
