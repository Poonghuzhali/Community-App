import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';

import { api, buildFormData } from '../../api/client';
import { Screen, AppHeader, Input, Button, Banner, Card, Chip, Loader } from '../../components/ui';
import { colors, spacing, typography, radius } from '../../theme';

const PRIORITIES = [
  { key: 'low', label: 'Low' },
  { key: 'medium', label: 'Medium' },
  { key: 'high', label: 'High' },
];

export default function ComplaintCreateScreen({ navigation }) {
  const [categories, setCategories] = useState(null);
  const [form, setForm] = useState({ title: '', description: '', categoryId: null, priority: 'medium' });
  const [image, setImage] = useState(null);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await api('/api/complaints/categories');
        setCategories(data);
      } catch (err) {
        setCategories([]);
        setError(err.message);
      }
    })();
  }, []);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Allow photo access to attach an image.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.6,
      allowsEditing: true,
      aspect: [4, 3],
    });
    if (!result.canceled && result.assets?.length) setImage(result.assets[0]);
  };

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Allow camera access to take a photo.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.6, allowsEditing: true, aspect: [4, 3] });
    if (!result.canceled && result.assets?.length) setImage(result.assets[0]);
  };

  const submit = async () => {
    setError(null);
    setFieldErrors({});
    const errors = {};
    if (form.title.trim().length < 4) errors.title = 'Add a short title';
    if (form.description.trim().length < 10) errors.description = 'Describe the issue in at least 10 characters';
    if (!form.categoryId) errors.categoryId = 'Pick a category';
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      return;
    }

    try {
      setSaving(true);
      const fields = {
        title: form.title.trim(),
        description: form.description.trim(),
        categoryId: form.categoryId,
        priority: form.priority,
      };
      const payload = image
        ? buildFormData({ uri: image.uri, fields })
        : fields;
      await api('/api/complaints', { method: 'POST', body: payload });
      navigation.goBack();
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

  if (!categories) return <Loader label="Loading categories…" />;

  return (
    <Screen scroll>
      <AppHeader title="New complaint" subtitle="Report an issue in your flat or the community" onBack={() => navigation.goBack()} />

      <Banner message={error} type="danger" onClose={() => setError(null)} />

      <Card>
        <Text style={styles.label}>Category</Text>
        <View style={styles.chips}>
          {categories.map((c) => (
            <Chip
              key={c.id}
              label={c.name}
              active={form.categoryId === c.id}
              onPress={() => set('categoryId', c.id)}
              style={{ marginBottom: spacing.sm }}
            />
          ))}
        </View>
        {fieldErrors.categoryId ? <Text style={styles.error}>{fieldErrors.categoryId}</Text> : null}

        <Input
          label="Title"
          placeholder="e.g. Water leaking under kitchen sink"
          value={form.title}
          onChangeText={(t) => set('title', t)}
          error={fieldErrors.title}
          maxLength={140}
        />
        <Input
          label="Description"
          placeholder="What happened? When did you notice it?"
          multiline
          value={form.description}
          onChangeText={(t) => set('description', t)}
          error={fieldErrors.description}
          maxLength={2000}
        />

        <Text style={styles.label}>Priority</Text>
        <View style={[styles.chips, { marginBottom: spacing.lg }]}>
          {PRIORITIES.map((p) => (
            <Chip
              key={p.key}
              label={p.label}
              active={form.priority === p.key}
              onPress={() => set('priority', p.key)}
              style={{ marginRight: spacing.sm, marginBottom: 0 }}
            />
          ))}
        </View>
      </Card>

      <Card style={{ marginTop: spacing.lg }}>
        <Text style={[typography.h3, { marginBottom: spacing.md }]}>Photo evidence</Text>
        {image ? (
          <View>
            <Image source={{ uri: image.uri }} style={styles.preview} resizeMode="cover" />
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
              <Button title="Replace" variant="secondary" small icon="camera-outline" onPress={takePhoto} style={{ flex: 1 }} />
              <Button title="Remove" variant="danger" small icon="trash-outline" onPress={() => setImage(null)} style={{ flex: 1 }} />
            </View>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <Button title="Camera" variant="secondary" icon="camera-outline" small onPress={takePhoto} style={{ flex: 1 }} />
            <Button title="Gallery" variant="outline" icon="images-outline" small onPress={pickImage} style={{ flex: 1 }} />
          </View>
        )}
      </Card>

      {saving ? (
        <View style={{ marginTop: spacing.lg }}><ActivityIndicator color={colors.primary} /></View>
      ) : null}

      <Button title="Submit complaint" icon="paper-plane-outline" onPress={submit} loading={saving} style={{ marginTop: spacing.xl }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, fontWeight: '700', color: colors.textMuted, marginBottom: 7, letterSpacing: 0.2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.md },
  error: { color: colors.danger, fontSize: 12, marginTop: -spacing.sm, marginBottom: spacing.md },
  preview: { width: '100%', height: 190, borderRadius: radius.md, backgroundColor: colors.greyBg },
});
