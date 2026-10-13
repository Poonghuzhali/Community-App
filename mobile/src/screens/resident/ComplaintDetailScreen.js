import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Image, Alert, RefreshControl, ScrollView, Modal, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '../../context/AuthContext';
import { api } from '../../api/client';
import { Screen, AppHeader, Card, StatusPill, Banner, Loader, Button, Input, Chip, Divider } from '../../components/ui';
import { colors, spacing, typography, radius } from '../../theme';
import { formatDateTime, relativeTime } from '../../utils/format';

const FLOW = [
  { key: 'submitted', label: 'Submitted', icon: 'document-text-outline' },
  { key: 'in_progress', label: 'In Progress', icon: 'construct-outline' },
  { key: 'resolved', label: 'Resolved', icon: 'checkmark-done-outline' },
];

export default function ComplaintDetailScreen({ navigation, route }) {
  const { id } = route.params || {};
  const { user, isAdmin } = useAuth();
  const [complaint, setComplaint] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState(null);
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    try {
      setError(null);
      setComplaint(await api(`/api/complaints/${id}`));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const updateStatus = async (status) => {
    setBusy(true);
    try {
      await api(`/api/complaints/${id}/status`, { method: 'PATCH', body: { status, note: note || undefined } });
      setModal(null);
      setNote('');
      await load();
    } catch (err) {
      Alert.alert('Update failed', err.message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Loader label="Loading complaint…" />;
  if (!complaint) {
    return (
      <Screen>
        <AppHeader title="Complaint" onBack={() => navigation.goBack()} />
        <Banner message={error || 'Complaint not found'} type="danger" />
      </Screen>
    );
  }

  const currentIndex = FLOW.findIndex((f) => f.key === complaint.status);
  const nextStatus = currentIndex === 0 ? 'in_progress' : currentIndex === 1 ? 'resolved' : 'in_progress';
  const nextLabel = currentIndex === 0 ? 'Start work' : currentIndex === 1 ? 'Mark resolved' : 'Re-open';

  return (
    <Screen scroll>
      <AppHeader
        title={complaint.reference_no}
        subtitle={complaint.category_name}
        onBack={() => navigation.goBack()}
        large={false}
      />

      <Banner message={error} type="danger" onClose={() => setError(null)} />

      <Card style={{ marginBottom: spacing.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <Text style={typography.h2}>{complaint.title}</Text>
            <Text style={[typography.tiny, { marginTop: 4 }]}>
              Raised by {complaint.raised_by_name} • {complaint.raised_by_flat || '—'}
            </Text>
          </View>
          <StatusPill status={complaint.status} />
        </View>

        <Divider />

        <Text style={typography.body}>{complaint.description}</Text>

        {complaint.image_url ? (
          <Image
            source={{ uri: complaint.image_url.startsWith('http') ? complaint.image_url : complaint.image_url }}
            style={styles.image}
            resizeMode="cover"
          />
        ) : null}

        <View style={styles.metaRow}>
          <Ionicons name="flag-outline" size={14} color={colors.textMuted} />
          <Text style={[typography.tiny, { marginLeft: 5 }]}>
            Priority: {complaint.priority} • Raised {formatDateTime(complaint.created_at)}
          </Text>
        </View>

        {complaint.resolution_note && complaint.status === 'resolved' ? (
          <View style={styles.resolution}>
            <Ionicons name="checkmark-circle" size={16} color={colors.success} />
            <Text style={[typography.small, { marginLeft: 6, flex: 1, color: colors.success }]}>{complaint.resolution_note}</Text>
          </View>
        ) : null}
      </Card>

      {/* ---------------------------------------------------- status track */}
      <Card style={{ marginBottom: spacing.lg }}>
        <Text style={[typography.h3, { marginBottom: spacing.md }]}>Status</Text>
        <View style={styles.stepper}>
          {FLOW.map((stage, index) => {
            const done = index <= currentIndex;
            return (
              <View key={stage.key} style={styles.stage}>
                <View style={[styles.stageIcon, done && { backgroundColor: colors.primary }]}>
                  <Ionicons name={stage.icon} size={16} color={done ? colors.textInverse : colors.grey} />
                </View>
                <Text style={[styles.stageLabel, done && { color: colors.text, fontWeight: '700' }]}>{stage.label}</Text>
                {index < FLOW.length - 1 ? (
                  <View style={[styles.stageLine, index < currentIndex && { backgroundColor: colors.primary }]} />
                ) : null}
              </View>
            );
          })}
        </View>
      </Card>

      {isAdmin ? (
        <Card style={{ marginBottom: spacing.lg }}>
          <Text style={[typography.h3, { marginBottom: spacing.sm }]}>Admin actions</Text>
          <Text style={[typography.small, { marginBottom: spacing.md }]}>
            Status changes notify the resident instantly.
          </Text>
          <Button title={nextLabel} onPress={() => setModal(nextStatus)} loading={busy} />
        </Card>
      ) : null}

      {/* --------------------------------------------------------- history */}
      <Card>
        <Text style={[typography.h3, { marginBottom: spacing.md }]}>History</Text>
        {(complaint.updates || []).length === 0 ? (
          <Text style={typography.small}>No updates yet.</Text>
        ) : (
          complaint.updates.map((u, index) => (
            <View key={u.id} style={styles.timelineRow}>
              <View style={styles.dotColumn}>
                <View style={[styles.dot, { backgroundColor: index === 0 ? colors.primary : colors.border }]} />
                {index < complaint.updates.length - 1 ? <View style={styles.line} /> : null}
              </View>
              <View style={{ flex: 1, paddingBottom: spacing.lg }}>
                <Text style={typography.body}>
                  {u.from_status ? `${titleize(u.from_status)} → ` : ''}{titleize(u.to_status)}
                </Text>
                <Text style={typography.tiny}>{u.actor_name || 'System'} • {relativeTime(u.created_at)}</Text>
                {u.note ? <Text style={[typography.small, { marginTop: 2 }]}>{u.note}</Text> : null}
              </View>
            </View>
          ))
        )}
      </Card>

      {/* ----------------------------------------------------- status modal */}
      <Modal visible={Boolean(modal)} transparent animationType="fade" onRequestClose={() => setModal(null)}>
        <View style={styles.modalWrap}>
          <View style={styles.modalCard}>
            <Text style={[typography.h3, { marginBottom: spacing.sm }]}>
              {modal === 'resolved' ? 'Mark as resolved' : modal === 'in_progress' ? 'Move to in progress' : 'Re-open complaint'}
            </Text>
            <Text style={[typography.small, { marginBottom: spacing.md }]}>
              The resident will get a notification with your note.
            </Text>
            <Input
              label="Note (optional)"
              placeholder="Plumber visited, replaced the mixer"
              multiline
              value={note}
              onChangeText={setNote}
              maxLength={500}
            />
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <Button title="Cancel" variant="outline" onPress={() => setModal(null)} style={{ flex: 1 }} />
              <Button title="Confirm" onPress={() => updateStatus(modal)} loading={busy} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

function titleize(value) {
  return String(value || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

const styles = StyleSheet.create({
  image: { width: '100%', height: 200, borderRadius: radius.md, marginTop: spacing.md, backgroundColor: colors.greyBg },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.md },
  resolution: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.successBg,
    padding: spacing.md, borderRadius: radius.md, marginTop: spacing.md,
  },
  stepper: { flexDirection: 'row', alignItems: 'flex-start' },
  stage: { flex: 1, alignItems: 'center', position: 'relative' },
  stageIcon: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: colors.greyBg,
    alignItems: 'center', justifyContent: 'center', zIndex: 2,
  },
  stageLabel: { fontSize: 11, color: colors.textMuted, marginTop: 6, textAlign: 'center' },
  stageLine: {
    position: 'absolute', top: 18, left: '50%', width: '100%', height: 2,
    backgroundColor: colors.border, zIndex: 1,
  },
  timelineRow: { flexDirection: 'row' },
  dotColumn: { width: 22, alignItems: 'center' },
  dot: { width: 11, height: 11, borderRadius: 6, marginTop: 5 },
  line: { width: 2, flex: 1, backgroundColor: colors.border, marginTop: 2 },
  modalWrap: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', padding: spacing.xl },
  modalCard: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.xl },
});
