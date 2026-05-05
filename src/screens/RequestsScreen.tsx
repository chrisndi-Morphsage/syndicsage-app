import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, TextInput, Modal, Pressable, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { ThemeColors } from '../constants/colors';
import { api } from '../lib/api';
import BuildingDropdown from '../components/BuildingDropdown';
import { TicketIcon } from '../components/Icons';

interface Building { id: string; name: string; }
interface Owner { id: string; name: string; unit_number: string; }
interface Request {
  id: string;
  type: string;
  subject: string;
  description: string | null;
  status: string;
  priority: string;
  syndic_note: string | null;
  created_at: string;
  resolved_at: string | null;
  syndic_owners: Owner | null;
}

const STATUS_LABEL: Record<string, string> = { open: 'Open', in_progress: 'In progress', resolved: 'Resolved', closed: 'Closed' };
const STATUS_COLOR: Record<string, string> = { open: '#f59e0b', in_progress: '#818cf8', resolved: '#4ade80', closed: '#94a3b8' };
const TYPE_COLOR:   Record<string, string> = { complaint: '#f87171', maintenance: '#fbbf24', question: '#818cf8', other: '#94a3b8' };
const PRIORITY_COLOR: Record<string, string> = { high: '#f87171', medium: '#fbbf24', low: '#94a3b8' };

