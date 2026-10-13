import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '../../context/AuthContext';
import { confirm } from '../../utils/confirm';
import { api } from '../../api/client';
import { Screen, Card, Section, Avatar, Badge, StatusPill, EmptyState, Loader, Button } from '../../components/ui';
import { colors, radius, spacing, typography, shadow } from '../../theme';
import { greeting, relativeTime, formatDate, shortTime } from '../../utils/format';

const QUICK_ACTIONS = [
  { key: 'visitor', label: 'Pre-approve\nvisitor', icon: 'person-add', route: 'VisitorCreate' },
  { key: 'complaint', label: 'Raise\ncomplaint', icon: 'construct', route: 'ComplaintCreate' },
  { key: 'booking', label: 'Book\namenity', icon: 'calendar', tab: 'Bookings' },
  { key: 'market', label: 'Market-\nplace', icon: 'pricetags', tab: 'Market' },
  { key: 'events', label: 'Events &\nnotices', icon: 'megaphone', route: 'Announcements' },
  { key: 'history', label: 'My\nbookings', icon: 'time', route: 'BookingHistory' },
];

export default function HomeScreen({ navigation }) {
  const { user, logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState({
    announcements: [], complaints: [], bookings: [], visitors: [], unread: 0,
  });

  const load = useCallback(async () => {
    try {
      setError(null);
      const [announcements, complaints, bookings, visitors, unread] = await Promise.all([
        api('/api/announcements', { params: { limit: 3 } }).catch(() => []),
        api('/api/complaints', { params: { limit: 3 } }).catch(() => ({ items: [] })),
        api('/api/bookings/upcoming').catch(() => []),
        api('/api/visitors', { params: { status: 'pending' } }).catch(() => ({ items: [] })),
        api('/api/notifications/unread-count').catch(() => ({ count: 0 })),
      ]);
      setData({
        announcements: announcements.items || announcements || [],
        complaints: complaints.items || [],
        bookings: bookings.items || bookings || [],
        visitors: visitors.items || [],
        unread: unread.count || 0,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  if (loading) return <Loader label="Loading your community…" />;

  const pendingComplaints = data.complaints.filter((c) => c.status !== 'resolved');
  const urgentVisitor = data.visitors[0];

  return (
    <Screen scroll contentStyle={{ paddingHorizontal: 0, paddingTop: 0 }}>
      <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />

      {/* ---------------------------------------------------------- header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.hello}>{greeting()},</Text>
            <Text style={styles.name}>{user?.fullName || 'Resident'}</Text>
            <View style={styles.flatPill}>
              <Ionicons name="home-outline" size={12} color={colors.primary} />
              <Text style={styles.flatText}>{user?.flatLabel || 'Flat not assigned'}</Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.bell}
            onPress={() => navigation.navigate('Notifications')}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="notifications-outline" size={22} color={colors.text} />
            <View style={{ position: 'absolute', right: 6, top: 6 }}>
              <Badge count={data.unread} />
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => navigation.navigate('Profile')}
            accessibilityLabel="Profile"
          >
            <Avatar name={user?.fullName} size={42} style={styles.avatar} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.logoutBtn}
            onPress={() => confirm('Log out?', 'You will need your mobile OTP to sign back in.', 'Log out', logout)}
            accessibilityLabel="Log out"
          >
            <Ionicons name="log-out-outline" size={18} color={colors.textInverse} />
            <Text style={styles.logoutText}>Log out</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.body}>
        {error ? (
          <Card style={{ borderColor: colors.dangerBg, marginBottom: spacing.lg }}>
            <Text style={[typography.small, { color: colors.danger }]}>{error}</Text>
            <Button title="Retry" onPress={load} small variant="secondary" style={{ marginTop: spacing.md, alignSelf: 'flex-start' }} />
          </Card>
        ) : null}

        {/* ------------------------------------------- visitor alert strip */}
        {urgentVisitor ? (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => navigation.navigate('VisitorDetail', { id: urgentVisitor.id })}
          >
            <Card style={[styles.alertCard, { borderColor: colors.warningBg }]}>
              <View style={[styles.alertIcon, { backgroundColor: colors.warningBg }]}>
                <Ionicons name="alert-circle" size={20} color="#9A7100" />
              </View>
              <View style={{ flex: 1, marginLeft: spacing.md }}>
                <Text style={styles.alertTitle}>Visitor waiting for your approval</Text>
                <Text style={typography.small} numberOfLines={1}>
                  {urgentVisitor.visitor_name} • {urgentVisitor.purpose} • {relativeTime(urgentVisitor.created_at)}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#9A7100" />
            </Card>
          </TouchableOpacity>
        ) : null}

        {/* ------------------------------------------------- quick actions */}
        <View style={styles.grid}>
          {QUICK_ACTIONS.map((action) => (
            <TouchableOpacity
              key={action.key}
              style={styles.gridItem}
              activeOpacity={0.85}
              onPress={() =>
                action.tab
                  ? navigation.navigate('Tabs', { screen: action.tab })
                  : navigation.navigate(action.route)
              }
            >
              <View style={styles.gridIcon}>
                <Ionicons name={action.icon} size={21} color={colors.primary} />
              </View>
              <Text style={styles.gridLabel}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* -------------------------------------------------- announcements */}
        <Section title="Announcements" action="See all" onAction={() => navigation.navigate('Announcements')}>
          {data.announcements.length === 0 ? (
            <Card>
              <Text style={typography.small}>No announcements yet.</Text>
            </Card>
          ) : (
            data.announcements.map((a) => (
              <Card key={a.id} style={styles.announceCard} onPress={() => navigation.navigate('Announcements')}>
                <View style={styles.announceHead}>
                  <StatusPill
                    status={a.category}
                    label={a.category?.toUpperCase()}
                    style={{ backgroundColor: colors.primaryLight }}
                  />
                  <Text style={typography.tiny}>{relativeTime(a.published_at)}</Text>
                </View>
                <Text style={styles.announceTitle} numberOfLines={1}>{a.title}</Text>
                <Text style={typography.small} numberOfLines={2}>{a.body}</Text>
              </Card>
            ))
          )}
        </Section>

        {/* ----------------------------------------------------- complaints */}
        <Section title="My complaints" action="See all" onAction={() => navigation.navigate('Tabs', { screen: 'Complaints' })}>
          {data.complaints.length === 0 ? (
            <Card onPress={() => navigation.navigate('ComplaintCreate')}>
              <View style={styles.inlineEmpty}>
                <Ionicons name="checkmark-circle-outline" size={18} color={colors.success} />
                <Text style={[typography.small, { marginLeft: 8, flex: 1 }]}>
                  Nothing pending. Raise a complaint when something needs attention.
                </Text>
              </View>
            </Card>
          ) : (
            data.complaints.map((c) => (
              <Card
                key={c.id}
                style={styles.listCard}
                onPress={() => navigation.navigate('ComplaintDetail', { id: c.id })}
              >
                <View style={{ flex: 1 }}>
                  <Text style={typography.body} numberOfLines={1}>{c.title}</Text>
                  <Text style={[typography.tiny, { marginTop: 2 }]}>
                    {c.reference_no} • {c.category_name} • {relativeTime(c.created_at)}
                  </Text>
                </View>
                <StatusPill status={c.status} />
              </Card>
            ))
          )}
          {pendingComplaints.length ? <Text style={[typography.tiny, { marginTop: 8 }]}>{pendingComplaints.length} open</Text> : null}
        </Section>

        {/* ------------------------------------------------------ bookings */}
        <Section title="Upcoming bookings" action="History" onAction={() => navigation.navigate('BookingHistory')}>
          {data.bookings.length === 0 ? (
            <Card onPress={() => navigation.navigate('Tabs', { screen: 'Bookings' })}>
              <View style={styles.inlineEmpty}>
                <Ionicons name="calendar-outline" size={18} color={colors.primary} />
                <Text style={[typography.small, { marginLeft: 8, flex: 1 }]}>
                  No upcoming slots. Book the gym, hall or a court.
                </Text>
              </View>
            </Card>
          ) : (
            data.bookings.map((b) => (
              <Card key={b.id} style={styles.listCard}>
                <View style={styles.bookingIcon}>
                  <Ionicons name="calendar" size={17} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={typography.body}>{b.amenity_name}</Text>
                  <Text style={[typography.tiny, { marginTop: 2 }]}>
                    {formatDate(b.slot_date, { withYear: false })} • {shortTime(b.start_time)}–{shortTime(b.end_time)}
                  </Text>
                </View>
                <StatusPill status="confirmed" />
              </Card>
            ))
          )}
        </Section>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl + spacing.md,
    paddingBottom: spacing.xl + spacing.lg,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  headerTop: { flexDirection: 'row', alignItems: 'center' },
  hello: { color: '#B9D4CB', fontSize: 14, fontWeight: '600' },
  name: { color: colors.textInverse, fontSize: 24, fontWeight: '800', letterSpacing: -0.4, marginTop: 2 },
  flatPill: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.16)', paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 999, marginTop: spacing.sm,
  },
  flatText: { color: '#EAF5F1', fontSize: 12, fontWeight: '700', marginLeft: 5 },
  bell: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm,
  },
  avatar: { backgroundColor: colors.card },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', marginLeft: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: 21,
    paddingHorizontal: 12, height: 42,
  },
  logoutText: { color: colors.textInverse, fontSize: 13, fontWeight: '700', marginLeft: 6 },
  body: { padding: spacing.lg, marginTop: -spacing.md },
  alertCard: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, marginBottom: spacing.lg },
  alertIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  alertTitle: { fontWeight: '700', fontSize: 14, color: colors.text },
  grid: {
    flexDirection: 'row', flexWrap: 'wrap', backgroundColor: colors.card,
    borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
    paddingVertical: spacing.md, ...shadow.card,
  },
  gridItem: { width: '33.33%', alignItems: 'center', paddingVertical: spacing.md },
  gridIcon: {
    width: 46, height: 46, borderRadius: 16, backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center', marginBottom: 7,
  },
  gridLabel: { fontSize: 11.5, fontWeight: '700', color: colors.text, textAlign: 'center', lineHeight: 15 },
  announceCard: { marginBottom: spacing.md },
  announceHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  announceTitle: { fontSize: 15.5, fontWeight: '700', color: colors.text, marginBottom: 3 },
  listCard: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md, padding: spacing.md },
  inlineEmpty: { flexDirection: 'row', alignItems: 'center' },
  bookingIcon: {
    width: 34, height: 34, borderRadius: 11, backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center', marginRight: spacing.md,
  },
});
