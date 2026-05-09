import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert, Modal, Pressable, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { ThemeColors } from '../constants/colors';
import { api } from '../lib/api';
import BuildingDropdown from '../components/BuildingDropdown';
import { ChevronRightIcon } from '../components/Icons';

interface Building { id: string; name: string; }
interface Owner { id: string; name: string; unit_number?: string; }
interface Payment {
  id: string; owner_id: string; period: string; amount_due: number;
  amount_paid: number; status: string; due_date?: string;
  syndic_owners?: Owner;
}

function fmtEur(n: number | string) {
  return '€' + parseFloat(String(n || 0)).toLocaleString('fr-BE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function currentPeriod() {
  const now = new Date();
  return `${now.getFullYear()}-Q${Math.ceil((now.getMonth() + 1) / 3)}`;
}

function buildPeriods() {
  const yr = new Date().getFullYear();
  const opts: string[] = [];
  for (let y = yr + 1; y >= yr - 1; y--)
    for (let q = 4; q >= 1; q--) opts.push(`${y}-Q${q}`);
  return opts;
}

// ── Period dropdown ──────────────────────────────────────────────────────────
function PeriodDropdown({ period, periods, colors, onSelect }: {
  period: string; periods: string[]; colors: ThemeColors; onSelect: (p: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const s = useMemo(() => periodStyles(colors), [colors]);
  return (
    <>
      <TouchableOpacity style={s.trigger} onPress={() => setOpen(true)} activeOpacity={0.7}>
        <Text style={s.triggerText}>{period}</Text>
        <View style={s.chevron}><ChevronRightIcon size={13} color={colors.muted} strokeWidth={2.5} /></View>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={s.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={s.sheet} onPress={e => e.stopPropagation()}>
            <Text style={s.sheetTitle}>Select period</Text>
            <FlatList
              data={periods}
              keyExtractor={p => p}
              ItemSeparatorComponent={() => <View style={s.sep} />}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[s.option, item === period && s.optionActive]}
                  onPress={() => { onSelect(item); setOpen(false); }}
                  activeOpacity={0.7}
                >
                  <Text style={[s.optionText, item === period && s.optionTextActive]}>{item}</Text>
                  {item === period && <View style={s.checkDot} />}
                </TouchableOpacity>
              )}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function periodStyles(colors: ThemeColors) {
  return StyleSheet.create({
    trigger: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      backgroundColor: colors.bg2, borderRadius: 10, paddingHorizontal: 12,
      paddingVertical: 7, alignSelf: 'flex-start', borderWidth: 1, borderColor: colors.border,
    },
    triggerText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: colors.text },
    chevron: { transform: [{ rotate: '90deg' }] },
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', paddingHorizontal: 32 },
    sheet: {
      backgroundColor: colors.card, borderRadius: 16, paddingVertical: 8,
      borderWidth: 1, borderColor: colors.border, maxHeight: 360,
      shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 20, shadowOffset: { width: 0, height: 8 },
    },
    sheetTitle: {
      fontFamily: 'Inter_600SemiBold', fontSize: 11, color: colors.muted,
      paddingHorizontal: 16, paddingVertical: 10, textTransform: 'uppercase', letterSpacing: 0.5,
    },
    sep: { height: 1, backgroundColor: colors.border, marginHorizontal: 16 },
    option: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 13 },
    optionActive: { backgroundColor: 'rgba(245,158,11,0.07)' },
    optionText: { fontFamily: 'Inter_500Medium', fontSize: 14, color: colors.text },
    optionTextActive: { fontFamily: 'Inter_600SemiBold', color: colors.amber },
    checkDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.amber },
  });
}

