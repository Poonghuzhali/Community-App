import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, ScrollView, Alert, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { api } from '../../api/client';
import { Screen, AppHeader, LogoutButton, HeaderActions, SearchBar, Card, Avatar, StatusPill, EmptyState, Loader, Banner, Input, Button, Chip, ListRow } from '../../components/ui';
import { colors, spacing, typography, radius } from '../../theme';
import { maskPhone } from '../../utils/format';

const ROLE_FILTERS = [
  { key: '', label: 'All' },
  { key: 'resident', label: 'Residents' },
  { key: 'security', label: 'Security' },
  { key: 'admin', label: 'Admins' },
];

const emptyForm = { phone: '', full_name: '', email: '', role: 'resident', flat_id: '' };

export default function AdminResidentsScreen({ navigation }) {
  const [items, setItems] = useState([]);
  const [flats, setFlats] = useState([]);
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const [modal, setModal] = useState(null); // 'create' | resident object
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [data, flatData] = await Promise.all([
        api('/api/admin/residents', { params: { q: q || undefined, role: role || undefined, limit: 100 } }),
        api('/api/admin/flats').catch(() => []),
      ]);
      setItems(data.items || data || []);
      setFlats(Array.isArray(flatData) ? flatData : flatData.items || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [q, role]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    const t = setTimeout(() => { if (q || role) load(); }, 350);
    return () => clearTimeout(t);
  }, [q, role]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const openCreate = () => { setForm(emptyForm); setFormError(null); setModal('create'); };

  const openEdit = (r) => {
    setFormError(null);
    setForm({
      phone: r.phone || '',
      full_name: r.fullName || r.full_name || '',
      email: r.email || '',
      role: r.role || 'resident',
      flat_id: r.flatId || r.flat_id ? String(r.flatId || r.flat_id) : '',
    });
    setModal(r);
  };

  const submit = async () => {
    setFormError(null);
    const creating = modal === 'create';
    if (creating && form.phone.replace(/\D/g, '').slice(-10).length !== 10) {
      setFormError('Enter a valid 10 digit mobile number');
      return;
    }
    if (!creating && form.full_name.trim().length < 3) {
      setFormError('Name is too short');
      return;
    }
    setSaving(true);
    try {
      if (creating) {
        await api('/api/admin/residents', {
          method: 'POST',
          body: {
            phone: form.phone.replace(/\D/g, '').slice(-10),
            full_name: form.full_name.trim() || undefined,
            email: form.email.trim() || undefined,
            role: form.role,
            flat_id: form.flat_id || undefined,
          },
        });
      } else {
        await api(`/api/admin/residents/${modal.id}`, {
          method: 'PATCH',
          body: {
            full_name: form.full_name.trim(),
            email: form.email.trim() || undefined,
            role: form.role,
            flat_id: form.flat_id || undefined,
            clear_flat: !form.flat_id,
          },
        });
      }
      setModal(null);
      load();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (r) => {
    try {
      await api(`/api/admin/residents/${r.id}`, { method: 'PATCH', body: { is_active: !(r.isActive ?? r.is_active) } });
      load();
    } catch (err) {
      Alert.alert('Update failed', err.message);
    }
  };

  const flatLabel = (id) => {
    if (!id) return 'No flat';
    const f = flats.find((x) => String(x.id) === String(id));
    if (!f) return `Flat ${id}`;
    return f.label || (f.block && f.flat_number ? `${f.block}-${f.flat_number}` : `Flat ${f.id}`);
  };

  return (
    <Screen contentStyle={{ paddingHorizontal: 0, paddingTop: 0 }}>
      <AppHeader
        title="Residents"
        subtitle={`${items.length} people on record`}
        onBack={() => navigation.navigate('Dashboard')}
        right={
          <HeaderActions>
            <TouchableOpacity onPress={openCreate} style={styles.addBtn}>
              <Ionicons name="person-add" size={16} color={colors.textInverse} />
              <Text style={styles.addText}>Add</Text>
            </TouchableOpacity>
            <LogoutButton />
          </HeaderActions>
        }
      />

      <View style={{ paddingHorizontal: spacing.lg }}>
        <SearchBar value={q} onChangeText={setQ} placeholder="Search name, phone or flat…" />
      </View>

      <View style={styles.filters}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={ROLE_FILTERS}
          keyExtractor={(r) => r.key || 'all'}
          renderItem={({ item }) => <Chip label={item.label} active={role === item.key} onPress={() => setRole(item.key)} />}
        />
      </View>

      <Banner message={error} type="danger" onClose={() => setError(null)} />

      {loading ? (
        <Loader label="Loading residents…" />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ padding: spacing.lg, paddingTop: 0 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
          ListEmptyComponent={<EmptyState icon="people-outline" title="No residents" message="Add a resident or change your search filters." />}
          renderItem={({ item }) => {
            const active = item.isActive ?? item.is_active;
            const name = item.fullName || item.full_name || 'Unnamed';
            return (
              <Card style={styles.card}>
                <TouchableOpacity style={{ flex: 1 }} onPress={() => openEdit(item)} activeOpacity={0.7}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Avatar name={name} size={42} />
                    <View style={{ marginLeft: spacing.md, flex: 1 }}>
                      <Text style={typography.body}>{name}</Text>
                      <Text style={[typography.tiny, { marginTop: 2 }]}>
                        {maskPhone(item.phone)} • {item.flat_label || flatLabel(item.flat_id)}
                      </Text>
                    </View>
                    <StatusPill
                      status={active ? 'approved' : 'rejected'}
                      label={active ? (item.role || 'resident').toUpperCase() : 'INACTIVE'}
                    />
                  </View>
                </TouchableOpacity>
                <TouchableOpacity style={styles.activeToggle} onPress={() => toggleActive(item)}>
                  <Ionicons name={active ? 'toggle' : 'toggle-outline'} size={26} color={active ? colors.success : colors.grey} />
                </TouchableOpacity>
              </Card>
            );
          }}
        />
      )}

      {/* --------------------------------------------------------- modal */}
      <Modal visible={!!modal} transparent animationType="fade" onRequestClose={() => setModal(null)}>
        <View style={styles.modalWrap}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <View style={styles.modalCard}>
              <Text style={[typography.h3, { marginBottom: spacing.md }]}>
                {modal === 'create' ? 'Add a resident' : 'Edit resident'}
              </Text>
              <Banner message={formError} type="danger" onClose={() => setFormError(null)} />

              {modal === 'create' ? (
                <Input label="Mobile number" placeholder="10 digit number" keyboardType="phone-pad" maxLength={10}
                  value={form.phone} onChangeText={(t) => set('phone', t.replace(/\D/g, ''))} />
              ) : null}

              <Input label="Full name" placeholder="Full name" value={form.full_name} onChangeText={(t) => set('full_name', t)} maxLength={120} />
              <Input label="Email (optional)" placeholder="name@example.com" keyboardType="email-address" autoCapitalize="none"
                value={form.email} onChangeText={(t) => set('email', t)} maxLength={160} />

              <Text style={styles.label}>Role</Text>
              <View style={styles.chips}>
                {['resident', 'security', 'admin'].map((r) => (
                  <Chip key={r} label={r} active={form.role === r} onPress={() => set('role', r)} style={{ marginRight: 8, marginBottom: 8 }} />
                ))}
              </View>

              <Text style={styles.label}>Flat</Text>
              <View style={styles.chips}>
                <Chip label="Unassigned" active={!form.flat_id} onPress={() => set('flat_id', '')} style={{ marginRight: 8, marginBottom: 8 }} />
                {flats.map((f) => (
                  <Chip
                    key={f.id}
                    label={flatLabel(f.id)}
                    active={String(form.flat_id) === String(f.id)}
                    onPress={() => set('flat_id', String(f.id))}
                    style={{ marginRight: 8, marginBottom: 8 }}
                  />
                ))}
              </View>

              <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm }}>
                <Button title="Cancel" variant="outline" onPress={() => setModal(null)} style={{ flex: 1 }} />
                <Button title={modal === 'create' ? 'Create' : 'Save'} onPress={submit} loading={saving} style={{ flex: 1.3 }} />
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  addBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.pill },
  addText: { color: colors.textInverse, fontWeight: '700', fontSize: 13, marginLeft: 4 },
  filters: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  card: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm, padding: spacing.md },
  activeToggle: { paddingLeft: spacing.sm },
  modalWrap: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', padding: spacing.lg },
  modalCard: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.xl, maxHeight: '88%' },
  label: { fontSize: 13, fontWeight: '700', color: colors.textMuted, marginBottom: 7, letterSpacing: 0.2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.sm },
});
