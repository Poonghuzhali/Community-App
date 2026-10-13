import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Linking, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '../../context/AuthContext';
import { api } from '../../api/client';
import { Screen, AppHeader, Card, Button, StatusPill, Banner, Loader, QRView, Divider, IconButton } from '../../components/ui';
import { colors, spacing, typography, radius } from '../../theme';
import { formatDateTime, relativeTime, maskPhone } from '../../utils/format';

export default function VisitorDetailScreen({ navigation, route }) {
  const { id, created } = route.params || {};
  const { user } = useAuth();
  const [pass, setPass] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [detail, trail] = await Promise.all([
        api(`/api/visitors/${id}`),
        api(`/api/visitors/${id}/logs`).catch(() => []),
      ]);
      setPass(detail);
      setLogs(trail || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const act = async (action) => {
    setBusy(true);
    try {
      await api(`/api/visitors/${id}/${action}`, { method: 'POST', body: {} });
      await load();
    } catch (err) {
      Alert.alert('Cannot complete', err.message);
    } finally {
      setBusy(false);
    }
  };

  const gateAct = async (endpoint, body = {}) => {
    setBusy(true);
    try {
      await api(`/api/security/${endpoint}`, { method: 'POST', body });
      await load();
    } catch (err) {
      Alert.alert('Gate action failed', err.message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Loader label="Loading visitor pass…" />;
  if (!pass) {
    return (
      <Screen>
        <AppHeader title="Visitor pass" onBack={() => navigation.goBack()} />
        <Banner message={error || 'Pass not found'} type="danger" />
        <Button title="Go back" variant="secondary" onPress={() => navigation.goBack()} />
      </Screen>
    );
  }

  const isHost = pass.host_id === user?.id;
  const isStaff = ['security', 'admin'].includes(user?.role);
  const canApprove = isHost && pass.status === 'pending';
  const canUseGate = isStaff && ['approved', 'checked_in'].includes(pass.status);
  const showPassCode = isHost && ['pending', 'approved'].includes(pass.status);

  return (
    <Screen scroll>
      <AppHeader
        title={pass.visitor_name}
        subtitle={`Host: ${pass.host_flat} • ${pass.host_name}`}
        onBack={() => navigation.goBack()}
        large={false}
      />

      {created ? <Banner message="Visitor pass created. Share the OTP or QR with your guest." type="success" /> : null}
      <Banner message={error} type="danger" onClose={() => setError(null)} />

      <Card style={{ marginBottom: spacing.lg }}>
        <View style={styles.topRow}>
          <View style={{ flex: 1 }}>
            <Text style={typography.h2} numberOfLines={1}>{pass.visitor_name}</Text>
            <Text style={[typography.small, { marginTop: 2 }]}>{pass.purpose}</Text>
          </View>
          <StatusPill status={pass.status} />
        </View>

        <Divider />

        <Row icon="call-outline" label="Mobile" value={maskPhone(pass.visitor_phone)} />
        <Row icon="car-outline" label="Vehicle" value={pass.vehicle_number || '—'} />
        <Row icon="people-outline" label="Visitors" value={String(pass.visitor_count || 1)} />
        <Row icon="time-outline" label="Valid until" value={formatDateTime(pass.valid_until)} />
        {pass.entry_at ? <Row icon="log-in-outline" label="Entered" value={formatDateTime(pass.entry_at)} /> : null}
        {pass.exit_at ? <Row icon="log-out-outline" label="Exited" value={formatDateTime(pass.exit_at)} /> : null}
        {pass.remarks ? <Row icon="document-text-outline" label="Note" value={pass.remarks} /> : null}
      </Card>

      {/* --------------------------------------------------- host actions */}
      {canApprove ? (
        <Card style={{ marginBottom: spacing.lg, backgroundColor: colors.warningBg, borderColor: '#F0DFB4' }}>
          <Text style={[typography.body, { fontWeight: '700', marginBottom: spacing.md }]}>
            Approve this visitor?
          </Text>
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <Button title="Approve" icon="checkmark" onPress={() => act('approve')} loading={busy} style={{ flex: 1 }} />
            <Button title="Reject" variant="danger" icon="close" onPress={() => act('reject')} disabled={busy} style={{ flex: 1 }} />
          </View>
        </Card>
      ) : null}

      {/* ----------------------------------------------------- pass code */}
      {showPassCode ? (
        <Card style={{ marginBottom: spacing.lg, alignItems: 'center' }}>
          <Text style={typography.small}>Show this at the gate</Text>
          <View style={styles.otpBox}>
            <Text style={styles.otpText}>{pass.otp_code || '------'}</Text>
          </View>
          <Text style={[typography.tiny, { marginBottom: spacing.md }]}>Visitor OTP</Text>
          <QRView value={`CC:${pass.qr_token}`} size={180} />
          <Text style={[typography.tiny, { marginTop: spacing.md, textAlign: 'center' }]}>
            Security scans this QR or enters the OTP to let {pass.visitor_name} in.
          </Text>
          {pass.visitor_phone ? (
            <Button
              title="Share pass"
              variant="secondary"
              icon="share-social-outline"
              small
              style={{ marginTop: spacing.md }}
              onPress={() =>
                Linking.openURL(
                  `sms:?body=${encodeURIComponent(
                    `Community Connect visitor pass for ${pass.visitor_name}. OTP ${pass.otp_code} at the gate.`
                  )}`
                )
              }
            />
          ) : null}
        </Card>
      ) : null}

      {/* ---------------------------------------------------- gate actions */}
      {canUseGate ? (
        <Card style={{ marginBottom: spacing.lg }}>
          <Text style={[typography.h3, { marginBottom: spacing.md }]}>Gate controls</Text>
          {pass.status === 'approved' ? (
            <Button title="Record entry" icon="log-in-outline" onPress={() => gateAct(`entry/${id}`)} loading={busy} style={{ marginBottom: spacing.sm }} />
          ) : null}
          {pass.status === 'checked_in' ? (
            <Button title="Record exit" icon="log-out-outline" variant="secondary" onPress={() => gateAct(`exit/${id}`)} loading={busy} style={{ marginBottom: spacing.sm }} />
          ) : null}
          <Button title="Deny entry" variant="danger" icon="ban-outline" onPress={() => gateAct(`deny/${id}`, { remarks: 'Denied at gate' })} disabled={busy} />
        </Card>
      ) : null}

      {isHost && ['pending', 'approved'].includes(pass.status) ? (
        <Button
          title="Cancel pass"
          variant="outline"
          onPress={() => act('cancel')}
          loading={busy}
          style={{ marginBottom: spacing.lg }}
        />
      ) : null}

      {/* -------------------------------------------------------- timeline */}
      <Card>
        <Text style={[typography.h3, { marginBottom: spacing.md }]}>Activity</Text>
        {logs.length === 0 ? (
          <Text style={typography.small}>No activity recorded yet.</Text>
        ) : (
          logs.map((log, index) => (
            <View key={log.id} style={styles.timelineRow}>
              <View style={styles.dotColumn}>
                <View style={[styles.dot, { backgroundColor: index === 0 ? colors.primary : colors.border }]} />
                {index < logs.length - 1 ? <View style={styles.line} /> : null}
              </View>
              <View style={{ flex: 1, paddingBottom: spacing.lg }}>
                <Text style={typography.body}>{labelForAction(log.action)}</Text>
                <Text style={typography.tiny}>
                  {log.performer_name || log.performer_role || 'System'} • {relativeTime(log.created_at)}
                </Text>
                {log.remarks ? <Text style={[typography.small, { marginTop: 2 }]}>{log.remarks}</Text> : null}
              </View>
            </View>
          ))
        )}
      </Card>
    </Screen>
  );
}

function Row({ icon, label, value }) {
  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={16} color={colors.textMuted} />
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function labelForAction(action) {
  return {
    requested: 'Pass requested',
    approved: 'Approved by resident',
    rejected: 'Rejected / cancelled',
    entry: 'Entry recorded at gate',
    exit: 'Exit recorded at gate',
    denied: 'Entry denied',
    otp_verified: 'OTP verified',
    qr_verified: 'QR verified',
  }[action] || action;
}

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7 },
  rowLabel: { fontSize: 13, color: colors.textMuted, marginLeft: spacing.sm, width: 86 },
  rowValue: { fontSize: 14, color: colors.text, fontWeight: '600', flex: 1, textAlign: 'right' },
  otpBox: {
    backgroundColor: colors.primaryLight, borderRadius: radius.md,
    paddingHorizontal: spacing.xl, paddingVertical: spacing.md, marginTop: spacing.md,
  },
  otpText: { fontSize: 34, fontWeight: '800', letterSpacing: 8, color: colors.primary },
  timelineRow: { flexDirection: 'row' },
  dotColumn: { width: 22, alignItems: 'center' },
  dot: { width: 11, height: 11, borderRadius: 6, marginTop: 5 },
  line: { width: 2, flex: 1, backgroundColor: colors.border, marginTop: 2 },
});
