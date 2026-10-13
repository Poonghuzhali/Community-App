import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Modal, Alert, ScrollView, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';

import { useAuth } from '../../context/AuthContext';
import { api } from '../../api/client';
import { Screen, AppHeader, LogoutButton, HeaderActions, Card, Button, StatusPill, Banner, EmptyState, Loader, Divider } from '../../components/ui';
import { colors, spacing, typography, radius, shadow } from '../../theme';
import { formatDateTime, relativeTime, maskPhone } from '../../utils/format';

export default function GateScreen({ navigation }) {
  const { user } = useAuth();
  const [code, setCode] = useState('');
  const [channel, setChannel] = useState('otp');
  const [match, setMatch] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [recent, setRecent] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  const loadRecent = useCallback(async () => {
    try {
      const data = await api('/api/visitors', { params: { scope: 'all', limit: 6 } });
      setRecent(data.items || []);
    } catch (err) {
      setRecent([]);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadRecent(); }, [loadRecent]));

  const verify = async (value = code, ch = channel) => {
    if (!value) return;
    setBusy(true);
    setError(null);
    try {
      const pass = await api('/api/security/verify', { method: 'POST', body: { code: value, channel: ch } });
      setMatch(pass);
      setCode('');
    } catch (err) {
      setMatch(null);
      setError(err.message);
    } finally {
      setBusy(false);
      setScanning(false);
    }
  };

  const gate = async (endpoint, body = {}) => {
    setBusy(true);
    try {
      await api(`/api/security/${endpoint}`, { method: 'POST', body });
      const updated = await api(`/api/visitors/${match.id}`);
      setMatch(updated);
      loadRecent();
      if (endpoint.startsWith('exit') || endpoint.startsWith('deny')) setMatch(null);
    } catch (err) {
      Alert.alert('Action failed', err.message);
    } finally {
      setBusy(false);
    }
  };

  const openScanner = async () => {
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) {
        Alert.alert('Camera needed', 'Allow camera access to scan visitor QR codes.');
        return;
      }
    }
    setScanning(true);
  };

  const onScanned = ({ data }) => {
    if (!data) return;
    setChannel('qr');
    verify(String(data).trim(), 'qr');
  };

  return (
    <Screen scroll contentStyle={{ paddingBottom: spacing.xxl * 3 }}>
      <AppHeader
        title="Gate verification"
        subtitle={`${user?.fullName || 'Security'} • On duty`}
        right={
          <HeaderActions>
            <TouchableOpacity onPress={() => navigation.navigate('Profile')} accessibilityLabel="Profile">
              <Ionicons name="person-circle-outline" size={30} color={colors.text} />
            </TouchableOpacity>
            <LogoutButton />
          </HeaderActions>
        }
      />

      <Banner message={error} type="danger" onClose={() => setError(null)} />

      {/* ------------------------------------------------------- verify card */}
      <Card style={styles.verifyCard}>
        <View style={styles.segment}>
          <TouchableOpacity style={[styles.segBtn, channel === 'otp' && styles.segActive]} onPress={() => setChannel('otp')}>
            <Text style={[styles.segText, channel === 'otp' && { color: colors.textInverse }]}>Visitor OTP</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.segBtn, channel === 'qr' && styles.segActive]} onPress={() => { setChannel('qr'); openScanner(); }}>
            <Text style={[styles.segText, channel === 'qr' && { color: colors.textInverse }]}>Scan QR</Text>
          </TouchableOpacity>
        </View>

        <TextInput
          style={styles.codeInput}
          value={code}
          onChangeText={(t) => setCode(t.replace(/[^0-9a-zA-Z:-]/g, '').slice(0, 32))}
          placeholder="Enter 6 digit OTP"
          placeholderTextColor={colors.grey}
          keyboardType={channel === 'otp' ? 'number-pad' : 'default'}
          maxLength={channel === 'otp' ? 6 : 32}
        />

        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <Button title="Verify" icon="search-outline" onPress={() => verify()} loading={busy} disabled={!code} style={{ flex: 1.4 }} />
          <Button title="Scan" icon="qr-code-outline" variant="secondary" onPress={openScanner} style={{ flex: 1 }} />
        </View>
      </Card>

      {/* ----------------------------------------------------- matched pass */}
      {match ? (
        <Card style={[styles.matchCard, { borderColor: match.status === 'approved' ? colors.success : colors.warning }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Text style={typography.h2}>{match.visitor_name}</Text>
              <Text style={[typography.small, { marginTop: 2 }]}>
                Host {match.host_flat} • {match.host_name}
              </Text>
            </View>
            <StatusPill status={match.status} />
          </View>

          <Divider />

          <Row icon="call-outline" label="Mobile" value={maskPhone(match.visitor_phone)} />
          <Row icon="car-outline" label="Vehicle" value={match.vehicle_number || '—'} />
          <Row icon="document-text-outline" label="Purpose" value={match.purpose} />
          <Row icon="time-outline" label="Valid until" value={formatDateTime(match.valid_until)} />
          {match.entry_at ? <Row icon="log-in-outline" label="Entered" value={formatDateTime(match.entry_at)} /> : null}

          <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
            {match.status === 'approved' ? (
              <Button title="Entry" icon="log-in-outline" onPress={() => gate(`entry/${match.id}`)} loading={busy} style={{ flex: 1 }} small />
            ) : null}
            {match.status === 'checked_in' ? (
              <Button title="Exit" icon="log-out-outline" variant="secondary" onPress={() => gate(`exit/${match.id}`)} loading={busy} style={{ flex: 1 }} small />
            ) : null}
            <Button title="Deny" variant="danger" icon="ban-outline" onPress={() => gate(`deny/${match.id}`, { remarks: 'Denied at gate' })} disabled={busy} style={{ flex: 1 }} small />
          </View>
        </Card>
      ) : null}

      {/* -------------------------------------------------------- recent */}
      <View style={styles.sectionHead}>
        <Text style={typography.h3}>Recent at the gate</Text>
        <TouchableOpacity onPress={() => navigation.navigate('History')}>
          <Text style={styles.link}>History</Text>
        </TouchableOpacity>
      </View>

      {recent.length === 0 ? (
        <EmptyState icon="scan-outline" title="No visitors yet" message="Verified visitors will appear here during your shift." />
      ) : (
        recent.map((v) => (
          <TouchableOpacity key={v.id} activeOpacity={0.8} onPress={() => navigation.navigate('VisitorDetail', { id: v.id })}>
            <Card style={styles.recentCard}>
              <View style={{ flex: 1 }}>
                <Text style={typography.body}>{v.visitor_name}</Text>
                <Text style={[typography.tiny, { marginTop: 2 }]}>
                  {v.host_flat} • {v.pass_type} • {relativeTime(v.created_at)}
                </Text>
              </View>
              <StatusPill status={v.status} />
            </Card>
          </TouchableOpacity>
        ))
      )}

      {/* --------------------------------------------------------- scanner */}
      <Modal visible={scanning} animationType="fullScreen" onRequestClose={() => setScanning(false)}>
        <View style={styles.scanner}>
          <View style={styles.scannerHead}>
            <TouchableOpacity onPress={() => setScanning(false)} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.scannerTitle}>Scan visitor QR</Text>
            <View style={{ width: 40 }} />
          </View>

          <View style={styles.scanArea}>
            <View style={styles.frame} />
            <Text style={styles.scanHint}>Align the QR code inside the frame</Text>
          </View>

          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={scanning ? onScanned : undefined}
          />
        </View>
      </Modal>
    </Screen>
  );
}