// ── Main screen ──────────────────────────────────────────────────────────────
export default function ChargesScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
    paid:    { bg: 'rgba(22,163,74,0.12)',  color: colors.green,  label: 'Paid' },
    pending: { bg: 'rgba(245,158,11,0.12)', color: colors.amber2, label: 'Pending' },
    late:    { bg: 'rgba(220,38,38,0.12)',  color: colors.red,    label: 'Late' },
    overdue: { bg: 'rgba(220,38,38,0.12)',  color: colors.red,    label: 'Overdue' },
    legal:   { bg: 'rgba(220,38,38,0.12)',  color: colors.red,    label: 'Legal' },
  };

  const [buildings, setBuildings]   = useState<Building[]>([]);
  const [activeBld, setActiveBld]   = useState<Building | null>(null);
  const [payments, setPayments]     = useState<Payment[]>([]);
  const [period, setPeriod]         = useState(currentPeriod());
  const [periods]                   = useState(buildPeriods());
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionId, setActionId]     = useState<string | null>(null);

  useEffect(() => { loadBuildings(); }, []);
  useEffect(() => { if (activeBld) loadPayments(activeBld.id, period); }, [activeBld, period]);

  async function loadBuildings() {
    try {
      const data = await api('GET', '/api/syndic/buildings');
      const blds: Building[] = data.buildings || data || [];
      setBuildings(blds);
      if (blds.length) setActiveBld(blds[0]);
    } catch (e) { console.error(e); }
  }

  async function loadPayments(bldId: string, p: string) {
    setLoading(true);
    try {
      const data = await api('GET', `/api/syndic/buildings/${bldId}/payments?period=${p}`);
      setPayments(data.payments || data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  }

  async function markPaid(paymentId: string, amountDue?: number) {
    setActionId(paymentId);
    try {
      await api('PUT', `/api/syndic/payments/${paymentId}`, {
        status: 'paid',
        amount_paid: amountDue,
      });
      if (activeBld) loadPayments(activeBld.id, period);
    } catch (e: any) { Alert.alert('Error', e.message); }
    finally { setActionId(null); }
  }

  async function sendReminder(paymentId: string) {
    setActionId(paymentId);
    try {
      await api('POST', `/api/syndic/payments/${paymentId}/reminder`, { level: 1 });
      Alert.alert('Reminder sent', 'The co-owner will receive a reminder email.');
    } catch (e: any) { Alert.alert('Error', e.message); }
    finally { setActionId(null); }
  }

  const paid      = payments.filter(p => p.status === 'paid').length;
  const overdue   = payments.filter(p => p.status === 'overdue' || p.status === 'late').length;
  const total     = payments.reduce((s, p) => s + parseFloat(String(p.amount_due || 0)), 0);
  const collected = payments.filter(p => p.status === 'paid').reduce((s, p) => s + parseFloat(String(p.amount_paid || 0)), 0);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={styles.title}>Charges</Text>
        <View style={styles.headerRow}>
          <BuildingDropdown buildings={buildings} active={activeBld} onSelect={setActiveBld} noTopMargin />
          <PeriodDropdown period={period} periods={periods} colors={colors} onSelect={setPeriod} />
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); if (activeBld) loadPayments(activeBld.id, period); }} tintColor={colors.amber} />}
      >
        {/* ── KPI row ── */}
        {!loading && payments.length > 0 && (
          <View style={styles.kpiRow}>
            <View style={styles.kpi}>
              <Text style={styles.kpiVal}>{paid}/{payments.length}</Text>
              <Text style={styles.kpiLabel}>Paid</Text>
            </View>
            <View style={[styles.kpi, styles.kpiDivider]}>
              <Text style={[styles.kpiVal, { color: overdue > 0 ? colors.red : colors.green }]}>{overdue}</Text>
              <Text style={styles.kpiLabel}>Overdue</Text>
            </View>
            <View style={[styles.kpi, styles.kpiDivider]}>
              <Text style={styles.kpiVal}>{fmtEur(collected)}</Text>
              <Text style={styles.kpiLabel}>Collected</Text>
            </View>
            <View style={[styles.kpi, styles.kpiDivider]}>
              <Text style={styles.kpiVal}>{fmtEur(total)}</Text>
              <Text style={styles.kpiLabel}>Total due</Text>
            </View>
          </View>
        )}

        {/* ── Content ── */}
        {loading && !refreshing ? (
          <View style={{ paddingTop: 60, alignItems: 'center' }}>
            <ActivityIndicator color={colors.amber} size="large" />
          </View>
        ) : payments.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No charges for {period}</Text>
            <Text style={styles.emptySub}>Generate a charge period from the web app</Text>
          </View>
        ) : (
          payments.map(p => {
            const st = STATUS_STYLE[p.status] || { bg: 'rgba(30,58,95,0.06)', color: colors.muted, label: p.status };
            const outstanding = parseFloat(String(p.amount_due || 0)) - parseFloat(String(p.amount_paid || 0));
            const ownerName = p.syndic_owners?.name || '—';
            const unitNum   = p.syndic_owners?.unit_number || '—';
            const avatarLetters = ownerName !== '—'
              ? ownerName.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)
              : '?';
            return (
              <View key={p.id} style={styles.card}>
                <View style={styles.cardRow}>
                  <View style={styles.cardAvatar}>
                    <Text style={styles.cardAvatarText}>{avatarLetters}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardName}>{ownerName}</Text>
                    <Text style={styles.cardUnit}>Unit {unitNum}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
                    <Text style={[styles.statusText, { color: st.color }]}>{st.label}</Text>
                  </View>
                </View>

                <View style={styles.amountRow}>
                  <View>
                    <Text style={styles.amountLabel}>Amount due</Text>
                    <Text style={styles.amountVal}>{fmtEur(p.amount_due)}</Text>
                  </View>
                  <View>
                    <Text style={styles.amountLabel}>Paid</Text>
                    <Text style={[styles.amountVal, { color: colors.green }]}>{fmtEur(p.amount_paid)}</Text>
                  </View>
                  <View>
                    <Text style={styles.amountLabel}>Outstanding</Text>
                    <Text style={[styles.amountVal, { color: outstanding > 0 ? colors.red : colors.green }]}>{fmtEur(outstanding)}</Text>
                  </View>
                </View>

                {p.status !== 'paid' && (
                  <View style={styles.cardActions}>
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.actionBtnPrimary, actionId === p.id && { opacity: 0.6 }]}
                      onPress={() => markPaid(p.id, p.amount_due)}
                      disabled={actionId === p.id}
                    >
                      <Text style={styles.actionBtnPrimaryText}>✓ Mark paid</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionBtn, actionId === p.id && { opacity: 0.6 }]}
                      onPress={() => sendReminder(p.id)}
                      disabled={actionId === p.id}
                    >
                      <Text style={styles.actionBtnText}>Send reminder</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })
        )}
        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    safe:    { flex: 1, backgroundColor: colors.bg },
    header:  { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
    title:   { fontFamily: 'CormorantGaramond_600SemiBold', fontSize: 30, color: colors.text },
    headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 8 },
    kpiRow: { flexDirection: 'row', backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border, marginBottom: 8 },
    kpi:    { flex: 1, paddingVertical: 12, alignItems: 'center' },
    kpiDivider: { borderLeftWidth: 1, borderLeftColor: colors.border },
    kpiVal: { fontFamily: 'Inter_700Bold', fontSize: 15, color: colors.text },
    kpiLabel: { fontFamily: 'Inter_400Regular', fontSize: 10, color: colors.muted, marginTop: 2 },
    card: { backgroundColor: colors.card, marginHorizontal: 16, marginTop: 10, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.border },
    cardRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
    cardAvatar: { width: 38, height: 38, borderRadius: 10, backgroundColor: 'rgba(30,58,95,0.12)', alignItems: 'center', justifyContent: 'center' },
    cardAvatarText: { fontFamily: 'Inter_700Bold', fontSize: 13, color: colors.text },
    cardName: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: colors.text },
    cardUnit: { fontFamily: 'Inter_400Regular', fontSize: 11, color: colors.muted, marginTop: 1 },
    statusBadge: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 99 },
    statusText: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
    amountRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.border, marginBottom: 8 },
    amountLabel: { fontFamily: 'Inter_400Regular', fontSize: 10, color: colors.muted, marginBottom: 2 },
    amountVal: { fontFamily: 'Inter_700Bold', fontSize: 14, color: colors.text },
    cardActions: { flexDirection: 'row', gap: 8, marginTop: 4 },
    actionBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: colors.border, alignItems: 'center', backgroundColor: colors.bg },
    actionBtnPrimary: { backgroundColor: colors.navy, borderColor: colors.navy },
    actionBtnPrimaryText: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: '#fff' },
    actionBtnText: { fontFamily: 'Inter_500Medium', fontSize: 12, color: colors.text },
    empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 40 },
    emptyText: { fontFamily: 'Inter_600SemiBold', fontSize: 16, color: colors.text, marginBottom: 8 },
    emptySub: { fontFamily: 'Inter_400Regular', fontSize: 13, color: colors.muted, textAlign: 'center', lineHeight: 20 },
  });
}
