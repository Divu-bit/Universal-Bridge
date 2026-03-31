import { useEffect, useState, useRef } from 'react';
import { StyleSheet, Text, View, ScrollView, Platform, Animated } from 'react-native';
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

const BRIDGE_SERVER_URL = 'https://universal-bridge.onrender.com';

export default function HomeScreen() {
  const [expoPushToken, setExpoPushToken] = useState<string | undefined>('');
  const [schema, setSchema] = useState<any>(null);
  const notificationListener = useRef<any>(null);
  const responseListener = useRef<any>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Entrance fade-in
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();

    // Pulse animation for the status dot
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.4, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    ).start();

    registerForPushNotificationsAsync().then((token) => {
       setExpoPushToken(token);
       if(token) {
          axios.post(`${BRIDGE_SERVER_URL}/api/users/register`, {
            pushToken: token
          }).then(res => console.log('Registered user', res.data))
            .catch(err => console.log('Register failed. Server might be off or IP is wrong.'));
       }
    });

    notificationListener.current = Notifications.addNotificationReceivedListener((notification: any) => {
      const data = notification.request.content.data;
      if (data && data.interactiveSchema) {
         try {
           const parsedSchema = JSON.parse(data.interactiveSchema);
           setSchema(parsedSchema);
         } catch(e) {
           console.log("Failed to parse schema", e);
         }
      }
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener((response: any) => {
      const data = response.notification.request.content.data;
      if (data && data.interactiveSchema) {
         try {
           setSchema(JSON.parse(data.interactiveSchema));
         } catch(e) {}
      }
    });

    return () => {
      if (notificationListener.current) {
         notificationListener.current.remove();
      }
      if (responseListener.current) {
         responseListener.current.remove();
      }
    };
  }, []);

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

        {/* Token Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardIcon}>🔑</Text>
            <Text style={styles.cardTitle}>Push Token</Text>
          </View>
          <Text selectable style={styles.token}>
            {expoPushToken || "Fetching token..."}
          </Text>
        </View>

        {/* Divider */}
        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>NOTIFICATIONS</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Interactive Schema / Waiting */}
        {schema ? (
          <View style={styles.schemaCard}>
            <View style={styles.schemaHeader}>
              <Text style={styles.schemaIcon}>⚡</Text>
              <Text style={styles.schemaTitle}>Action Required</Text>
            </View>
            <View style={styles.schemaDivider} />
            <ActionParser schema={schema} onActionCompleted={() => setSchema(null)} />
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
    marginBottom: 24,
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
  schemaCard: {
    backgroundColor: '#1A1A2E',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: '#6C5CE7',
    shadowColor: '#6C5CE7',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  schemaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  schemaIcon: {
    fontSize: 20,
    marginRight: 10,
  },
  schemaTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  schemaDivider: {
    height: 1,
    backgroundColor: '#2A2A45',
    marginBottom: 16,
  },
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
