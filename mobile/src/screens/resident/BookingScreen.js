import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, FlatList, TouchableOpacity, RefreshControl, Alert, Modal } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { api } from '../../api/client';
import { Screen, AppHeader, LogoutButton, HeaderActions, Card, EmptyState, Loader, Button, Banner } from '../../components/ui';
import { colors, spacing, typography, radius, shadow } from '../../theme';
import { todayISO, shortTime, formatDate } from '../../utils/format';


export default function BookingScreen({ navigation }) {
  const [amenities, setAmenities] = useState(null);
  const [selectedAmenity, setSelectedAmenity] = useState(null);
  const [date, setDate] = useState(todayISO());
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const dates = Array.from({ length: 7 }, (_, i) => todayISO(i));

  const loadAmenities = useCallback(async () => {
    try {
      const data = await api('/api/bookings/amenities');
      setAmenities(data);
      if (data.length && !selectedAmenity) setSelectedAmenity(data[0].id);
    } catch (err) {
      setAmenities([]);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedAmenity]);

  const loadSlots = useCallback(async () => {
    if (!selectedAmenity) return;
    try {
      const data = await api('/api/bookings/slots', { params: { amenityId: selectedAmenity, date } });
      setSlots(data);
    } catch (err) {
      setSlots([]);
      setError(err.message);
    } finally {
      setRefreshing(false);
    }
  }, [selectedAmenity, date]);

  useFocusEffect(
    useCallback(() => {
      loadAmenities();
    }, [loadAmenities])
  );

  useEffect(() => {
    loadSlots();
  }, [loadSlots]);

  const book = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      await api('/api/bookings/book', {
        method: 'POST',
        body: { slotId: selected.id, attendees: 1 },
      });
      setSelected(null);
      await loadSlots();
      Alert.alert('Booking confirmed', `${selected.amenity_name} • ${formatDate(selected.slot_date, { withYear: false })} at ${shortTime(selected.start_time)}`);
    } catch (err) {
      Alert.alert('Could not book', err.message);
      await loadSlots();
    } finally {
      setBusy(false);
    }
  };

  const cancelBooking = async (bookingId) => {
    setBusy(true);
    try {
      await api(`/api/bookings/${bookingId}`, { method: 'DELETE' });
      setSelected(null);
      await loadSlots();
    } catch (err) {
      Alert.alert('Could not cancel', err.message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Loader label="Loading amenities…" />;

  const available = slots.filter((s) => s.isAvailable).length;

  return (
    <Screen scroll contentStyle={{ paddingBottom: spacing.xxl * 3 }}>
      <AppHeader
        title="Book an amenity"
        subtitle={`${available} slot${available === 1 ? '' : 's'} free on ${formatDate(date, { withYear: false })}`}
        right={
          <HeaderActions>
            <TouchableOpacity onPress={() => navigation.navigate('BookingHistory')} accessibilityLabel="My bookings">
              <Ionicons name="time-outline" size={24} color={colors.text} />
            </TouchableOpacity>
            <LogoutButton />
          </HeaderActions>
        }
      />

      <Banner message={error} type="danger" onClose={() => setError(null)} />

      {/* amenity selector */}
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={amenities}
        keyExtractor={(a) => String(a.id)}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.md }}
        renderItem={({ item }) => (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => setSelectedAmenity(item.id)}
            style={[styles.amenity, selectedAmenity === item.id && styles.amenityActive]}
          >
            <Ionicons name="grid-outline" size={17} color={selectedAmenity === item.id ? colors.textInverse : colors.primary} />
            <Text style={[styles.amenityText, selectedAmenity === item.id && { color: colors.textInverse }]}>{item.name}</Text>
          </TouchableOpacity>
        )}
      />

      {/* date strip */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
        {dates.map((d) => {
          const active = d === date;
          const day = d.split('-')[2];
          const dt = new Date(`${d}T00:00:00`);
          return (
            <TouchableOpacity key={d} onPress={() => setDate(d)} style={[styles.dateCell, active && styles.dateCellActive]}>
              <Text style={[styles.dateDow, active && { color: colors.primary }]}>
                {dt.toLocaleDateString('en-IN', { weekday: 'short' })}
              </Text>
              <Text style={[styles.dateNum, active && { color: colors.textInverse }]}>{Number(day)}</Text>
              <Text style={[styles.dateMon, active && { color: '#CFE6DD' }]}>
                {dt.toLocaleDateString('en-IN', { month: 'short' })}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* slots */}
      <View style={{ paddingHorizontal: spacing.lg }}>
        {slots.length === 0 ? (
          <EmptyState
            icon="calendar-outline"
            title="No slots for this day"
            message="The admin generates slots for each amenity. Try another date."
          />
        ) : (
          <View style={styles.grid}>
            {slots.map((slot) => {
              const mine = slot.isMine;
              const disabled = !slot.isAvailable && !mine;
              return (
                <TouchableOpacity
                  key={slot.id}
                  disabled={disabled}
                  activeOpacity={0.85}
                  onPress={() => setSelected(slot)}
                  style={[
                    styles.slot,
                    mine && styles.slotMine,
                    disabled && styles.slotDisabled,
                  ]}
                >
                  <Text style={[styles.slotTime, mine && { color: colors.primary }]}>
                    {shortTime(slot.start_time)}
                  </Text>
                  <Text style={[styles.slotSub, mine && { color: colors.primary }]}>
                    {shortTime(slot.end_time)}
                  </Text>
                  <Text style={[styles.slotState, mine && { color: colors.primary }]}>
                    {mine ? 'Yours' : slot.is_blocked ? 'Blocked' : slot.isAvailable ? 'Free' : 'Booked'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>

      {/* booking sheet */}
      <Modal visible={Boolean(selected)} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
        <View style={styles.sheetWrap}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={typography.h2}>{selected?.amenity_name}</Text>
            <Text style={[typography.small, { marginTop: 4 }]}>
              {formatDate(selected?.slot_date)} • {shortTime(selected?.start_time)} – {shortTime(selected?.end_time)}
            </Text>

            <Card style={{ marginTop: spacing.lg, backgroundColor: colors.bg }}>
              <Row icon="location-outline" text={selected?.amenity_location || 'Community clubhouse'} />
              <Row icon="hourglass-outline" text={`${slots.find((s) => s.id === selected?.id) ? '60 min slot' : 'Reserved for you'}`} />
              {selected?.booked_by_name && !selected?.isMine ? (
                <Row icon="person-outline" text={`Booked by ${selected.booked_by_name}`} />
              ) : null}
            </Card>

            <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg }}>
              {selected?.isMine ? (
                <Button title="Cancel booking" variant="danger" onPress={() => cancelBooking(selected.booking_id)} loading={busy} style={{ flex: 1 }} />
              ) : (
                <>
                  <Button title="Close" variant="outline" onPress={() => setSelected(null)} style={{ flex: 1 }} />
                  <Button title="Confirm booking" onPress={book} loading={busy} disabled={!selected?.isAvailable} style={{ flex: 1.4 }} />
                </>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

function Row({ icon, text }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 5 }}>
      <Ionicons name={icon} size={15} color={colors.textMuted} />
      <Text style={[typography.small, { marginLeft: 7 }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  amenity: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill,
    paddingHorizontal: spacing.lg, paddingVertical: 10, marginRight: spacing.sm,
  },
  amenityActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  amenityText: { marginLeft: 7, fontWeight: '700', fontSize: 13.5, color: colors.text },
  dateCell: {
    width: 58, alignItems: 'center', paddingVertical: spacing.md,
    backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1,
    borderColor: colors.border, marginRight: spacing.sm,
  },
  dateCellActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  dateDow: { fontSize: 11, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase' },
  dateNum: { fontSize: 19, fontWeight: '800', color: colors.text, marginVertical: 1 },
  dateMon: { fontSize: 10.5, color: colors.textMuted },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  slot: {
    width: '31.5%', backgroundColor: colors.card, borderRadius: radius.md,
    borderWidth: 1.5, borderColor: colors.border, paddingVertical: spacing.md,
    alignItems: 'center', marginBottom: spacing.md, ...shadow.card,
  },
  slotMine: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  slotDisabled: { opacity: 0.45, backgroundColor: colors.greyBg },
  slotTime: { fontSize: 15, fontWeight: '800', color: colors.text },
  slotSub: { fontSize: 11, color: colors.textMuted, marginTop: 1 },
  slotState: { fontSize: 10.5, fontWeight: '700', color: colors.textMuted, marginTop: 6, textTransform: 'uppercase' },
  sheetWrap: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.card, borderTopLeftRadius: 26, borderTopRightRadius: 26,
    padding: spacing.xl, paddingBottom: spacing.xxl,
  },
  sheetHandle: {
    width: 44, height: 5, borderRadius: 3, backgroundColor: colors.border,
    alignSelf: 'center', marginBottom: spacing.lg,
  },
});
