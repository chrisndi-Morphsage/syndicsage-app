import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, ActivityIndicator, Modal, Pressable, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { ThemeColors } from '../constants/colors';
import { api } from '../lib/api';
import { supabase } from '../lib/supabase';
import {
  CheckIcon, MailIcon, FolderIcon, ShieldIcon,
  AlertIcon, MoonIcon, SunIcon, ArrowRightIcon,
} from '../components/Icons';

interface Building {
  id: string; name: string; unit_count: number; city?: string;
  ag_date?: string; reserve_fund_balance?: number; annual_budget?: number;
}
interface Payment { status: string; amount_due?: number; paid_at?: string; owner_name?: string; unit_number?: string; amount?: number; }
interface Expense { created_at: string; supplier?: string; description?: string; amount?: number; }
interface Claim { status: string; }

// ── pulsing dot ──────────────────────────────────────────────────────────────
function PulseDot({ color }: { color: string }) {
  const anim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 0.3, duration: 1000, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 1,   duration: 1000, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return <Animated.View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color, opacity: anim }} />;
}

// ── building picker modal ────────────────────────────────────────────────────
function BuildingPicker({
  visible, buildings, active, colors, onSelect, onClose,
}: {
  visible: boolean; buildings: Building[]; active: Building | null;
  colors: ThemeColors; onSelect: (b: Building) => void; onClose: () => void;
}) {
  const s = useMemo(() => pickerStyles(colors), [colors]);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose}>
        <Pressable style={s.sheet} onPress={e => e.stopPropagation()}>
          <Text style={s.sheetTitle}>Select building</Text>
          {buildings.map((b, i) => (
            <TouchableOpacity
              key={b.id}
              style={[s.row, i < buildings.length - 1 && s.rowBorder, active?.id === b.id && s.rowActive]}
              onPress={() => { onSelect(b); onClose(); }}
              activeOpacity={0.7}
            >
              <View style={[s.avatar, { backgroundColor: BUILDING_COLORS[i % BUILDING_COLORS.length] }]}>
                <Text style={s.avatarText}>{initials(b.name)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.rowName}>{b.name}</Text>
                <Text style={s.rowSub}>{b.unit_count} units{b.city ? ` · ${b.city}` : ''}</Text>
              </View>
              {active?.id === b.id && <View style={s.checkDot} />}
            </TouchableOpacity>
          ))}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const BUILDING_COLORS = ['#1E3A5F', '#059669', '#7c3aed', '#0891b2', '#d97706'];
function initials(name: string) {
  return name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
}

