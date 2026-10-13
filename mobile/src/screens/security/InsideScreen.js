import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity, Modal, ScrollView, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '../../context/AuthContext';
import { api } from '../../api/client';
import { Screen, AppHeader, LogoutButton, HeaderActions, Card, Input, Button, EmptyState, Loader, Banner, StatusPill, Chip } from '../../components/ui';
import { colors, spacing, typography, radius } from '../../theme';
import { relativeTime, maskPhone } from '../../utils/format';

export default function InsideScreen() {
  const { user } = useAuth();
  const [inside, setInside] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const [modal, setModal] = useState(false);
  const [passType, setPassType] = useState('walkin');
  const [form, setForm] = useState({ visitorName: '', visitorPhone: '', purpose: 'Guest', vehicleNumber: '', deliveryVendor: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [data, s] = await Promise.all([
        api('/api/security/inside'),
        api('/api/security/stats').catch(() => null),
      ]);
      setInside(Array.isArray(data) ? data : data.items || []);
      if (s) setStats(s);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const recordExit = async (pass) => {
    Alert.alert('Record exit', `${pass.visitor_name} is leaving now?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Confirm exit',
        onPress: async () => {
          try {
            await api(`/api/security/exit/${pass.id}`, { method: 'POST', body: { remarks: 'Recorded from Inside list' } });
            load();
          } catch (err) {
            setError(err.message);
          }
        },
      },
    ]);
  };

  const submit = async () => {
    if (form.visitorName.trim().length < 2) {
      Alert.alert('Name required', 'Enter the visitor name.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api('/api/visitors', {
        method: 'POST',
        body: {
          visitorName: form.visitorName.trim(),
          visitorPhone: form.visitorPhone || undefined,
          visitorCount: 1,
          purpose: passType === 'delivery' ? 'Delivery' : form.purpose || 'Guest',
          vehicleNumber: form.vehicleNumber || undefined,
          passType,
          deliveryVendor: passType === 'delivery' ? form.deliveryVendor || undefined : undefined,
        },
      });
      setModal(false);
      setForm({ visitorName: '', visitorPhone: '', purpose: 'Guest', vehicleNumber: '', deliveryVendor: '' });
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen contentStyle={{ paddingHorizontal: 0, paddingTop: 0 }}>
      <AppHeader
        title="Currently inside"
        subtitle={stats ? `${stats.currentlyInside} people • ${stats.todayEntries} entries today` : 'Live occupancy'}
        right={
          <HeaderActions>
            <TouchableOpacity onPress={() => setModal(true)} style={styles.addBtn}>
              <Ionicons name="add" size={18} color={colors.textInverse} />
              <Text style={styles.addText}>Log</Text>
            </TouchableOpacity>
            <LogoutButton />
          </HeaderActions>
        }
      />

      <Banner message={error} type="danger" onClose={() => setError(null)} />

      {stats ? (
        <View style={styles.statRow}>
          <Stat label="Inside now" value={stats.currentlyInside} color={colors.success} />
          <Stat label="Today's entries" value={stats.todayEntries} color={colors.primary} />
          <Stat label="Passes (30d)" value={(stats.byStatus || []).reduce((sum, s) => sum + (s.count || 0), 0)} color={colors.info} />
        </View>
      ) : null}

      {loading ? (
        <Loader label="Loading…" />
      ) : (
        <FlatList
          data={inside}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ padding: spacing.lg, paddingTop: 0 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
          ListEmptyComponent={
            <EmptyState icon="people-outline" title="Nobody inside" message="Visitors appear here the moment they are entered at the gate." />
          }
          renderItem={({ item }) => (
            <Card style={styles.card}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={typography.body}>{item.visitor_name}</Text>
                  <View style={[styles.typeDot, item.pass_type === 'delivery' && { backgroundColor: colors.warning }]} />
                </View>
                <Text style={[typography.tiny, { marginTop: 3 }]}>
                  {item.host_flat} • {item.host_name} • {maskPhone(item.visitor_phone)}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
                  <StatusPill status={item.status} />
                  <Text style={[typography.tiny, { marginLeft: 8 }]}>in {relativeTime(item.entry_at)}</Text>
                </View>
              </View>
              <TouchableOpacity style={styles.exitBtn} onPress={() => recordExit(item)}>
                <Ionicons name="log-out-outline" size={17} color={colors.danger} />
                <Text style={styles.exitText}>Exit</Text>
              </TouchableOpacity>
            </Card>
          )}
        />
      )}

      {/* -------------------------------------------------- walk-in modal */}
      <Modal visible={modal} transparent animationType="slide" onRequestClose={() => setModal(false)}>
        <View style={styles.modalWrap}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <View style={styles.modalCard}>
              <Text style={[typography.h3, { marginBottom: spacing.md }]}>Log a visitor at the gate</Text>

              <View style={styles.chips}>
                <Chip label="Walk-in guest" active={passType === 'walkin'} onPress={() => setPassType('walkin')} style={{ marginRight: 8, marginBottom: 8 }} />
                <Chip label="Delivery" active={passType === 'delivery'} onPress={() => setPassType('delivery')} style={{ marginRight: 8, marginBottom: 8 }} />
              </View>

              <Input label="Visitor name" placeholder="Full name" value={form.visitorName} onChangeText={(t) => set('visitorName', t)} />
              <Input
                label="Mobile (optional)"
                placeholder="10 digit number"
                keyboardType="phone-pad"
                maxLength={10}
                value={form.visitorPhone}
                onChangeText={(t) => set('visitorPhone', t.replace(/\D/g, ''))}
              />
              {passType === 'delivery' ? (
                <Input label="Vendor / app" placeholder="Swiggy, Amazon, BlueDart…" value={form.deliveryVendor} onChangeText={(t) => set('deliveryVendor', t)} />
              ) : (
                <Input label="Purpose" placeholder="Guest, maid, plumber…" value={form.purpose} onChangeText={(t) => set('purpose', t)} />
              )}
              <Input label="Vehicle number (optional)" placeholder="MH 12 AB 1234" value={form.vehicleNumber} onChangeText={(t) => set('vehicleNumber', t.toUpperCase())} />

              <Text style={[typography.small, { marginBottom: spacing.md }]}>
                Walk-ins are checked in immediately and the host flat gets a notification.
              </Text>

              <View style={{ flexDirection: 'row', gap: spacing.md }}>
                <Button title="Cancel" variant="outline" onPress={() => setModal(false)} style={{ flex: 1 }} />
                <Button title="Record entry" onPress={submit} loading={saving} style={{ flex: 1.4 }} />
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </Screen>
  );
}

function Stat({ label, value, color }) {
  return (
    <View style={[styles.stat, { backgroundColor: color + '14' }]}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  addBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.pill },
  addText: { color: colors.textInverse, fontWeight: '700', fontSize: 13, marginLeft: 3 },
  statRow: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  stat: { flex: 1, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center' },
  statValue: { fontSize: 19, fontWeight: '800' },
  statLabel: { fontSize: 10.5, color: colors.textMuted, marginTop: 2, textAlign: 'center' },
  card: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm, padding: spacing.md },
  typeDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.primary, marginLeft: 7 },
  exitBtn: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.dangerBg, paddingHorizontal: 12, paddingVertical: 9, borderRadius: radius.md, minWidth: 66 },
  exitText: { fontSize: 11.5, fontWeight: '700', color: colors.danger, marginTop: 2 },
  modalWrap: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: colors.card, borderTopLeftRadius: 22, borderTopRightRadius: 22,
    padding: spacing.xl, paddingBottom: spacing.xxl * 1.6, maxHeight: '90%',
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.sm },
});
