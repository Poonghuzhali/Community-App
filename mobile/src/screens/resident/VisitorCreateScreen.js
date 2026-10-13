import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { api } from '../../api/client';
import { Screen, AppHeader, Input, Button, Banner, Card, Chip } from '../../components/ui';
import { colors, spacing, typography, radius } from '../../theme';

const PURPOSES = ['Guest', 'Family', 'Delivery', 'Housekeeping', 'Maintenance', 'Cab / Driver', 'Other'];

export default function VisitorCreateScreen({ navigation }) {
  const [form, setForm] = useState({
    visitorName: '',
    visitorPhone: '',
    purpose: 'Guest',
    visitorCount: '1',
    vehicleNumber: '',
    remarks: '',
  });
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async () => {
    setError(null);
    setFieldErrors({});
    if (form.visitorName.trim().length < 2) {
      setFieldErrors({ visitorName: 'Enter the visitor name' });
      return;
    }
    try {
      setLoading(true);
      const pass = await api('/api/visitors', {
        method: 'POST',
        body: {
          visitorName: form.visitorName.trim(),
          visitorPhone: form.visitorPhone || null,
          purpose: form.purpose,
          visitorCount: Number(form.visitorCount) || 1,
          vehicleNumber: form.vehicleNumber || null,
          remarks: form.remarks || null,
          passType: 'preapproved',
        },
      });
      navigation.replace('VisitorDetail', { id: pass.id, created: true });
    } catch (err) {
      if (err.details) {
        const map = {};
        err.details.forEach((d) => { map[d.field] = d.message; });
        setFieldErrors(map);
      }
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <Screen scroll>
      <AppHeader title="Pre-approve a visitor" subtitle="Share the OTP or QR with your guest" onBack={() => navigation.goBack()} />

      <Banner message={error} type="danger" onClose={() => setError(null)} />

      <Card>
        <Input
          label="Visitor name"
          icon="person-outline"
          placeholder="e.g. Amit Kumar"
          value={form.visitorName}
          onChangeText={set('visitorName')}
          error={fieldErrors.visitorName}
          maxLength={120}
        />
        <Input
          label="Visitor mobile (optional)"
          icon="call-outline"
          placeholder="98765 43210"
          keyboardType="phone-pad"
          maxLength={10}
          value={form.visitorPhone}
          onChangeText={(t) => set('visitorPhone')(t.replace(/\D/g, ''))}
          error={fieldErrors.visitorPhone}
        />

        <Text style={styles.label}>Purpose of visit</Text>
        <View style={styles.chips}>
          {PURPOSES.map((p) => (
            <Chip key={p} label={p} active={form.purpose === p} onPress={() => set('purpose')(p)} style={{ marginBottom: spacing.sm }} />
          ))}
        </View>

        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <Input
            label="No. of visitors"
            keyboardType="number-pad"
            maxLength={2}
            value={form.visitorCount}
            onChangeText={(t) => set('visitorCount')(t.replace(/\D/g, ''))}
            style={{ flex: 1 }}
          />
          <Input
            label="Vehicle no. (optional)"
            placeholder="MH 12 AB 1234"
            autoCapitalize="characters"
            maxLength={15}
            value={form.vehicleNumber}
            onChangeText={set('vehicleNumber')}
            style={{ flex: 1.4 }}
          />
        </View>

        <Input
          label="Note for security (optional)"
          placeholder="Coming around 7 pm for dinner"
          multiline
          value={form.remarks}
          onChangeText={set('remarks')}
          maxLength={300}
        />
      </Card>

      <View style={styles.info}>
        <Ionicons name="information-circle-outline" size={17} color={colors.primary} />
        <Text style={[typography.small, { marginLeft: 8, flex: 1 }]}>
          The pass is valid for 12 hours. Security verifies it at the gate using the OTP or QR code.
        </Text>
      </View>

      <Button title="Send visitor request" icon="paper-plane-outline" onPress={submit} loading={loading} style={{ marginTop: spacing.lg }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, fontWeight: '700', color: colors.textMuted, marginBottom: 7, letterSpacing: 0.2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.md },
  info: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primaryLight,
    padding: spacing.md, borderRadius: radius.md, marginTop: spacing.lg,
  },
});