// ── main screen ──────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const { colors, isDark, toggleTheme } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [buildings, setBuildings]   = useState<Building[]>([]);
  const [active, setActive]         = useState<Building | null>(null);
  const [payments, setPayments]     = useState<Payment[]>([]);
  const [expenses, setExpenses]     = useState<Expense[]>([]);
  const [claims, setClaims]         = useState<Claim[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userName, setUserName]     = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);

  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const meta = session?.user?.user_metadata;
      const n = meta?.first_name || meta?.full_name?.split(' ')[0] || meta?.name || session?.user?.email?.split('@')[0] || '';
      setUserName(n ? n.charAt(0).toUpperCase() + n.slice(1) : '');
    });
    loadBuildings();
  }, []);

  useEffect(() => {
    if (active) loadBuildingData(active.id);
  }, [active]);

  async function loadBuildings() {
    try {
      const data = await api('GET', '/api/syndic/buildings');
      const blds: Building[] = data.buildings || data || [];
      setBuildings(blds);
      if (blds.length) setActive(blds[0]);
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  }

  async function loadBuildingData(bldId: string) {
    const period = currentPeriod();
    try {
      const [pData, cData, eData] = await Promise.all([
        api('GET', `/api/syndic/buildings/${bldId}/payments?period=${period}`).catch(() => []),
        api('GET', `/api/syndic/buildings/${bldId}/claims`).catch(() => []),
        api('GET', `/api/syndic/buildings/${bldId}/expenses`).catch(() => []),
      ]);
      setPayments(pData.payments || pData || []);
      setClaims(cData.claims || cData || []);
      setExpenses(eData.expenses || eData || []);
    } catch (e) { console.error(e); }
  }

  function currentPeriod() {
    const now = new Date();
    return `${now.getFullYear()}-Q${Math.ceil((now.getMonth() + 1) / 3)}`;
  }

  async function onRefresh() {
    setRefreshing(true);
    await loadBuildings();
    if (active) await loadBuildingData(active.id);
    setRefreshing(false);
  }

  // derived
  const paid     = payments.filter(p => p.status === 'paid').length;
  const overdue  = payments.filter(p => p.status === 'overdue' || p.status === 'late').length;
  const colPct   = payments.length > 0 ? Math.round(paid / payments.length * 100) : 0;
  const agDays   = active?.ag_date
    ? Math.ceil((new Date(active.ag_date + 'T00:00:00').getTime() - Date.now()) / 86400000) : null;
  const openClaims = claims.filter(c => c.status === 'open' || c.status === 'in_progress').length;
  const healthBad  = overdue > 0 || openClaims > 0;

  // attention items
  const attentionItems: { icon: React.ReactNode; title: string; sub: string }[] = [];
  if (overdue > 0) attentionItems.push({
    icon: <MailIcon size={15} color={colors.amber} />,
    title: `${overdue} overdue payment${overdue > 1 ? 's' : ''}`,
    sub: 'Send reminders from the Charges tab',
  });
  if (agDays !== null && agDays <= 30 && agDays >= 0) attentionItems.push({
    icon: <AlertIcon size={15} color={colors.amber} />,
    title: 'AG convocation due',
    sub: `Send by ${new Date(active!.ag_date! + 'T00:00:00').toLocaleDateString('fr-BE', { day: 'numeric', month: 'short' })} — ${agDays}d left`,
  });
  if (openClaims > 0) attentionItems.push({
    icon: <ShieldIcon size={15} color={colors.amber} />,
    title: `${openClaims} open insurance claim${openClaims > 1 ? 's' : ''}`,
    sub: 'Review from the web app',
  });

  if (loading) {
    return <View style={styles.loadingWrap}><ActivityIndicator color={colors.amber} size="large" /></View>;
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.amber} />}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>{greet}{userName ? ',' : ''}</Text>
            <Text style={styles.name}>
              {userName ? `${userName} · ` : ''}<Text style={styles.nameAccent}>SyndicSage</Text>
            </Text>
          </View>
          <TouchableOpacity onPress={toggleTheme} style={styles.themeBtn} activeOpacity={0.7}>
            {isDark
              ? <SunIcon size={17} color={colors.amber} strokeWidth={2} />
              : <MoonIcon size={17} color={colors.muted} strokeWidth={2} />
            }
          </TouchableOpacity>
        </View>

        {/* ── Building pill (dropdown) ── */}
        {active && (
          <TouchableOpacity
            style={styles.bldPill}
            onPress={() => buildings.length > 1 && setPickerOpen(true)}
            activeOpacity={buildings.length > 1 ? 0.7 : 1}
          >
            <View style={[styles.bldAvatar, { backgroundColor: BUILDING_COLORS[buildings.findIndex(b => b.id === active.id) % BUILDING_COLORS.length] }]}>
              <Text style={styles.bldAvatarText}>{initials(active.name)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.bldName}>{active.name}</Text>
              <Text style={styles.bldSub}>{active.unit_count} units{active.city ? ` · ${active.city}` : ''}</Text>
            </View>
            <View style={[styles.healthDot, { backgroundColor: healthBad ? colors.amber2 : colors.green }]} />
            {buildings.length > 1 && (
              <Text style={styles.chevronDown}>⌄</Text>
            )}
          </TouchableOpacity>
        )}

        {/* ── KPI 2×2 grid ── */}
        <View style={styles.kpiGrid}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Collection rate</Text>
            <Text style={[styles.kpiValue, { color: colors.green }]}>{colPct}%</Text>
            <Text style={styles.kpiSub}>{paid} / {payments.length} paid</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Overdue</Text>
            <Text style={[styles.kpiValue, { color: overdue > 0 ? colors.amber : colors.green }]}>{overdue}</Text>
            <Text style={styles.kpiSub}>{overdue > 0 ? 'owners late' : 'all paid'}</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Next AG</Text>
            <Text style={[styles.kpiValue, { color: colors.text }]}>{agDays !== null ? `${agDays}d` : '—'}</Text>
            <Text style={styles.kpiSub}>
              {active?.ag_date
                ? new Date(active.ag_date + 'T00:00:00').toLocaleDateString('fr-BE', { day: 'numeric', month: 'short' })
                : 'Not set'}
            </Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Open claims</Text>
            <Text style={[styles.kpiValue, { color: openClaims > 0 ? colors.red : colors.green }]}>{openClaims}</Text>
            <Text style={styles.kpiSub}>{openClaims > 0 ? 'in progress' : 'no open claims'}</Text>
          </View>
        </View>

        {/* ── Needs attention ── */}
        {attentionItems.length > 0 && (
          <View style={styles.attentionCard}>
            <View style={styles.attentionHeader}>
              <PulseDot color={colors.amber} />
              <Text style={styles.attentionTitle}>Needs your attention</Text>
            </View>
            {attentionItems.map((item, i) => (
              <TouchableOpacity
                key={i}
                style={[styles.attentionItem, i === attentionItems.length - 1 && { marginBottom: 0 }]}
                activeOpacity={0.7}
              >
                <View style={styles.attentionIcon}>{item.icon}</View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.attentionItemTitle}>{item.title}</Text>
                  <Text style={styles.attentionItemSub}>{item.sub}</Text>
                </View>
                <ArrowRightIcon size={13} color={colors.muted} />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* ── Recent activity ── */}
        <Text style={styles.sectionHeading}>Recent activity</Text>
        <View>
          {(() => {
            type ActivityItem = { date: string; title: string; sub: string; iconBg: string; icon: React.ReactNode; };
            const items: ActivityItem[] = [];
            payments.filter(p => p.status === 'paid' && p.paid_at).forEach(p => {
              items.push({
                date: p.paid_at!,
                title: 'Payment received',
                sub: [p.owner_name, p.unit_number ? `Unit ${p.unit_number}` : null].filter(Boolean).join(' — ') || 'Owner',
                iconBg: 'rgba(22,163,74,0.15)',
                icon: <CheckIcon size={15} color={colors.green} />,
              });
            });
            expenses.forEach(e => {
              items.push({
                date: e.created_at,
                title: 'Expense added',
                sub: [e.supplier, e.description].filter(Boolean).join(' — ') || 'Expense',
                iconBg: 'rgba(245,158,11,0.15)',
                icon: <FolderIcon size={15} color={colors.amber2} />,
              });
            });
            items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            const top = items.slice(0, 4);
            if (top.length === 0) {
              return <Text style={{ color: colors.muted, fontSize: 13, paddingVertical: 12 }}>No recent activity.</Text>;
            }
            return top.map((item, i) => {
              const diffMs = Date.now() - new Date(item.date).getTime();
              const diffH = Math.floor(diffMs / 3600000);
              const timeLabel = diffH < 1 ? 'now' : diffH < 24 ? `${diffH}h` : `${Math.floor(diffH / 24)}d`;
              return (
                <ActivityRow
                  key={i}
                  colors={colors}
                  iconBg={item.iconBg}
                  icon={item.icon}
                  title={item.title}
                  sub={item.sub}
                  time={timeLabel}
                  last={i === top.length - 1}
                />
              );
            });
          })()}
        </View>

        <View style={{ height: 36 }} />
      </ScrollView>

      {/* Building picker */}
      <BuildingPicker
        visible={pickerOpen}
        buildings={buildings}
        active={active}
        colors={colors}
        onSelect={b => { setActive(b); }}
        onClose={() => setPickerOpen(false)}
      />
    </SafeAreaView>
  );
}

// ── Activity row ─────────────────────────────────────────────────────────────
function ActivityRow({ colors, iconBg, icon, title, sub, time, last }: {
  colors: ThemeColors; iconBg: string; icon: React.ReactNode;
  title: string; sub: string; time: string; last?: boolean;
}) {
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 12,
      paddingHorizontal: 24, paddingVertical: 12,
      borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.border,
    }}>
      <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: iconBg, alignItems: 'center', justifyContent: 'center' }}>
        {icon}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 13, color: colors.text }}>{title}</Text>
        <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 11, color: colors.muted, marginTop: 2 }}>{sub}</Text>
      </View>
      <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 11, color: colors.muted }}>{time}</Text>
    </View>
  );
}

