import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '../../context/AuthContext';
import { DEMO_LOGINS } from '../../demoLogins';
import { Screen, Input, Button, Banner } from '../../components/ui';
import { colors, radius, spacing, typography } from '../../theme';

export default function LoginScreen({ navigation }) {
  const { requestOtp } = useAuth();
  const [role, setRole] = useState(null);
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const selected = DEMO_LOGINS.find((item) => item.role === role) || null;

  const chooseRole = (item) => {
    setError(null);
    setRole(item.role);
    setPhone(item.phone);
  };

  const submit = async () => {
    setError(null);
    if (!selected) {
      setError('Choose Resident, Security, or Admin to continue');
      return;
    }
    const clean = phone.replace(/\D/g, '');
    if (clean.length !== 10) {
      setError('Enter a valid 10-digit mobile number');
      return;
    }
    try {
      setLoading(true);
      const result = await requestOtp(clean);
      navigation.navigate('Otp', {
        phone: clean,
        role: selected.role,
        roleLabel: selected.label,
        devOtp: result?.devOtp || selected.otp,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.brand}>
            <View style={styles.logo}>
              <Ionicons name="home" size={34} color={colors.textInverse} />
            </View>
            <Text style={styles.brandName}>Community Connect</Text>
            <Text style={styles.brandTag}>Your gated community, in one app</Text>
          </View>

          <Banner message={error} type="danger" onClose={() => setError(null)} />

          <Text style={[typography.h2, { marginBottom: spacing.xs }]}>Sign in as</Text>
          <Text style={[typography.small, { marginBottom: spacing.lg }]}>
            Choose a role. Each one has a demo mobile number and OTP.
          </Text>

          <View style={styles.roles}>
            {DEMO_LOGINS.map((item) => {
              const active = role === item.role;
              return (
                <TouchableOpacity
                  key={item.role}
                  style={[styles.roleCard, active && styles.roleCardActive]}
                  onPress={() => chooseRole(item)}
                  activeOpacity={0.85}
                >
                  <View style={[styles.roleIcon, active && styles.roleIconActive]}>
                    <Ionicons name={item.icon} size={22} color={active ? colors.textInverse : colors.primary} />
                  </View>
                  <Text style={[styles.roleLabel, active && styles.roleLabelActive]}>{item.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {selected ? (
            <>
              <View style={styles.demo}>
                <Text style={styles.demoTitle}>{selected.label} demo login</Text>
                <Text style={styles.demoLine}>{selected.name}</Text>
                <View style={styles.demoRow}>
                  <Text style={styles.demoKey}>Mobile</Text>
                  <Text style={styles.demoValue}>{selected.phone}</Text>
                </View>
                <View style={styles.demoRow}>
                  <Text style={styles.demoKey}>OTP</Text>
                  <Text style={styles.demoValue}>{selected.otp}</Text>
                </View>
              </View>

              <Input
                label="Mobile number"
                icon="call-outline"
                placeholder="98765 43210"
                keyboardType="phone-pad"
                maxLength={10}
                value={phone}
                onChangeText={(t) => setPhone(t.replace(/\D/g, ''))}
                returnKeyType="done"
                onSubmitEditing={submit}
              />

              <Button title="Send OTP" onPress={submit} loading={loading} disabled={phone.length !== 10} />
            </>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', padding: spacing.xl },
  brand: { alignItems: 'center', marginBottom: spacing.xxl },
  logo: {
    width: 76, height: 76, borderRadius: 24, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg,
  },
  brandName: { fontSize: 24, fontWeight: '800', color: colors.text, letterSpacing: -0.4 },
  brandTag: { ...typography.small, marginTop: 4 },
  roles: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xl },
  roleCard: {
    flex: 1, alignItems: 'center', paddingVertical: spacing.md, paddingHorizontal: spacing.xs,
    borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.card,
  },
  roleCardActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  roleIcon: {
    width: 40, height: 40, borderRadius: 14, backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm,
  },
  roleIconActive: { backgroundColor: colors.primary },
  roleLabel: { fontSize: 13, fontWeight: '700', color: colors.text },
  roleLabelActive: { color: colors.primary },
  demo: {
    backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
    padding: spacing.lg, marginBottom: spacing.lg,
  },
  demoTitle: { fontSize: 14, fontWeight: '800', color: colors.text, marginBottom: 2 },
  demoLine: { ...typography.small, marginBottom: spacing.sm },
  demoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  demoKey: { ...typography.small },
  demoValue: { fontSize: 15, fontWeight: '800', color: colors.primary, letterSpacing: 0.4 },
});
