import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '../../context/AuthContext';
import { confirm } from '../../utils/confirm';
import { Screen, AppHeader, Card, Avatar, Button, Input, Banner, Divider, StatusPill } from '../../components/ui';
import { colors, spacing, typography, radius } from '../../theme';
import { formatDate, maskPhone } from '../../utils/format';

const ROLE_LABEL = { resident: 'Resident', security: 'Security', admin: 'Admin' };

export default function ProfileScreen({ navigation }) {
  const { user, completeProfile, logout, refresh } = useAuth();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ full_name: user?.fullName || '', email: user?.email || '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const save = async () => {
    setError(null);
    if (form.full_name.trim().length < 3) {
      setError('Please enter your full name');
      return;
    }
    try {
      setSaving(true);
      await completeProfile({ full_name: form.full_name.trim(), email: form.email.trim() || null });
      setEditing(false);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  const confirmLogout = () => {
    confirm('Log out?', 'You will need your mobile OTP to sign back in.', 'Log out', logout);
  };

  return (
    <Screen scroll>
      <AppHeader title="My profile" onBack={() => navigation.goBack()} large={false} />

      <Card style={styles.hero}>
        <Avatar name={user?.fullName} size={78} />
        <Text style={styles.name}>{user?.fullName}</Text>
        <Text style={typography.small}>{maskPhone(user?.phone)}</Text>
        <View style={{ marginTop: spacing.sm }}>
          <StatusPill status="approved" label={ROLE_LABEL[user?.role] || user?.role} style={{ backgroundColor: colors.primaryLight }} />
        </View>
      </Card>

      <Card style={{ marginTop: spacing.lg }}>
        <Text style={[typography.h3, { marginBottom: spacing.md }]}>Flat details</Text>
        <DetailRow icon="home-outline" label="Flat" value={user?.flatLabel || 'Not assigned yet'} />
        <DetailRow icon="mail-outline" label="Email" value={user?.email || 'Not added'} />
        <DetailRow icon="calendar-outline" label="Joined" value={user?.joinedOn ? formatDate(user.joinedOn) : '—'} />
        <DetailRow icon="shield-checkmark-outline" label="Account" value={user?.isActive === false ? 'Deactivated' : 'Active'} />
      </Card>

      <Card style={{ marginTop: spacing.lg }}>
        <Text style={[typography.h3, { marginBottom: spacing.md }]}>Preferences</Text>
        <DetailRow icon="notifications-outline" label="Push notifications" value="Enabled" />
        <DetailRow icon="lock-closed-outline" label="Login method" value="Mobile OTP" />
        <Divider />
        <Text style={typography.small}>
          Your mobile number doubles as your login identity. Contact the admin to change it.
        </Text>
      </Card>

      <Button title="Edit profile" icon="create-outline" variant="secondary" style={{ marginTop: spacing.lg }} onPress={() => setEditing(true)} />
      <Button title="Log out" icon="log-out-outline" variant="danger" style={{ marginTop: spacing.md }} onPress={confirmLogout} />

      <Modal visible={editing} transparent animationType="fade" onRequestClose={() => setEditing(false)}>
        <View style={styles.modalWrap}>
          <ScrollView>
            <View style={styles.modalCard}>
              <Text style={[typography.h3, { marginBottom: spacing.md }]}>Edit profile</Text>
              <Banner message={error} type="danger" onClose={() => setError(null)} />
              <Input
                label="Full name"
                value={form.full_name}
                onChangeText={(t) => setForm((f) => ({ ...f, full_name: t }))}
                maxLength={120}
              />
              <Input
                label="Email"
                value={form.email}
                onChangeText={(t) => setForm((f) => ({ ...f, email: t }))}
                keyboardType="email-address"
                autoCapitalize="none"
                maxLength={160}
              />
              <View style={{ flexDirection: 'row', gap: spacing.md }}>
                <Button title="Cancel" variant="outline" onPress={() => setEditing(false)} style={{ flex: 1 }} />
                <Button title="Save" onPress={save} loading={saving} style={{ flex: 1 }} />
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </Screen>
  );
}

function DetailRow({ icon, label, value }) {
  return (
    <View style={styles.detailRow}>
      <Ionicons name={icon} size={17} color={colors.primary} />
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', paddingVertical: spacing.xl },
  name: { fontSize: 21, fontWeight: '800', color: colors.text, marginTop: spacing.md },
  detailRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  detailLabel: { fontSize: 13.5, color: colors.textMuted, marginLeft: spacing.sm, width: 118 },
  detailValue: { fontSize: 14, fontWeight: '600', color: colors.text, flex: 1, textAlign: 'right' },
  modalWrap: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', padding: spacing.xl },
  modalCard: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.xl },
});