// ── Picker styles ─────────────────────────────────────────────────────────────
function pickerStyles(colors: ThemeColors) {
  return StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', paddingHorizontal: 28 },
    sheet: {
      backgroundColor: colors.card, borderRadius: 18, paddingVertical: 8,
      borderWidth: 1, borderColor: colors.border,
      shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 24, shadowOffset: { width: 0, height: 10 },
    },
    sheetTitle: {
      fontFamily: 'Inter_600SemiBold', fontSize: 11, color: colors.muted,
      paddingHorizontal: 18, paddingTop: 10, paddingBottom: 8,
      textTransform: 'uppercase', letterSpacing: 0.6,
    },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingVertical: 14 },
    rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
    rowActive: { backgroundColor: 'rgba(245,158,11,0.06)' },
    avatar: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    avatarText: { fontFamily: 'Inter_700Bold', fontSize: 12, color: '#fff' },
    rowName: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: colors.text },
    rowSub: { fontFamily: 'Inter_400Regular', fontSize: 11, color: colors.muted, marginTop: 1 },
    checkDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.amber },
  });
}

// ── Screen styles ─────────────────────────────────────────────────────────────
function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },

    // header
    header: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 24, paddingTop: 8, paddingBottom: 20 },
    greeting: { fontFamily: 'Inter_400Regular', fontSize: 13, color: colors.muted, marginBottom: 2 },
    name: { fontFamily: 'Inter_700Bold', fontSize: 22, color: colors.text },
    nameAccent: { color: colors.amber, fontFamily: 'CormorantGaramond_600SemiBold', fontSize: 24 },
    themeBtn: {
      width: 36, height: 36, borderRadius: 10,
      backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
      alignItems: 'center', justifyContent: 'center', marginTop: 4,
    },

    // building pill
    bldPill: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
      borderRadius: 12, padding: 10, paddingHorizontal: 14,
      marginHorizontal: 24, marginBottom: 20,
    },
    bldAvatar: {
      width: 28, height: 28, borderRadius: 8,
      alignItems: 'center', justifyContent: 'center',
    },
    bldAvatarText: { fontFamily: 'Inter_700Bold', fontSize: 10, color: '#fff' },
    bldName: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: colors.text },
    bldSub: { fontFamily: 'Inter_400Regular', fontSize: 11, color: colors.muted },
    healthDot: { width: 7, height: 7, borderRadius: 4, flexShrink: 0 },
    chevronDown: { fontSize: 18, color: colors.muted, lineHeight: 20, marginTop: 2 },

    // KPI grid
    kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 24, marginBottom: 20 },
    kpiCard: {
      width: '47.5%',
      backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
      borderRadius: 14, padding: 14,
    },
    kpiLabel: { fontFamily: 'Inter_400Regular', fontSize: 11, color: colors.muted, marginBottom: 6 },
    kpiValue: { fontFamily: 'CormorantGaramond_600SemiBold', fontSize: 28, lineHeight: 28 },
    kpiSub: { fontFamily: 'Inter_400Regular', fontSize: 11, color: colors.muted, marginTop: 4 },

    // attention
    attentionCard: {
      marginHorizontal: 24, marginBottom: 20,
      backgroundColor: 'rgba(245,158,11,0.06)',
      borderWidth: 1, borderColor: 'rgba(245,158,11,0.25)',
      borderRadius: 16, padding: 16,
    },
    attentionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
    attentionTitle: {
      fontFamily: 'Inter_600SemiBold', fontSize: 11, color: colors.amber,
      textTransform: 'uppercase', letterSpacing: 0.5,
    },
    attentionItem: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 10,
      padding: 10, paddingHorizontal: 12, marginBottom: 8,
    },
    attentionIcon: {
      width: 30, height: 30, borderRadius: 8,
      backgroundColor: 'rgba(245,158,11,0.15)',
      alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    },
    attentionItemTitle: { fontFamily: 'Inter_500Medium', fontSize: 13, color: colors.text },
    attentionItemSub: { fontFamily: 'Inter_400Regular', fontSize: 11, color: colors.muted, marginTop: 1 },

    // section
    sectionHeading: {
      fontFamily: 'Inter_600SemiBold', fontSize: 13, color: colors.muted,
      textTransform: 'uppercase', letterSpacing: 0.8,
      paddingHorizontal: 24, marginBottom: 12,
    },
  });
}
