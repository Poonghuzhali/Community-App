import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Image, Linking, Alert, RefreshControl, ScrollView, Modal, TextInput } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '../../context/AuthContext';
import { api } from '../../api/client';
import { Screen, AppHeader, Card, Button, StatusPill, Banner, Loader, Avatar, Divider } from '../../components/ui';
import { colors, spacing, typography, radius } from '../../theme';
import { money, relativeTime, maskPhone } from '../../utils/format';

export default function MarketplaceDetailScreen({ navigation, route }) {
  const { id } = route.params || {};
  const { user, isAdmin } = useAuth();
  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState(false);
  const [message, setMessage] = useState('Hi, is this still available?');
  const [sellerPhone, setSellerPhone] = useState(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setListing(await api(`/api/marketplace/${id}`));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const contact = async () => {
    setBusy(true);
    try {
      const res = await api(`/api/marketplace/${id}/contact`, { method: 'POST', body: { message } });
      setSellerPhone(res.sellerPhone);
      setModal(false);
      Alert.alert('Enquiry sent', `The seller has been notified. ${res.sellerPhone ? `Call ${maskPhone(res.sellerPhone)} if it is urgent.` : ''}`);
    } catch (err) {
      Alert.alert('Could not send', err.message);
    } finally {
      setBusy(false);
    }
  };

  const act = async (action) => {
    setBusy(true);
    try {
      if (action === 'delete') {
        await api(`/api/marketplace/${id}`, { method: 'DELETE' });
        navigation.goBack();
        return;
      }
      await api(`/api/marketplace/admin/${id}`, { method: 'PATCH', body: { status: action, reason: 'Moderated from app' } });
      await load();
    } catch (err) {
      Alert.alert('Action failed', err.message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Loader label="Loading listing…" />;
  if (!listing) {
    return (
      <Screen>
        <AppHeader title="Listing" onBack={() => navigation.goBack()} />
        <Banner message={error || 'Listing not found'} type="danger" />
      </Screen>
    );
  }

  const isOwner = listing.seller_id === user?.id;

  return (
    <Screen scroll contentStyle={{ paddingHorizontal: 0, paddingTop: 0 }}>
      <AppHeader title="Listing" onBack={() => navigation.goBack()} large={false} />
      <Banner message={error} type="danger" onClose={() => setError(null)} />

      {listing.image_url ? (
        <Image source={{ uri: listing.image_url }} style={styles.hero} />
      ) : (
        <View style={[styles.hero, styles.heroPlaceholder]}>
          <Ionicons name="pricetags-outline" size={44} color={colors.primary} />
        </View>
      )}

      <View style={styles.body}>
        <View style={styles.headRow}>
          <View style={{ flex: 1 }}>
            <Text style={typography.h1} numberOfLines={2}>{listing.title}</Text>
            <Text style={styles.price}>{money(listing.price, listing.price_unit)}</Text>
          </View>
          <StatusPill status={listing.status} label={listing.categoryLabel} />
        </View>

        <Text style={[typography.tiny, { marginTop: 4 }]}>
          {listing.categoryLabel} • {listing.views} views • {relativeTime(listing.created_at)}
        </Text>

        <Card style={{ marginTop: spacing.lg }}>
          <Text style={[typography.h3, { marginBottom: spacing.sm }]}>Description</Text>
          <Text style={typography.body}>{listing.description}</Text>
        </Card>

        <Card style={{ marginTop: spacing.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Avatar name={listing.seller_name} size={44} />
            <View style={{ marginLeft: spacing.md, flex: 1 }}>
              <Text style={typography.body}>{listing.seller_name}</Text>
              <Text style={typography.small}>{listing.seller_flat || 'Community resident'}</Text>
            </View>
          </View>
          <Divider />
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="call-outline" size={15} color={colors.textMuted} />
            <Text style={[typography.small, { marginLeft: 6 }]}>
              {listing.contact_phone || listing.seller_phone ? maskPhone(listing.contact_phone || listing.seller_phone) : 'Contact via app'}
            </Text>
          </View>
        </Card>

        {!isOwner ? (
          <Button
            title="Contact seller"
            icon="chatbubble-ellipses-outline"
            onPress={() => setModal(true)}
            style={{ marginTop: spacing.lg }}
          />
        ) : null}

        {isOwner ? (
          <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg }}>
            {listing.status === 'approved' ? (
              <Button title="Mark sold" variant="secondary" onPress={() => act('sold')} loading={busy} style={{ flex: 1 }} />
            ) : null}
            <Button title="Delete" variant="danger" onPress={() => act('delete')} loading={busy} style={{ flex: 1 }} />
          </View>
        ) : null}

        {isAdmin ? (
          <Card style={{ marginTop: spacing.lg }}>
            <Text style={[typography.h3, { marginBottom: spacing.md }]}>Admin moderation</Text>
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <Button title="Approve" onPress={() => act('approved')} loading={busy} style={{ flex: 1 }} />
              <Button title="Reject" variant="danger" onPress={() => act('rejected')} disabled={busy} style={{ flex: 1 }} />
            </View>
          </Card>
        ) : null}
      </View>

      {/* ------------------------------------------------------- contact modal */}
      <Modal visible={modal} transparent animationType="fade" onRequestClose={() => setModal(false)}>
        <View style={styles.modalWrap}>
          <View style={styles.modalCard}>
            <Text style={[typography.h3, { marginBottom: spacing.sm }]}>Message the seller</Text>
            <Text style={[typography.small, { marginBottom: spacing.md }]}>
              “{listing.title}” — your message is delivered in-app and the seller can call you back.
            </Text>
            <TextInput
              style={styles.input}
              value={message}
              onChangeText={setMessage}
              multiline
              placeholder="Hi, is this still available?"
              placeholderTextColor={colors.grey}
            />
            <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg }}>
              <Button title="Cancel" variant="outline" onPress={() => setModal(false)} style={{ flex: 1 }} />
              <Button title="Send" onPress={contact} loading={busy} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { width: '100%', height: 230, backgroundColor: colors.greyBg },
  heroPlaceholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primaryLight },
  body: { padding: spacing.lg },
  headRow: { flexDirection: 'row', alignItems: 'flex-start' },
  price: { fontSize: 22, fontWeight: '800', color: colors.primary, marginTop: 6 },
  modalWrap: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', padding: spacing.xl },
  modalCard: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.xl },
  input: {
    borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md,
    padding: spacing.md, minHeight: 96, textAlignVertical: 'top', fontSize: 15, color: colors.text,
    backgroundColor: colors.bg,
  },
});