export default function RequestsScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [buildings, setBuildings]   = useState<Building[]>([]);
  const [active, setActive]         = useState<Building | null>(null);
  const [requests, setRequests]     = useState<Request[]>([]);
  const [loading, setLoading]       = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected]     = useState<Request | null>(null);
  const [note, setNote]             = useState('');
  const [saving, setSaving]         = useState(false);

  useEffect(() => {
    api('GET', '/api/syndic/buildings').then((data: Building[]) => {
      setBuildings(data);
      if (data.length) setActive(data[0]);
    }).catch(() => {});
  }, []);

  const load = useCallback(async (buildingId: string, isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    try {
      const data = await api('GET', `/api/syndic/buildings/${buildingId}/requests`);
      setRequests(data || []);
    } catch {
      setRequests([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { if (active) load(active.id); }, [active]);

  function openDetail(r: Request) {
    setSelected(r);
    setNote(r.syndic_note || '');
  }

  async function saveUpdate(status?: string) {
    if (!selected) return;
    const payload: Record<string, string> = {};
    if (status) payload.status = status;
    if (note.trim() !== (selected.syndic_note || '')) payload.syndic_note = note.trim();
    if (!Object.keys(payload).length) { setSelected(null); return; }
    setSaving(true);
    try {
      await api('PUT', `/api/syndic/requests/${selected.id}`, payload);
      setSelected(null);
      if (active) load(active.id);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  }

  const openCount = requests.filter(r => r.status === 'open' || r.status === 'in_progress').length;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Requests</Text>
          <Text style={styles.sub}>Co-owner tickets & complaints</Text>
        </View>
        {openCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{openCount} open</Text>
          </View>
        )}
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
          {requests.length === 0 ? (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIconWrap}><TicketIcon size={28} color="#38bdf8" strokeWidth={1.5} /></View>
              <Text style={styles.emptyTitle}>No requests yet</Text>
              <Text style={styles.emptySub}>Co-owner requests will appear here once they submit through the portal.</Text>
            </View>
          ) : (
            requests.map(r => (
              <TouchableOpacity key={r.id} style={styles.card} activeOpacity={0.75} onPress={() => openDetail(r)}>
                <View style={styles.cardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle} numberOfLines={2}>{r.subject}</Text>
                    <Text style={styles.cardOwner}>
                      {r.syndic_owners?.name || '—'}{r.syndic_owners?.unit_number ? ` · Unit ${r.syndic_owners.unit_number}` : ''}
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: (STATUS_COLOR[r.status] ?? '#94a3b8') + '22' }]}>
                    <Text style={[styles.statusText, { color: STATUS_COLOR[r.status] ?? '#94a3b8' }]}>
                      {STATUS_LABEL[r.status] ?? r.status}
                    </Text>
                  </View>
                </View>

                {r.description ? (
                  <Text style={styles.cardDesc} numberOfLines={2}>{r.description}</Text>
                ) : null}

                <View style={styles.cardFooter}>
                  <View style={[styles.typePill, { backgroundColor: (TYPE_COLOR[r.type] ?? '#94a3b8') + '22' }]}>
                    <Text style={[styles.typePillText, { color: TYPE_COLOR[r.type] ?? '#94a3b8' }]}>{r.type}</Text>
                  </View>
                  <View style={[styles.typePill, { backgroundColor: (PRIORITY_COLOR[r.priority] ?? '#94a3b8') + '22' }]}>
                    <Text style={[styles.typePillText, { color: PRIORITY_COLOR[r.priority] ?? '#94a3b8' }]}>{r.priority}</Text>
                  </View>
                  <Text style={styles.footerDate}>{new Date(r.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</Text>
                </View>

                {r.syndic_note ? (
                  <View style={styles.noteRow}>
                    <Text style={styles.noteLabel}>Your note: </Text>
                    <Text style={styles.noteText} numberOfLines={1}>{r.syndic_note}</Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      )}

      {/* Detail / Reply modal */}
      <Modal visible={!!selected} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setSelected(null)}>
          <Pressable style={styles.modalSheet} onPress={e => e.stopPropagation()}>
            {selected && (
              <>
                <View style={styles.modalHandle} />
                <Text style={styles.modalTitle} numberOfLines={2}>{selected.subject}</Text>
                <Text style={styles.modalOwner}>
                  {selected.syndic_owners?.name || '—'}{selected.syndic_owners?.unit_number ? ` · Unit ${selected.syndic_owners.unit_number}` : ''}
                </Text>

                {selected.description ? (
                  <Text style={styles.modalDesc}>{selected.description}</Text>
                ) : null}

                <Text style={styles.modalSectionLabel}>Update status</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {(['open', 'in_progress', 'resolved', 'closed'] as const).map(s => (
                      <TouchableOpacity
                        key={s}
                        style={[styles.statusBtn, selected.status === s && { backgroundColor: (STATUS_COLOR[s] ?? '#94a3b8') + '33', borderColor: STATUS_COLOR[s] ?? '#94a3b8' }]}
                        onPress={() => saveUpdate(s)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.statusBtnText, { color: selected.status === s ? STATUS_COLOR[s] : colors.muted }]}>
                          {STATUS_LABEL[s]}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>

                <Text style={styles.modalSectionLabel}>Reply note</Text>
                <TextInput
                  style={styles.noteInput}
                  value={note}
                  onChangeText={setNote}
                  placeholder="Add a note for the co-owner…"
                  placeholderTextColor={colors.muted}
                  multiline
                  numberOfLines={3}
                />

                <TouchableOpacity
                  style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                  onPress={() => saveUpdate()}
                  disabled={saving}
                  activeOpacity={0.8}
                >
                  <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save note & notify co-owner'}</Text>
                </TouchableOpacity>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
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
    badge: { backgroundColor: 'rgba(239,68,68,0.12)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
    badgeText: { fontFamily: 'Inter_600SemiBold', fontSize: 11, color: '#f87171' },
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
    cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 6 },
    cardTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: colors.text, lineHeight: 20 },
    cardOwner: { fontFamily: 'Inter_400Regular', fontSize: 11, color: colors.muted, marginTop: 2 },
    statusBadge: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 20, alignSelf: 'flex-start' },
    statusText: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
    cardDesc: { fontFamily: 'Inter_400Regular', fontSize: 12, color: colors.muted, lineHeight: 17, marginBottom: 10 },
    cardFooter: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' },
    typePill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 },
    typePillText: { fontFamily: 'Inter_600SemiBold', fontSize: 10, textTransform: 'capitalize' },
    footerDate: { fontFamily: 'Inter_400Regular', fontSize: 11, color: colors.muted, marginLeft: 'auto' },
    noteRow: { flexDirection: 'row', marginTop: 10, backgroundColor: 'rgba(245,158,11,0.06)', borderLeftWidth: 3, borderLeftColor: colors.amber, borderRadius: 4, padding: 8 },
    noteLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 11, color: colors.amber },
    noteText: { fontFamily: 'Inter_400Regular', fontSize: 11, color: colors.muted, flex: 1 },
    // modal
    modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalSheet: {
      backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24,
      padding: 24, paddingBottom: 40, borderWidth: 1, borderColor: colors.border,
    },
    modalHandle: { width: 36, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
    modalTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 16, color: colors.text, marginBottom: 4 },
    modalOwner: { fontFamily: 'Inter_400Regular', fontSize: 12, color: colors.muted, marginBottom: 12 },
    modalDesc: { fontFamily: 'Inter_400Regular', fontSize: 13, color: colors.muted, lineHeight: 18, marginBottom: 16 },
    modalSectionLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 11, color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 },
    statusBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg2 },
    statusBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
    noteInput: {
      backgroundColor: colors.bg2, borderWidth: 1, borderColor: colors.border,
      borderRadius: 10, padding: 12, fontFamily: 'Inter_400Regular', fontSize: 13,
      color: colors.text, minHeight: 80, textAlignVertical: 'top', marginBottom: 16,
    },
    saveBtn: { backgroundColor: colors.navy, borderRadius: 12, padding: 14, alignItems: 'center' },
    saveBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#fff' },
  });
}
