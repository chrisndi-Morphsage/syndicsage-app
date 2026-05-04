import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../constants/colors';
import { api } from '../lib/api';

interface Building { id: string; name: string; address?: string; city?: string; unit_count: number; ag_date?: string; reserve_fund_balance?: number; }

const AVATARS = ['#1E3A5F', '#059669', '#7c3aed', '#0891b2', '#dc2626', '#D97706'];

export default function BuildingsScreen() {
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      const data = await api('GET', '/api/syndic/buildings');
      setBuildings(data.buildings || data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  }

  if (loading) return <View style={styles.loading}><ActivityIndicator color={Colors.amber} size="large" /></View>;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={Colors.amber} />}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Buildings</Text>
          <Text style={styles.sub}>{buildings.length} building{buildings.length !== 1 ? 's' : ''} under management</Text>
        </View>

        {buildings.map((b, i) => {
          const agDays = b.ag_date ? Math.ceil((new Date(b.ag_date + 'T00:00:00').getTime() - Date.now()) / 86400000) : null;
          const color = AVATARS[i % AVATARS.length];
          const initials = b.name.split(' ').map((w: string) => w[0]).slice(0, 2).join('');
          return (
            <TouchableOpacity key={b.id} style={styles.card} activeOpacity={0.8}>
              <View style={styles.cardHeader}>
                <View style={[styles.avatar, { backgroundColor: color }]}>
                  <Text style={styles.avatarText}>{initials}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardName}>{b.name}</Text>
                  <Text style={styles.cardAddr}>{b.address || b.city || 'Belgium'}</Text>
                </View>
                <View style={styles.healthBadge}>
                  <View style={[styles.healthDot, { backgroundColor: agDays !== null && agDays < 30 ? Colors.amber : Colors.green }]} />
                  <Text style={[styles.healthText, { color: agDays !== null && agDays < 30 ? Colors.amber2 : Colors.green }]}>
                    {agDays !== null && agDays < 30 ? 'Attention' : 'Healthy'}
                  </Text>
                </View>
              </View>
              <View style={styles.statsRow}>
                <View style={styles.stat}>
                  <Text style={styles.statVal}>{b.unit_count}</Text>
                  <Text style={styles.statLabel}>Units</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.stat}>
                  <Text style={styles.statVal}>{agDays !== null ? `${agDays}d` : '—'}</Text>
                  <Text style={styles.statLabel}>Next AG</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.stat}>
                  <Text style={styles.statVal}>
                    {b.reserve_fund_balance != null ? `€${(b.reserve_fund_balance / 1000).toFixed(0)}k` : '—'}
                  </Text>
                  <Text style={styles.statLabel}>Reserve</Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}

        <TouchableOpacity style={styles.addCard} activeOpacity={0.7}>
          <View style={styles.addIcon}>
            <Text style={styles.addPlus}>+</Text>
          </View>
          <Text style={styles.addText}>Add building…</Text>
        </TouchableOpacity>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bg },
  header: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 16 },
  title: { fontFamily: 'CormorantGaramond_600SemiBold', fontSize: 30, color: Colors.text },
  sub: { fontFamily: 'Inter_400Regular', fontSize: 13, color: Colors.muted, marginTop: 2 },
  card: {
    marginHorizontal: 24, marginBottom: 12,
    backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 16, padding: 16,
    shadowColor: Colors.navy, shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  avatar: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: 'Inter_700Bold', color: '#fff', fontSize: 13 },
  cardName: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: Colors.text },
  cardAddr: { fontFamily: 'Inter_400Regular', fontSize: 12, color: Colors.muted, marginTop: 1 },
  healthBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(22,163,74,0.08)', borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  healthDot: { width: 5, height: 5, borderRadius: 3 },
  healthText: { fontFamily: 'Inter_600SemiBold', fontSize: 10 },
  statsRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.bg, borderRadius: 10, padding: 10,
  },
  stat: { flex: 1, alignItems: 'center' },
  statDivider: { width: 1, height: 24, backgroundColor: Colors.border },
  statVal: { fontFamily: 'CormorantGaramond_600SemiBold', fontSize: 20, color: Colors.text },
  statLabel: { fontFamily: 'Inter_400Regular', fontSize: 10, color: Colors.muted, marginTop: 2 },
  addCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginHorizontal: 24, padding: 14,
    borderWidth: 1.5, borderStyle: 'dashed', borderColor: 'rgba(30,58,95,0.15)',
    borderRadius: 14,
  },
  addIcon: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(245,158,11,0.08)', alignItems: 'center', justifyContent: 'center',
  },
  addPlus: { fontFamily: 'Inter_400Regular', fontSize: 22, color: Colors.amber, lineHeight: 26 },
  addText: { fontFamily: 'Inter_500Medium', fontSize: 14, color: 'rgba(30,58,95,0.35)' },
});
