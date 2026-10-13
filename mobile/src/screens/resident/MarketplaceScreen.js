import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity, Image, ScrollView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { api } from '../../api/client';
import { Screen, AppHeader, LogoutButton, HeaderActions, SearchBar, Chip, Card, EmptyState, Loader, Banner } from '../../components/ui';
import { colors, spacing, typography, radius, shadow } from '../../theme';
import { money, relativeTime, initials } from '../../utils/format';

const SORTS = [
  { key: 'recent', label: 'Newest' },
  { key: 'price_asc', label: 'Low → High' },
  { key: 'price_desc', label: 'High → Low' },
  { key: 'popular', label: 'Popular' },
];

export default function MarketplaceScreen({ navigation }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState(null);
  const [sort, setSort] = useState('recent');
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await api('/api/marketplace', {
        params: { q: query || undefined, category: category || undefined, sort, limit: 50 },
      });
      setItems(data.items || []);
      if (data.categories?.length) setCategories(data.categories);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [query, category, sort]);

  useEffect(() => {
    const t = setTimeout(load, query ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, query]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <Screen contentStyle={{ paddingHorizontal: 0, paddingTop: 0 }}>
      <AppHeader
        title="Community marketplace"
        subtitle="Buy, sell and trade inside the community"
        right={
          <HeaderActions>
            <TouchableOpacity style={styles.addBtn} onPress={() => navigation.navigate('MarketCreate')} accessibilityLabel="Add a listing">
              <Ionicons name="add" size={22} color={colors.textInverse} />
            </TouchableOpacity>
            <LogoutButton />
          </HeaderActions>
        }
      />

      <View style={{ paddingHorizontal: spacing.lg }}>
        <SearchBar value={query} onChangeText={setQuery} placeholder="Search cookies, tuition, cycle…" />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 56 }} contentContainerStyle={styles.chipsRow}>
        <Chip label="All" active={!category} onPress={() => setCategory(null)} />
        {categories.map((c) => (
          <Chip key={c.value} label={c.label} active={category === c.value} onPress={() => setCategory(c.value)} />
        ))}
      </ScrollView>

      <View style={styles.sortRow}>
        {SORTS.map((s) => (
          <TouchableOpacity key={s.key} onPress={() => setSort(s.key)} style={[styles.sortPill, sort === s.key && styles.sortActive]}>
            <Text style={[styles.sortText, sort === s.key && { color: colors.primary }]}>{s.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Banner message={error} type="danger" onClose={() => setError(null)} />

      {loading ? (
        <Loader label="Loading listings…" />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          numColumns={2}
          columnWrapperStyle={{ gap: spacing.md }}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl * 2 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />
          }
          ListEmptyComponent={
            <EmptyState
              icon="pricetags-outline"
              title="Nothing listed yet"
              message="Be the first to list homemade food, jewellery, used items, tuition or fitness services."
              action="Add a listing"
              onAction={() => navigation.navigate('MarketCreate')}
            />
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.tile}
              activeOpacity={0.9}
              onPress={() => navigation.navigate('MarketDetail', { id: item.id })}
            >
              <Card style={styles.tileCard}>
                {item.image_url ? (
                  <Image source={{ uri: item.image_url }} style={styles.tileImage} />
                ) : (
                  <View style={[styles.tileImage, styles.tilePlaceholder]}>
                    <Text style={styles.placeholderText}>{initials(item.title)}</Text>
                  </View>
                )}
                <View style={styles.tileBody}>
                  <Text style={styles.tileTitle} numberOfLines={2}>{item.title}</Text>
                  <Text style={styles.tilePrice}>{money(item.price, item.price_unit)}</Text>
                  <View style={styles.tileMeta}>
                    <Text style={typography.tiny} numberOfLines={1}>{item.seller_name}</Text>
                    <Text style={typography.tiny}>{relativeTime(item.created_at)}</Text>
                  </View>
                </View>
              </Card>
            </TouchableOpacity>
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  addBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center', ...shadow.card,
  },
  chipsRow: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, alignItems: 'center' },
  sortRow: { flexDirection: 'row', paddingHorizontal: spacing.lg, marginBottom: spacing.md, gap: 6, flexWrap: 'wrap' },
  sortPill: {
    paddingHorizontal: 11, paddingVertical: 6, borderRadius: radius.pill,
    backgroundColor: colors.greyBg,
  },
  sortActive: { backgroundColor: colors.primaryLight },
  sortText: { fontSize: 11.5, fontWeight: '700', color: colors.textMuted },
  tile: { width: '48.5%', marginBottom: spacing.md },
  tileCard: { padding: 0, overflow: 'hidden' },
  tileImage: { width: '100%', height: 116, backgroundColor: colors.greyBg },
  tilePlaceholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primaryLight },
  placeholderText: { fontSize: 26, fontWeight: '800', color: colors.primary },
  tileBody: { padding: spacing.md },
  tileTitle: { fontSize: 14, fontWeight: '700', color: colors.text, minHeight: 36 },
  tilePrice: { fontSize: 15, fontWeight: '800', color: colors.primary, marginTop: 4 },
  tileMeta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
});
