import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '../../context/AuthContext';
import { api, buildFormData } from '../../api/client';
import { Screen, AppHeader, Input, Button, Banner, Card, Chip } from '../../components/ui';
import { colors, spacing, typography, radius } from '../../theme';

const CATEGORIES = [
  { value: 'homemade_food', label: 'Homemade Food' },
  { value: 'jewellery', label: 'Jewellery' },
  { value: 'used_products', label: 'Used Products' },
  { value: 'tuition', label: 'Tuition' },
  { value: 'yoga_fitness', label: 'Yoga / Fitness' },
  { value: 'other', label: 'Other' },
];

const UNITS = ['one-time', 'per item', 'per box', 'per month', 'per session'];

export default function MarketplaceCreateScreen({ navigation }) {
  const { user } = useAuth();
  const [form, setForm] = useState({
    title: '',
    description: '',
    category: 'homemade_food',
    price: '',
    priceUnit: 'one-time',
    contactPhone: user?.phone || '',
  });
  const [image, setImage] = useState(null);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const pick = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow photo access to add a listing image.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6, allowsEditing: true, aspect: [1, 1] });
    if (!res.canceled && res.assets?.length) setImage(res.assets[0]);
  };

  const submit = async () => {
    setError(null);
    setFieldErrors({});
    const errors = {};
    if (form.title.trim().length < 4) errors.title = 'Add a clear title';
    if (form.description.trim().length < 10) errors.description = 'Describe your listing (10+ characters)';
    if (!form.price || Number(form.price) < 0) errors.price = 'Enter a price';
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      return;
    }

    try {
      setSaving(true);
      const fields = {
        title: form.title.trim(),
        description: form.description.trim(),
        category: form.category,
        price: Number(form.price),
        priceUnit: form.priceUnit,
        contactPhone: form.contactPhone || undefined,
      };
      const body = image ? buildFormData({ uri: image.uri, fields }) : fields;
      await api('/api/marketplace', { method: 'POST', body });
      Alert.alert('Submitted for approval', 'An admin reviews every listing before it goes live.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      if (err.details) {
        const map = {};
        err.details.forEach((d) => { map[d.field] = d.message; });
        setFieldErrors(map);
      }
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <Screen scroll>
      <AppHeader title="Add a listing" subtitle="Reviewed by the admin before it goes live" onBack={() => navigation.goBack()} />

      <Banner message={error} type="danger" onClose={() => setError(null)} />

      <Card>
        <Text style={styles.label}>Category</Text>
        <View style={styles.chips}>
          {CATEGORIES.map((c) => (
            <Chip key={c.value} label={c.label} active={form.category === c.value} onPress={() => set('category', c.value)} style={{ marginBottom: spacing.sm }} />
          ))}
        </View>

        <Input
          label="Title"
          placeholder="e.g. Homemade millet cookies - 500g box"
          value={form.title}
          onChangeText={(t) => set('title', t)}
          error={fieldErrors.title}
          maxLength={140}
        />
        <Input
          label="Description"
          placeholder="Ingredients, size, delivery timing, pickup point…"
          multiline
          value={form.description}
          onChangeText={(t) => set('description', t)}
          error={fieldErrors.description}
          maxLength={2000}
        />

        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <Input
            label="Price (₹)"
            keyboardType="numeric"
            placeholder="250"
            value={form.price}
            onChangeText={(t) => set('price', t.replace(/[^0-9.]/g, ''))}
            error={fieldErrors.price}
            style={{ flex: 1 }}
          />
          <View style={{ flex: 1.3 }}>
            <Text style={styles.label}>Price unit</Text>
            <View style={styles.chips}>
              {UNITS.slice(0, 3).map((u) => (
                <Chip key={u} label={u} active={form.priceUnit === u} onPress={() => set('priceUnit', u)} style={{ marginBottom: 6, marginRight: 6 }} />
              ))}
            </View>
            <View style={styles.chips}>
              {UNITS.slice(3).map((u) => (
                <Chip key={u} label={u} active={form.priceUnit === u} onPress={() => set('priceUnit', u)} style={{ marginBottom: 6, marginRight: 6 }} />
              ))}
            </View>
          </View>
        </View>

        <Input
          label="Contact number"
          icon="call-outline"
          keyboardType="phone-pad"
          maxLength={10}
          value={form.contactPhone}
          onChangeText={(t) => set('contactPhone', t.replace(/\D/g, ''))}
        />
      </Card>

      <Card style={{ marginTop: spacing.lg }}>
        <Text style={[typography.h3, { marginBottom: spacing.md }]}>Photo</Text>
        {image ? (
          <View>
            <Image source={{ uri: image.uri }} style={styles.preview} />
            <Button title="Change photo" variant="secondary" small icon="images-outline" onPress={pick} style={{ marginTop: spacing.md, alignSelf: 'flex-start' }} />
          </View>
        ) : (
          <Button title="Add a photo" variant="secondary" icon="camera-outline" onPress={pick} style={{ alignSelf: 'flex-start' }} />
        )}
      </Card>

      <View style={styles.note}>
        <Ionicons name="eye-off-outline" size={16} color={colors.primary} />
        <Text style={[typography.small, { marginLeft: 7, flex: 1 }]}>
          Your listing stays hidden until an admin approves it. You will get a notification either way.
        </Text>
      </View>

      <Button title="Submit listing" icon="cloud-upload-outline" onPress={submit} loading={saving} style={{ marginTop: spacing.lg }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, fontWeight: '700', color: colors.textMuted, marginBottom: 7, letterSpacing: 0.2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.md },
  preview: { width: '100%', height: 200, borderRadius: radius.md, backgroundColor: colors.greyBg },
  note: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primaryLight,
    padding: spacing.md, borderRadius: radius.md, marginTop: spacing.lg,
  },
});
