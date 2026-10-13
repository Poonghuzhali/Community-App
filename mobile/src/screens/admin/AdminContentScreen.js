import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, ScrollView, Alert, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { api } from '../../api/client';
import { Screen, AppHeader, Card, Input, Button, Chip, EmptyState, Loader, Banner, StatusPill, IconButton } from '../../components/ui';
import { colors, spacing, typography, radius } from '../../theme';
import { formatDateTime, relativeTime, todayISO } from '../../utils/format';

const NOTICE_CATEGORIES = ['general', 'maintenance', 'security', 'event', 'emergency'];
const EVENT_STATUSES = ['draft', 'published', 'cancelled', 'completed'];

export default function AdminContentScreen({ navigation }) {
  const [tab, setTab] = useState('notices');
  const [notices, setNotices] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const [noticeModal, setNoticeModal] = useState(false);
  const [eventModal, setEventModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);

  const [notice, setNotice] = useState({ title: '', body: '', category: 'general', is_pinned: false, audience: 'all' });
  const [event, setEvent] = useState({ title: '', description: '', venue: '', date: todayISO(7), time: '18:00', endDate: '', endTime: '', capacity: '' });

  const load = useCallback(async () => {
    try {
      setError(null);
      const [a, e] = await Promise.all([
        api('/api/announcements', { params: { limit: 100 } }),
        api('/api/events', { params: { upcoming: 'false', limit: 100 } }),
      ]);
      setNotices(a.items || []);
      setEvents(e.items || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const setN = (k, v) => setNotice((n) => ({ ...n, [k]: v }));
  const setE = (k, v) => setEvent((e) => ({ ...e, [k]: v }));

  /* ------------------------------------------------------------ notices */
  const saveNotice = async () => {
    setFormError(null);
    if (notice.title.trim().length < 4) return setFormError('Title is too short');
    if (notice.body.trim().length < 5) return setFormError('Message is too short');
    setSaving(true);
    try {
      await api('/api/announcements/admin', {
        method: 'POST',
        body: {
          title: notice.title.trim(),
          body: notice.body.trim(),
          category: notice.category,
          is_pinned: notice.is_pinned,
          audience: notice.audience,
        },
      });
      setNoticeModal(false);
      setNotice({ title: '', body: '', category: 'general', is_pinned: false, audience: 'all' });
      load();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteNotice = (item) => {
    Alert.alert('Delete announcement?', `"${item.title}" will be removed for everyone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api(`/api/announcements/admin/${item.id}`, { method: 'DELETE' });
            load();
          } catch (err) {
            setError(err.message);
          }
        },
      },
    ]);
  };

  const pinNotice = async (item) => {
    try {
      await api(`/api/announcements/admin/${item.id}`, {
        method: 'PATCH',
        body: { title: item.title, body: item.body, category: item.category, is_pinned: !item.is_pinned, audience: item.audience || 'all' },
      });
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  /* -------------------------------------------------------------- events */
  const iso = (date, time) => (date && time ? new Date(`${date}T${time}`).toISOString() : undefined);

  const saveEvent = async () => {
    setFormError(null);
    if (event.title.trim().length < 4) return setFormError('Title is too short');
    const starts_at = iso(event.date, event.time);
    if (!starts_at || Number.isNaN(Date.parse(starts_at))) return setFormError('Enter a valid date and time');
    setSaving(true);
    try {
      await api('/api/events/admin', {
        method: 'POST',
        body: {
          title: event.title.trim(),
          description: event.description.trim() || undefined,
          venue: event.venue.trim() || undefined,
          starts_at,
          ends_at: iso(event.endDate, event.endTime),
          capacity: event.capacity ? Number(event.capacity) : undefined,
        },
      });
      setEventModal(false);
      setEvent({ title: '', description: '', venue: '', date: todayISO(7), time: '18:00', endDate: '', endTime: '', capacity: '' });
      load();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const setEventStatus = (item, status) => {
    Alert.alert('Update event', `Move "${item.title}" to ${status}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Confirm',
        onPress: async () => {
          try {
            await api(`/api/events/admin/${item.id}/status`, { method: 'PATCH', body: { status } });
            load();
          } catch (err) {
            setError(err.message);
          }
        },
      },
    ]);
  };

  return (
    <Screen contentStyle={{ paddingHorizontal: 0, paddingTop: 0 }}>
      <AppHeader
        title="Content"
        subtitle="Announcements and community events"
        right={
          <TouchableOpacity
            onPress={() => (tab === 'notices' ? setNoticeModal(true) : setEventModal(true))}
            style={styles.addBtn}
          >
            <Ionicons name="add" size={18} color={colors.textInverse} />
            <Text style={styles.addText}>New</Text>
          </TouchableOpacity>
        }
      />

      <View style={styles.tabs}>
        {[
          { key: 'notices', label: `Notices (${notices.length})` },
          { key: 'events', label: `Events (${events.length})` },
        ].map((t) => (
          <TouchableOpacity key={t.key} style={[styles.tab, tab === t.key && styles.tabActive]} onPress={() => setTab(t.key)}>
            <Text style={[styles.tabText, tab === t.key && { color: colors.textInverse }]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Banner message={error} type="danger" onClose={() => setError(null)} />

      {loading ? (
        <Loader label="Loading content…" />
      ) : tab === 'notices' ? (
        <FlatList
          data={notices}
          keyExtractor={(n) => n.id}
          contentContainerStyle={{ padding: spacing.lg, paddingTop: 0 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
          ListEmptyComponent={<EmptyState icon="megaphone-outline" title="No announcements" message="Post your first notice to the community." />}
          renderItem={({ item }) => (
            <Card style={styles.card}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                <View style={styles.catPill}>
                  <Text style={styles.catText}>{(item.category || 'GENERAL').toUpperCase()}</Text>
                </View>
                {item.is_pinned ? <Ionicons name="pin" size={15} color={colors.accentDark} style={{ marginLeft: 7 }} /> : null}
                <Text style={[typography.tiny, { marginLeft: 'auto' }]}>{relativeTime(item.published_at)}</Text>
              </View>
              <Text style={typography.body} numberOfLines={2}>{item.title}</Text>
              <Text style={[typography.small, { marginTop: 3, color: colors.textMuted }]} numberOfLines={2}>{item.body}</Text>
              <View style={styles.cardActions}>
                <IconButton name={item.is_pinned ? 'pin' : 'pin-outline'} onPress={() => pinNotice(item)} size={17} />
                <IconButton name="trash-outline" onPress={() => deleteNotice(item)} color={colors.danger} size={17} />
              </View>
            </Card>
          )}
        />
      ) : (
        <FlatList
          data={events}
          keyExtractor={(e) => e.id}
          contentContainerStyle={{ padding: spacing.lg, paddingTop: 0 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
          ListEmptyComponent={<EmptyState icon="calendar-outline" title="No events" message="Create a community event to start registrations." />}
          renderItem={({ item }) => (
            <Card style={styles.card}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ flex: 1 }}>
                  <Text style={typography.body} numberOfLines={1}>{item.title}</Text>
                  <Text style={[typography.tiny, { marginTop: 3 }]}>
                    {formatDateTime(item.starts_at)} • {item.venue || 'Venue TBA'}
                  </Text>
                  <Text style={[typography.tiny, { marginTop: 2, color: colors.textMuted }]}>
                    {item.registered_count} registered{item.capacity ? ` / ${item.capacity}` : ''}
                  </Text>
                </View>
                <StatusPill status={item.status === 'published' ? 'approved' : item.status === 'cancelled' ? 'rejected' : 'pending'} label={item.status?.toUpperCase()} />
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: spacing.md }}>
                {EVENT_STATUSES.filter((s) => s !== item.status).map((s) => (
                  <Chip key={s} label={s.replace('_', ' ')} onPress={() => setEventStatus(item, s)} style={{ marginRight: 8 }} />
                ))}
              </ScrollView>
            </Card>
          )}
        />
      )}

      {/* --------------------------------------------------- notice modal */}
      <Modal visible={noticeModal} transparent animationType="fade" onRequestClose={() => setNoticeModal(false)}>
        <View style={styles.modalWrap}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <View style={styles.modalCard}>
              <Text style={[typography.h3, { marginBottom: spacing.md }]}>New announcement</Text>
              <Banner message={formError} type="danger" onClose={() => setFormError(null)} />
              <Input label="Title" value={notice.title} onChangeText={(t) => setN('title', t)} placeholder="Water supply cut tomorrow" maxLength={160} />
              <Input label="Message" value={notice.body} onChangeText={(t) => setN('body', t)} placeholder="Details, timings, who to contact…" multiline maxLength={5000} />
              <Text style={styles.label}>Category</Text>
              <View style={styles.chips}>
                {NOTICE_CATEGORIES.map((c) => (
                  <Chip key={c} label={c} active={notice.category === c} onPress={() => setN('category', c)} style={{ marginRight: 8, marginBottom: 8 }} />
                ))}
              </View>
              <Text style={styles.label}>Audience</Text>
              <View style={styles.chips}>
                {['all', 'resident', 'security', 'admin'].map((a) => (
                  <Chip key={a} label={a} active={notice.audience === a} onPress={() => setN('audience', a)} style={{ marginRight: 8, marginBottom: 8 }} />
                ))}
              </View>
              <View style={styles.switchRow}>
                <Text style={[typography.small, { flex: 1 }]}>Pin to the top of everyone's feed</Text>
                <Chip label={notice.is_pinned ? 'Pinned' : 'Not pinned'} active={notice.is_pinned} onPress={() => setN('is_pinned', !notice.is_pinned)} />
              </View>
              <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg }}>
                <Button title="Cancel" variant="outline" onPress={() => setNoticeModal(false)} style={{ flex: 1 }} />
                <Button title="Publish" onPress={saveNotice} loading={saving} style={{ flex: 1.3 }} />
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* ---------------------------------------------------- event modal */}
      <Modal visible={eventModal} transparent animationType="fade" onRequestClose={() => setEventModal(false)}>
        <View style={styles.modalWrap}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <View style={styles.modalCard}>
              <Text style={[typography.h3, { marginBottom: spacing.md }]}>New event</Text>
              <Banner message={formError} type="danger" onClose={() => setFormError(null)} />
              <Input label="Title" value={event.title} onChangeText={(t) => setE('title', t)} placeholder="Diwali cultural night" maxLength={160} />
              <Input label="Description" value={event.description} onChangeText={(t) => setE('description', t)} placeholder="What is it about?" multiline maxLength={4000} />
              <Input label="Venue" value={event.venue} onChangeText={(t) => setE('venue', t)} placeholder="Clubhouse lawn" maxLength={140} />
              <View style={{ flexDirection: 'row', gap: spacing.md }}>
                <Input label="Date" value={event.date} onChangeText={(t) => setE('date', t)} placeholder="YYYY-MM-DD" style={{ flex: 1.3 }} maxLength={10} />
                <Input label="Time" value={event.time} onChangeText={(t) => setE('time', t)} placeholder="HH:MM" style={{ flex: 1 }} maxLength={5} />
              </View>
              <Text style={styles.label}>End (optional)</Text>
              <View style={{ flexDirection: 'row', gap: spacing.md }}>
                <Input label="" value={event.endDate} onChangeText={(t) => setE('endDate', t)} placeholder="YYYY-MM-DD" style={{ flex: 1.3 }} maxLength={10} />
                <Input label="" value={event.endTime} onChangeText={(t) => setE('endTime', t)} placeholder="HH:MM" style={{ flex: 1 }} maxLength={5} />
              </View>
              <Input label="Capacity (optional)" value={event.capacity} onChangeText={(t) => setE('capacity', t.replace(/\D/g, ''))} keyboardType="numeric" placeholder="100" maxLength={5} />
              <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm }}>
                <Button title="Cancel" variant="outline" onPress={() => setEventModal(false)} style={{ flex: 1 }} />
                <Button title="Create" onPress={saveEvent} loading={saving} style={{ flex: 1.3 }} />
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
  addText: { color: colors.textInverse, fontWeight: '700', fontSize: 13, marginLeft: 3 },
  tabs: { flexDirection: 'row', paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  tab: { flex: 1, paddingVertical: 10, borderRadius: radius.pill, alignItems: 'center', backgroundColor: colors.greyBg, marginRight: spacing.sm },
  tabActive: { backgroundColor: colors.primary },
  tabText: { fontSize: 13, fontWeight: '700', color: colors.textMuted },
  card: { marginBottom: spacing.md },
  catPill: { backgroundColor: colors.primaryLight, paddingHorizontal: 9, paddingVertical: 3, borderRadius: radius.pill },
  catText: { fontSize: 10, fontWeight: '800', color: colors.primary, letterSpacing: 0.4 },
  cardActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: spacing.sm },
  modalWrap: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', padding: spacing.lg },
  modalCard: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.xl, maxHeight: '90%' },
  label: { fontSize: 13, fontWeight: '700', color: colors.textMuted, marginBottom: 7, letterSpacing: 0.2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.sm },
  switchRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm },
});
