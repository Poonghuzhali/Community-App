import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ScrollView, RefreshControl, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { api } from '../../api/client';
import { Screen, AppHeader, Card, Input, Button, Chip, EmptyState, Loader, Banner, StatusPill } from '../../components/ui';
import { colors, spacing, typography, radius } from '../../theme';
import { todayISO, slotLabel, formatDateTime } from '../../utils/format';

function shiftDate(date, days) {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function AdminAmenitiesScreen() {
  const [amenities, setAmenities] = useState([]);
  const [amenityId, setAmenityId] = useState(null);
  const [date, setDate] = useState(todayISO());
  const [slots, setSlots] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [range, setRange] = useState({ from: todayISO(), to: todayISO(13) });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      if (!amenities.length) {
        const a = await api('/api/bookings/amenities');
        const list = Array.isArray(a) ? a : a.items || a.data || [];
        setAmenities(list);
        if (list.length && !amenityId) setAmenityId(list[0].id);
      }
      const [s, b] = await Promise.all([
        amenityId ? api('/api/bookings/slots', { params: { amenityId, date } }) : Promise.resolve([]),
        api('/api/admin/amenities/bookings', { params: { amenityId: amenityId || undefined, limit: 15 } }),
      ]);
      setSlots(Array.isArray(s) ? s : s.items || []);
      setBookings(b.items || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [amenityId, date, amenities.length]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const generate = async () => {
    if (!amenityId) return;
    setBusy(true);
    try {
      const res = await api(`/api/admin/amenities/${amenityId}/generate-slots`, {
        method: 'POST',
        body: { from: range.from, to: range.to },
      });
      Alert.alert('Slots generated', `${res.created ?? res.count ?? 'New'} slots created for the selected range.`);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const toggleBlock = async (slot) => {
    if (slot.booking_id) {
      Alert.alert('Slot is booked', 'Cancel the booking before blocking this slot.');
      return;
    }
    setBusy(true);
    try {
      await api(`/api/admin/amenities/slots/${slot.id}/block`, {
        method: 'PATCH',
        body: { blocked: !slot.is_blocked, reason: 'Blocked from admin app' },
      });
      load();
    } catch (err) {
      Alert.alert('Could not update slot', err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen scroll>
      <AppHeader title="Amenities & slots" subtitle="Generate slots, block time, audit bookings" />

      <Banner message={error} type="danger" onClose={() => setError(null)} />

      {loading ? (
        <Loader label="Loading amenities…" />
      ) : (
        <>
          {/* ------------------------------------------------ amenity pick */}
          <Text style={styles.label}>Amenity</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
            {amenities.map((a) => (
              <Chip key={a.id} label={a.name} active={amenityId === a.id} onPress={() => setAmenityId(a.id)} style={{ marginRight: 8 }} />
            ))}
          </ScrollView>

          {/* -------------------------------------------------- date nav */}
          <Card>
            <View style={styles.dateRow}>
              <TouchableOpacity style={styles.navBtn} onPress={() => setDate((d) => shiftDate(d, -1))}>
                <Ionicons name="chevron-back" size={18} color={colors.primary} />
              </TouchableOpacity>
              <View style={{ alignItems: 'center', flex: 1 }}>
                <Text style={typography.h3}>{date}</Text>
                <Text style={typography.tiny}>Tap a slot to block or unblock it</Text>
              </View>
              <TouchableOpacity style={styles.navBtn} onPress={() => setDate((d) => shiftDate(d, 1))}>
                <Ionicons name="chevron-forward" size={18} color={colors.primary} />
              </TouchableOpacity>
            </View>

            <View style={styles.legend}>
              <Legend color={colors.success} label="Free" />
              <Legend color={colors.grey} label="Booked" />
              <Legend color={colors.warning} label="Blocked" />
            </View>

            {slots.length === 0 ? (
              <EmptyState
                icon="time-outline"
                title="No slots for this day"
                message="Generate slots for a date range below."
              />
            ) : (
              <View style={styles.grid}>
                {slots.map((s) => {
                  const blocked = Boolean(s.is_blocked);
                  const booked = Boolean(s.booking_id);
                  const bg = blocked ? colors.warningBg : booked ? colors.greyBg : colors.successBg;
                  const fg = blocked ? colors.warningDark || colors.warning : booked ? colors.textMuted : colors.success;
                  return (
                    <TouchableOpacity
                      key={s.id}
                      style={[styles.slot, { backgroundColor: bg }]}
                      onPress={() => toggleBlock(s)}
                      disabled={busy || booked}
                      activeOpacity={0.75}
                    >
                      <Text style={[styles.slotText, { color: fg }]}>{slotLabel(s)}</Text>
                      <Text style={[styles.slotSub, { color: fg }]}>
                        {booked ? 'Booked' : blocked ? 'Blocked' : 'Free'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </Card>

          {/* ------------------------------------------------- generate */}
          <Card style={{ marginTop: spacing.lg }}>
            <Text style={[typography.h3, { marginBottom: spacing.sm }]}>Generate slots</Text>
            <Text style={[typography.small, { marginBottom: spacing.md }]}>
              Creates bookable slots for every day in the range (max 62 days).
            </Text>
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <Input label="From" value={range.from} onChangeText={(t) => setRange((r) => ({ ...r, from: t }))} style={{ flex: 1 }} maxLength={10} />
              <Input label="To" value={range.to} onChangeText={(t) => setRange((r) => ({ ...r, to: t }))} style={{ flex: 1 }} maxLength={10} />
            </View>
            <Button title="Generate slots" icon="flash-outline" onPress={generate} loading={busy} disabled={!amenityId} style={{ marginTop: spacing.sm }} />
          </Card>

          {/* ------------------------------------------------- bookings */}
          <Card style={{ marginTop: spacing.lg }}>
            <Text style={[typography.h3, { marginBottom: spacing.md }]}>Recent bookings</Text>
            {bookings.length === 0 ? (
              <Text style={[typography.small, { color: colors.textMuted }]}>No bookings yet.</Text>
            ) : (
              bookings.map((b) => (
                <View key={b.id} style={styles.bookingRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={typography.small}>{b.user_name || b.full_name || 'Resident'}</Text>
                    <Text style={[typography.tiny, { marginTop: 2 }]}>
                      {b.amenity_name} • {b.slot_date} {b.start_time}–{b.end_time}
                      {b.attendees ? ` • ${b.attendees} pax` : ''}
                    </Text>
                  </View>
                  <StatusPill status={b.status === 'confirmed' ? 'approved' : b.status === 'cancelled' ? 'rejected' : 'pending'} label={b.status?.toUpperCase()} />
                </View>
              ))
            )}
          </Card>
        </>
      )}
    </Screen>
  );
}

function Legend({ color, label }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 14 }}>
      <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: color, marginRight: 5 }} />
      <Text style={typography.tiny}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, fontWeight: '700', color: colors.textMuted, marginBottom: 7, paddingHorizontal: spacing.lg },
  dateRow: { flexDirection: 'row', alignItems: 'center' },
  navBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  legend: { flexDirection: 'row', marginTop: spacing.md, marginBottom: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  slot: { width: '31%', borderRadius: radius.md, paddingVertical: 9, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  slotText: { fontSize: 13, fontWeight: '800' },
  slotSub: { fontSize: 10, marginTop: 1 },
  bookingRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
});
