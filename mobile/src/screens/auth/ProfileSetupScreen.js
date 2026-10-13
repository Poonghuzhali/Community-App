import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '../../context/AuthContext';
import { Screen, Input, Button, Banner, Card } from '../../components/ui';
import { colors, spacing, typography } from '../../theme';

export default function ProfileSetupScreen() {
  const { user, completeProfile } = useAuth();
  const [fullName, setFullName] = useState(user?.fullName && user.fullName !== 'New Resident' ? user.fullName : '');
  const [email, setEmail] = useState(user?.email || '');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError(null);
    if (fullName.trim().length < 3) {
      setError('Please enter your full name');
      return;
    }
    try {
      setLoading(true);
      await completeProfile({ full_name: fullName.trim(), email: email.trim() || null });
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <Screen scroll>
      <View style={styles.head}>
        <View style={styles.logo}>
          <Ionicons name="person-add-outline" size={30} color={colors.textInverse} />
        </View>
        <Text style={[typography.h1, { marginTop: spacing.lg }]}>Tell us about you</Text>
        <Text style={[typography.small, { marginTop: 4 }]}>
          Your flat details are verified by the admin before they show up here.
        </Text>
      </View>

      <Banner message={error} type="danger" onClose={() => setError(null)} />

      <Input
        label="Full name"
        icon="person-outline"
        placeholder="e.g. Rahul Verma"
        value={fullName}
        onChangeText={setFullName}
        maxLength={120}
      />
      <Input
        label="Email (optional)"
        icon="mail-outline"
        placeholder="you@example.com"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        maxLength={160}
      />

      <Card style={{ marginBottom: spacing.xl }}>
        <View style={styles.row}>
          <Ionicons name="home-outline" size={18} color={colors.primary} />
          <Text style={[typography.body, { marginLeft: spacing.sm, flex: 1 }]}>
            Flat: {user?.flatLabel || 'Not assigned yet'}
          </Text>
        </View>
        <View style={[styles.row, { marginTop: spacing.md }]}>
          <Ionicons name="call-outline" size={18} color={colors.primary} />
          <Text style={[typography.body, { marginLeft: spacing.sm }]}>+91 {user?.phone}</Text>
        </View>
      </Card>

      <Button title="Save & continue" onPress={submit} loading={loading} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { alignItems: 'center', marginTop: spacing.xxl, marginBottom: spacing.xl },
  logo: {
    width: 68, height: 68, borderRadius: 22, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center' },
});
