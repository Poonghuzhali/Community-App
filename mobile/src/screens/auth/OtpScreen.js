import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '../../context/AuthContext';
import { Screen, AppHeader, Button, Banner } from '../../components/ui';
import { colors, radius, spacing, typography } from '../../theme';

export default function OtpScreen({ navigation, route }) {
  const { phone, devOtp, role, roleLabel } = route.params || {};
  const { requestOtp, verifyOtp, logout } = useAuth();
  const [code, setCode] = useState(devOtp || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [seconds, setSeconds] = useState(30);
  const [hint, setHint] = useState(devOtp);

  useEffect(() => {
    const t = setInterval(() => setSeconds((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, []);

  const submit = async () => {
    setError(null);
    if (code.length !== 6) {
      setError('Enter the 6-digit OTP');
      return;
    }
    try {
      setLoading(true);
      const data = await verifyOtp({ phone, code });
      if (role && data?.user?.role !== role) {
        await logout();
        setError(`This number is not a ${roleLabel || role} account.`);
        setLoading(false);
      }
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const resend = async () => {
    setError(null);
    try {
      const result = await requestOtp(phone);
      setHint(result?.devOtp || null);
      setSeconds(30);
      setCode('');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <Screen>
      <AppHeader
        title="Verify OTP"
        subtitle={`Sent to +91 ${phone}`}
        onBack={() => navigation.goBack()}
        large={false}
      />

      <View style={styles.body}>
        <View style={styles.icon}>
          <Ionicons name="lock-closed-outline" size={26} color={colors.primary} />
        </View>

        <Text style={[typography.body, { textAlign: 'center', marginBottom: spacing.xl }]}>
          Enter the 6 digit code to continue
        </Text>

        <Banner message={error} type="danger" onClose={() => setError(null)} />
        {hint ? (
          <Banner message={`Demo mode – your OTP is ${hint}`} type="info" />
        ) : null}

        <TextInput
          style={styles.otp}
          value={code}
          onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
          keyboardType="number-pad"
          maxLength={6}
          autoFocus
          placeholder="••••••"
          placeholderTextColor={colors.grey}
        />

        <Button title="Verify & continue" onPress={submit} loading={loading} disabled={code.length !== 6} />

        <View style={styles.resendRow}>
          {seconds > 0 ? (
            <Text style={typography.small}>Resend OTP in {seconds}s</Text>
          ) : (
            <TouchableOpacity onPress={resend}>
              <Text style={styles.resend}>Resend OTP</Text>
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: spacing.lg }}>
          <Text style={[typography.small, { textAlign: 'center' }]}>Change mobile number</Text>
        </TouchableOpacity>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { paddingTop: spacing.xl },
  icon: {
    alignSelf: 'center', width: 60, height: 60, borderRadius: 30,
    backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  otp: {
    backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.border,
    borderRadius: radius.md, fontSize: 30, letterSpacing: 14, textAlign: 'center',
    paddingVertical: spacing.lg, color: colors.text, fontWeight: '700',
    marginBottom: spacing.xl, height: 68,
  },
  resendRow: { alignItems: 'center', marginTop: spacing.lg },
  resend: { color: colors.primary, fontWeight: '700', fontSize: 14 },
});