function Row({ icon, label, value }) {
  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={15} color={colors.textMuted} />
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  verifyCard: { marginBottom: spacing.lg },
  segment: { flexDirection: 'row', backgroundColor: colors.greyBg, borderRadius: radius.pill, padding: 4, marginBottom: spacing.lg },
  segBtn: { flex: 1, paddingVertical: 9, borderRadius: radius.pill, alignItems: 'center' },
  segActive: { backgroundColor: colors.primary },
  segText: { fontSize: 13, fontWeight: '700', color: colors.textMuted },
  codeInput: {
    borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md,
    fontSize: 24, fontWeight: '700', letterSpacing: 5, textAlign: 'center',
    paddingVertical: spacing.md, color: colors.text, marginBottom: spacing.lg,
    backgroundColor: colors.bg,
  },
  matchCard: { marginBottom: spacing.lg, borderWidth: 1.5 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  rowLabel: { fontSize: 13, color: colors.textMuted, marginLeft: 7, width: 84 },
  rowValue: { fontSize: 14, fontWeight: '600', color: colors.text, flex: 1, textAlign: 'right' },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md, marginTop: spacing.sm },
  link: { color: colors.primary, fontWeight: '700', fontSize: 13 },
  recentCard: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm, padding: spacing.md },
  scanner: { flex: 1, backgroundColor: '#0B1512' },
  scannerHead: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 56, paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, zIndex: 2,
  },
  closeBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  scannerTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  scanArea: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  frame: {
    width: 240, height: 240, borderRadius: 24, borderWidth: 3, borderColor: colors.accent,
    backgroundColor: 'transparent',
  },
  scanHint: { color: '#DCE8E4', marginTop: spacing.lg, fontSize: 13.5 },
});
