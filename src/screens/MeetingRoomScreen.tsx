import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as WebBrowser from 'expo-web-browser';
import { useTheme } from '../context/ThemeContext';
import { ThemeColors } from '../constants/colors';
import { api } from '../lib/api';
import BuildingDropdown from '../components/BuildingDropdown';
import { VideoIcon } from '../components/Icons';

interface Building { id: string; name: string; }
interface Assembly {
  id: string;
  title: string;
  scheduled_date: string | null;
  location: string | null;
  status: string;
  assembly_type: string;
  attendee_count: number | null;
  quorum_reached: boolean | null;
  meeting_url: string | null;
}

const STATUS_LABEL: Record<string, string> = { planned: 'Planned', held: 'Held', cancelled: 'Cancelled' };
const STATUS_COLOR: Record<string, string> = { planned: '#60a5fa', held: '#4ade80', cancelled: '#f87171' };
const TYPE_LABEL: Record<string, string> = { ordinary: 'Ordinary AG', extraordinary: 'Extraordinary AG', special: 'Special' };

export default function MeetingRoomScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [buildings, setBuildings]   = useState<Building[]>([]);
  const [active, setActive]         = useState<Building | null>(null);
  const [assemblies, setAssemblies] = useState<Assembly[]>([]);
  const [loading, setLoading]       = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [startingId, setStartingId] = useState<string | null>(null);

  useEffect(() => {
    api('GET', '/api/syndic/buildings').then((data: any) => {
      const blds: Building[] = data.buildings || data || [];
      setBuildings(blds);
      if (blds.length) setActive(blds[0]);
    }).catch(() => {});
  }, []);

  const load = useCallback(async (buildingId: string, isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    try {
      const data = await api('GET', `/api/syndic/buildings/${buildingId}/assemblies`);
      setAssemblies(data || []);
    } catch {
      setAssemblies([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { if (active) load(active.id); }, [active]);

  async function handleStart(assembly: Assembly) {
    setStartingId(assembly.id);
    try {
      const data = await api('POST', `/api/syndic/assemblies/${assembly.id}/meeting/start`);
      if (data?.url) {
        await WebBrowser.openBrowserAsync(data.url);
      } else {
        Alert.alert('Meeting started', 'No video URL returned.');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not start meeting.');
    } finally {
      setStartingId(null);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>AG Meeting Room</Text>
          <Text style={styles.sub}>General assemblies & video meetings</Text>
        </View>
        <View style={styles.proBadge}><Text style={styles.proBadgeText}>✦ Pro</Text></View>
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
          {assemblies.length === 0 ? (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIconWrap}><VideoIcon size={28} color={colors.amber} strokeWidth={1.5} /></View>
              <Text style={styles.emptyTitle}>No assemblies yet</Text>
              <Text style={styles.emptySub}>General assemblies for this building will appear here.</Text>
            </View>
          ) : (
            assemblies.map(a => (
              <AssemblyCard
                key={a.id}
                assembly={a}
                colors={colors}
                styles={styles}
                starting={startingId === a.id}
                onStart={handleStart}
              />
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function AssemblyCard({
  assembly, colors, styles, starting, onStart,
}: {
  assembly: Assembly;
  colors: ThemeColors;
  styles: ReturnType<typeof makeStyles>;
  starting: boolean;
  onStart: (a: Assembly) => void;
}) {
  const statusColor = STATUS_COLOR[assembly.status] ?? colors.muted;
  const canStart = assembly.status === 'planned';
  const dateStr = assembly.scheduled_date
    ? new Date(assembly.scheduled_date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
    : 'No date set';

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle} numberOfLines={2}>{assembly.title}</Text>
          <Text style={styles.cardType}>{TYPE_LABEL[assembly.assembly_type] ?? assembly.assembly_type}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusColor + '22' }]}>
          <Text style={[styles.statusText, { color: statusColor }]}>{STATUS_LABEL[assembly.status] ?? assembly.status}</Text>
        </View>
      </View>

      <View style={styles.infoRow}>
        <Text style={styles.infoItem}>📅 {dateStr}</Text>
        {assembly.location ? <Text style={styles.infoItem}>📍 {assembly.location}</Text> : null}
        {assembly.attendee_count != null ? <Text style={styles.infoItem}>👥 {assembly.attendee_count} attendees</Text> : null}
        {assembly.quorum_reached != null && (
          <Text style={[styles.infoItem, { color: assembly.quorum_reached ? colors.green : colors.red }]}>
            {assembly.quorum_reached ? '✓ Quorum reached' : '✗ No quorum'}
          </Text>
        )}
      </View>

      {canStart && (
        <TouchableOpacity
          style={[styles.startBtn, starting && { opacity: 0.5 }]}
          onPress={() => onStart(assembly)}
          disabled={starting}
          activeOpacity={0.75}
        >
          {starting
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={styles.startBtnText}>▶ Start video meeting</Text>
          }
        </TouchableOpacity>
      )}
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
    proBadge: { backgroundColor: 'rgba(245,158,11,0.12)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
    proBadgeText: { fontFamily: 'Inter_600SemiBold', fontSize: 11, color: colors.amber },
    dropRow: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    emptyCard: {
      backgroundColor: colors.card, borderRadius: 16, padding: 28,
      borderWidth: 1, borderColor: colors.border, alignItems: 'center', marginTop: 24,
    },
    emptyIconWrap: { width: 64, height: 64, borderRadius: 18, backgroundColor: 'rgba(245,158,11,0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
    emptyTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: colors.text, marginBottom: 6 },
    emptySub: { fontFamily: 'Inter_400Regular', fontSize: 13, color: colors.muted, textAlign: 'center', lineHeight: 19 },
    card: {
      backgroundColor: colors.card, borderRadius: 14, padding: 16,
      borderWidth: 1, borderColor: colors.border, marginBottom: 12,
    },
    cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 },
    cardTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: colors.text, lineHeight: 21 },
    cardType: { fontFamily: 'Inter_400Regular', fontSize: 11, color: colors.muted, marginTop: 2 },
    statusBadge: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 20, alignSelf: 'flex-start' },
    statusText: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
    infoRow: { flexDirection: 'row', gap: 12, flexWrap: 'wrap', marginBottom: 12 },
    infoItem: { fontFamily: 'Inter_400Regular', fontSize: 12, color: colors.muted },
    startBtn: {
      backgroundColor: colors.navy, borderRadius: 10, paddingVertical: 11,
      alignItems: 'center', justifyContent: 'center',
    },
    startBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#fff' },
  });
}
