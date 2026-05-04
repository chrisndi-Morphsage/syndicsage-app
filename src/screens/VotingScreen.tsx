import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { ThemeColors } from '../constants/colors';
import { api } from '../lib/api';
import BuildingDropdown from '../components/BuildingDropdown';
import { VoteIcon } from '../components/Icons';

interface Building { id: string; name: string; }
interface VoteItem { id: string; title: string; position: number; result: string | null; }
interface Vote {
  id: string;
  title: string;
  description: string | null;
  status: string;
  majority_type: string;
  deadline: string | null;
  created_at: string;
  syndic_vote_items: VoteItem[];
  syndic_vote_ballots: { id: string }[];
}

const STATUS_LABEL: Record<string, string> = { draft: 'Draft', open: 'Open', closed: 'Closed' };
const STATUS_COLOR: Record<string, string> = { draft: '#94a3b8', open: '#4ade80', closed: '#f87171' };
const MAJORITY_LABEL: Record<string, string> = {
  simple: 'Simple majority',
  absolute: 'Absolute majority',
  qualified: 'Qualified 4/5',
  unanimous: 'Unanimous',
};

export default function VotingScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [buildings, setBuildings] = useState<Building[]>([]);
  const [active, setActive]       = useState<Building | null>(null);
  const [votes, setVotes]         = useState<Vote[]>([]);
  const [loading, setLoading]     = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    api('GET', '/api/syndic/buildings').then((data: Building[]) => {
      setBuildings(data);
      if (data.length) setActive(data[0]);
    }).catch(() => {});
  }, []);

  const load = useCallback(async (buildingId: string, isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    try {
      const data = await api('GET', `/api/syndic/buildings/${buildingId}/votes`);
      setVotes(data || []);
    } catch {
      setVotes([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { if (active) load(active.id); }, [active]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Digital Voting</Text>
          <Text style={styles.sub}>Owner resolutions & ballots</Text>
        </View>
        <View style={styles.aiBadge}><Text style={styles.aiBadgeText}>✦ Pro</Text></View>
      </View>

      <View style={styles.dropRow}>
        <BuildingDropdown buildings={buildings} active={active} onSelect={setActive} noTopMargin />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.amber} size="large" />
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => active && load(active.id, true)} tintColor={colors.amber} />}
        >
          {votes.length === 0 ? (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIconWrap}><VoteIcon size={28} color="#38bdf8" strokeWidth={1.5} /></View>
              <Text style={styles.emptyTitle}>No votes yet</Text>
              <Text style={styles.emptySub}>Digital votes for this building will appear here.</Text>
            </View>
          ) : (
            votes.map(v => <VoteCard key={v.id} vote={v} colors={colors} styles={styles} />)
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function VoteCard({ vote, colors, styles }: { vote: Vote; colors: ThemeColors; styles: ReturnType<typeof makeStyles> }) {
  const statusColor = STATUS_COLOR[vote.status] ?? colors.muted;
  const ballotCount = vote.syndic_vote_ballots?.length ?? 0;
  const itemCount   = vote.syndic_vote_items?.length ?? 0;

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle} numberOfLines={2}>{vote.title}</Text>
          <Text style={styles.cardMeta}>{MAJORITY_LABEL[vote.majority_type] ?? vote.majority_type}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusColor + '22' }]}>
          <Text style={[styles.statusText, { color: statusColor }]}>{STATUS_LABEL[vote.status] ?? vote.status}</Text>
        </View>
      </View>

      {vote.description ? (
        <Text style={styles.cardDesc} numberOfLines={2}>{vote.description}</Text>
      ) : null}

      <View style={styles.cardFooter}>
        <Text style={styles.footerItem}>📋 {itemCount} resolution{itemCount !== 1 ? 's' : ''}</Text>
        <Text style={styles.footerItem}>👥 {ballotCount} voter{ballotCount !== 1 ? 's' : ''}</Text>
        {vote.deadline && (
          <Text style={styles.footerItem}>⏰ {new Date(vote.deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</Text>
        )}
      </View>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    header: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      paddingHorizontal: 20, paddingTop: 12, paddingBottom: 14,
      backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    backBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: colors.bg2 },
    backArrow: { fontSize: 18, color: colors.text, lineHeight: 22 },
    title: { fontFamily: 'CormorantGaramond_600SemiBold', fontSize: 22, color: colors.text },
    sub: { fontFamily: 'Inter_400Regular', fontSize: 11, color: colors.muted },
    aiBadge: { backgroundColor: 'rgba(245,158,11,0.12)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
    aiBadgeText: { fontFamily: 'Inter_600SemiBold', fontSize: 11, color: colors.amber },
    dropRow: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    emptyCard: {
      backgroundColor: colors.card, borderRadius: 16, padding: 28,
      borderWidth: 1, borderColor: colors.border, alignItems: 'center', marginTop: 24,
    },
    emptyIconWrap: { width: 64, height: 64, borderRadius: 18, backgroundColor: 'rgba(8,145,178,0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
    emptyTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: colors.text, marginBottom: 6 },
    emptySub: { fontFamily: 'Inter_400Regular', fontSize: 13, color: colors.muted, textAlign: 'center', lineHeight: 19 },
    card: {
      backgroundColor: colors.card, borderRadius: 14, padding: 16,
      borderWidth: 1, borderColor: colors.border, marginBottom: 12,
    },
    cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 },
    cardTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: colors.text, lineHeight: 21 },
    cardMeta: { fontFamily: 'Inter_400Regular', fontSize: 11, color: colors.muted, marginTop: 2 },
    statusBadge: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 20, alignSelf: 'flex-start' },
    statusText: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
    cardDesc: { fontFamily: 'Inter_400Regular', fontSize: 13, color: colors.muted, lineHeight: 18, marginBottom: 10 },
    cardFooter: { flexDirection: 'row', gap: 14, marginTop: 4, flexWrap: 'wrap' },
    footerItem: { fontFamily: 'Inter_400Regular', fontSize: 12, color: colors.muted },
  });
}
