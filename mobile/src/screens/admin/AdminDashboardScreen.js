import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '../../context/AuthContext';
import { api } from '../../api/client';
import { Screen, AppHeader, LogoutButton, Card, StatCard, Loader, Banner } from '../../components/ui';
import { colors, spacing, typography, radius } from '../../theme';
import { formatDateTime } from '../../utils/format';

export default function AdminDashboardScreen({ navigation }) {
  const { user } = useAuth();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setReport(await api('/api/admin/reports'));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const o = report?.overview || {};
  const complaints = report?.complaints;
  const bookings = report?.bookings;
  const events = report?.events;

  return (
    <Screen scroll>
      <AppHeader
        title={`Hi, ${user?.name?.split(' ')[0] || 'Admin'}`}
        subtitle="Community overview"
        right={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <TouchableOpacity onPress={() => { setRefreshing(true); load(); }}>
              <Ionicons name="refresh" size={20} color={refreshing ? colors.primary : colors.text} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate('Notifications')}>
              <Ionicons name="notifications-outline" size={23} color={colors.text} />
            </TouchableOpacity>
            <LogoutButton />
          </View>
        }
      />

      <Banner message={error} type="danger" onClose={() => setError(null)} />

      {loading ? (
        <Loader label="Crunching numbers…" />
      ) : (
        <>
          <View style={styles.grid}>
            <StatCard label="Residents" value={o.residents} icon="people" color={colors.primary} onPress={() => navigation.navigate('Residents')} style={styles.gridItem} />
            <StatCard label="Open complaints" value={o.complaintsOpen} icon="alert-circle" color={colors.warning} onPress={() => navigation.navigate('AdminComplaints')} style={styles.gridItem} />
            <StatCard label="Visitors inside" value={o.visitorsInside} icon="walk" color={colors.success} onPress={() => navigation.navigate('AdminVisitors')} style={styles.gridItem} />
            <StatCard label="Entries today" value={o.visitorEntriesToday} icon="log-in" color={colors.info} onPress={() => navigation.navigate('AdminVisitors')} style={styles.gridItem} />
            <StatCard label="Upcoming bookings" value={o.bookingsUpcoming} icon="calendar" color={colors.accentDark} onPress={() => navigation.navigate('AdminAmenities')} style={styles.gridItem} />
            <StatCard label="Pending listings" value={o.listingsPending} icon="pricetags" color={colors.primary} onPress={() => navigation.navigate('AdminMarket')} style={styles.gridItem} />
            <StatCard label="Announcements" value={o.announcements} icon="megaphone" color={colors.grey} onPress={() => navigation.navigate('AdminContent')} style={styles.gridItem} />
            <StatCard label="Upcoming events" value={o.eventsUpcoming} icon="sparkles" color={colors.accentDark} onPress={() => navigation.navigate('AdminContent')} style={styles.gridItem} />
          </View>

          <Card style={{ marginTop: spacing.lg }}>
            <Text style={[typography.h3, { marginBottom: spacing.md }]}>Complaint health</Text>
            <Row label="Avg resolution time" value={`${complaints?.avgResolutionHours ?? 0} h`} />
            <Bar rows={complaints?.byStatus || []} colorMap={{ open: colors.danger, in_progress: colors.warning, resolved: colors.success }} />
          </Card>

          <Card style={{ marginTop: spacing.lg }}>
            <Text style={[typography.h3, { marginBottom: spacing.md }]}>Busiest amenities</Text>
            <Bar rows={(bookings?.byAmenity || []).slice(0, 5).map((b) => ({ status: b.name, count: b.bookings }))} color={colors.primary} />
            <Row label="Bookings today" value={String(bookings?.today ?? 0)} />
            <Row label="Event registrations" value={String(events?.registrations ?? 0)} />
          </Card>

          <View style={styles.quickRow}>
            <Quick icon="megaphone-outline" label="Post notice" onPress={() => navigation.navigate('AdminContent')} />
            <Quick icon="business-outline" label="Amenities" onPress={() => navigation.navigate('AdminAmenities')} />
            <Quick icon="people-circle-outline" label="Residents" onPress={() => navigation.navigate('Residents')} />
            <Quick icon="scan-outline" label="Visitors" onPress={() => navigation.navigate('AdminVisitors')} />
          </View>

          <Text style={styles.stamp}>Generated {formatDateTime(report?.generatedAt)}</Text>
        </>
      )}
    </Screen>
  );
}

function Row({ label, value }) {
  return (
    <View style={styles.row}>
      <Text style={[typography.small, { color: colors.textMuted }]}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function Bar({ rows, colorMap = {}, color = colors.primary }) {
  const max = Math.max(1, ...rows.map((r) => Number(r.count) || 0));
  if (!rows.length) return <Text style={[typography.small, { color: colors.textMuted }]}>No data yet.</Text>;
  return (
    <View>
      {rows.map((r) => (
        <View key={r.status} style={{ marginBottom: spacing.sm }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
            <Text style={[typography.small, { textTransform: 'capitalize' }]}>{String(r.status).replace(/_/g, ' ')}</Text>
            <Text style={[typography.small, { fontWeight: '700' }]}>{r.count}</Text>
          </View>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${(Number(r.count) / max) * 100}%`, backgroundColor: colorMap[r.status] || color }]} />
          </View>
        </View>
      ))}
    </View>
  );
}

function Quick({ icon, label, onPress }) {
  return (
    <TouchableOpacity style={styles.quick} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.quickIcon}>
        <Ionicons name={icon} size={19} color={colors.primary} />
      </View>
      <Text style={styles.quickLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  gridItem: { width: '48.5%' },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  rowValue: { fontSize: 14, fontWeight: '700', color: colors.text },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.greyBg, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
  quickRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.lg },
  quick: { alignItems: 'center', width: '23%' },
  quickIcon: {
    width: 52, height: 52, borderRadius: 18, backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center', marginBottom: 6,
  },
  quickLabel: { fontSize: 11.5, color: colors.textMuted, fontWeight: '600', textAlign: 'center' },
  stamp: { fontSize: 11, color: colors.grey, textAlign: 'center', marginTop: spacing.lg },
});
