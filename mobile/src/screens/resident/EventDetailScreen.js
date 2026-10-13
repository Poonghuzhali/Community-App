import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Alert, RefreshControl, ScrollView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { api } from '../../api/client';
import { Screen, AppHeader, Card, Button, StatusPill, Banner, Loader, Divider } from '../../components/ui';
import { colors, spacing, typography } from '../../theme';
import { formatDateTime, formatDate } from '../../utils/format';

export default function EventDetailScreen({ navigation, route }) {
  const { id } = route.params || {};
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      setEvent(await api(`/api/events/${id}`));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const toggle = async () => {
    setBusy(true);
    try {
      await api(`/api/events/${id}/${event.isRegistered ? 'unregister' : 'register'}`, { method: 'POST', body: {} });
      await load();
    } catch (err) {
      Alert.alert('Registration failed', err.message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Loader label="Loading event…" />;
  if (!event) {
    return (
      <Screen>
        <AppHeader title="Event" onBack={() => navigation.goBack()} />
        <Banner message={error || 'Event not found'} type="danger" />
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <AppHeader title={event.title} subtitle={event.venue} onBack={() => navigation.goBack()} large={false} />
      <Banner message={error} type="danger" onClose={() => setError(null)} />

      <Card style={{ marginBottom: spacing.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={styles.dateBox}>
            <Text style={styles.dateDay}>{new Date(event.starts_at).getDate()}</Text>
            <Text style={styles.dateMonth}>
              {new Date(event.starts_at).toLocaleDateString('en-IN', { month: 'short' })}
            </Text>
          </View>
          <View style={{ flex: 1, marginLeft: spacing.lg }}>
            <Text style={typography.h3}>{event.title}</Text>
            <Text style={[typography.small, { marginTop: 3 }]}>{formatDateTime(event.starts_at)}</Text>
            {event.ends_at ? <Text style={typography.tiny}>Ends {formatDateTime(event.ends_at)}</Text> : null}
          </View>
          <StatusPill status={event.status} label={event.status?.toUpperCase()} />
        </View>

        <Divider />

        <Row icon="location-outline" text={event.venue || 'Community premises'} />
        <Row icon="people-outline" text={`${event.registered_count} registered${event.spotsLeft !== null ? ` of ${event.capacity}` : ''}`} />
        {event.registration_deadline ? (
          <Row icon="alarm-outline" text={`Register by ${formatDate(event.registration_deadline)}`} />
        ) : null}
      </Card>

      <Card style={{ marginBottom: spacing.lg }}>
        <Text style={[typography.h3, { marginBottom: spacing.sm }]}>About</Text>
        <Text style={typography.body}>{event.description || 'No description provided.'}</Text>
      </Card>

      {event.isRegistered ? (
        <Card style={{ backgroundColor: colors.successBg, borderColor: '#C6E9D4' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="checkmark-circle" size={20} color={colors.success} />
            <Text style={[typography.body, { marginLeft: 8, color: colors.success, fontWeight: '700', flex: 1 }]}>
              You are registered for this event
            </Text>
          </View>
          <Button title="Cancel registration" variant="outline" small onPress={toggle} loading={busy} style={{ marginTop: spacing.md }} />
        </Card>
      ) : (
        <Button
          title={event.registrationOpen ? 'Register for this event' : 'Registration closed'}
          onPress={toggle}
          loading={busy}
          disabled={!event.registrationOpen}
        />
      )}
    </Screen>
  );
}

function Row({ icon, text }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6 }}>
      <Ionicons name={icon} size={16} color={colors.textMuted} />
      <Text style={[typography.small, { marginLeft: 8, flex: 1 }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  dateBox: {
    width: 62, height: 66, borderRadius: 16, backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  dateDay: { fontSize: 24, fontWeight: '800', color: colors.primary },
  dateMonth: { fontSize: 12, fontWeight: '700', color: colors.primary, textTransform: 'uppercase' },
});
