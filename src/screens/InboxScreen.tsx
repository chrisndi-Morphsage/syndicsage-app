import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, ActivityIndicator, TextInput, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useBuildingContext } from '../context/BuildingContext';
import { ThemeColors } from '../constants/colors';
import { api } from '../lib/api';
import { MailIcon, WrenchIcon } from '../components/Icons';
import BuildingDropdown from '../components/BuildingDropdown';

interface Building { id: string; name: string; }
interface Message {
  id: string; owner_id: string; sender_name: string; sender_role: 'syndic' | 'co_owner';
  subject?: string; body: string; read_by_syndic: boolean; created_at: string;
}
interface Request {
  id: string; owner_id: string; type: string; subject: string;
  description?: string; status: string; priority: string; created_at: string;
  syndic_owners?: { name: string; unit_number?: string; };
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('fr-BE', { day: 'numeric', month: 'short' });
}

export default function InboxScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const STATUS_COLOR: Record<string, string> = {
    open: colors.amber, in_progress: colors.cyan,
    resolved: colors.green, closed: colors.muted,
  };
  const PRIORITY_COLOR: Record<string, string> = {
    high: colors.red, medium: colors.amber, low: colors.green,
  };

  const { buildings, active: activeBld, setActive: setActiveBld, loading: buildingsLoading } = useBuildingContext();
  const [tab, setTab]               = useState<'messages' | 'requests'>('messages');
  const [messages, setMessages]     = useState<Message[]>([]);
  const [requests, setRequests]     = useState<Request[]>([]);
  const [loading, setLoading]       = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [replyId, setReplyId]       = useState<string | null>(null);
  const [replyText, setReplyText]   = useState('');
  const [sending, setSending]       = useState(false);

  useEffect(() => { if (activeBld) loadData(activeBld.id); }, [activeBld, tab]);

  async function loadData(bldId: string) {
    setLoading(true);
    try {
      if (tab === 'messages') {
        const data = await api('GET', `/api/syndic/buildings/${bldId}/portal-messages`);
        const byOwner = new Map<string, Message>();
        (data || []).forEach((m: Message) => {
          if (!byOwner.has(m.owner_id) || new Date(m.created_at) > new Date(byOwner.get(m.owner_id)!.created_at)) {
            byOwner.set(m.owner_id, m);
          }
        });
        setMessages(Array.from(byOwner.values()).sort((a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
      } else {
        const data = await api('GET', `/api/syndic/buildings/${bldId}/requests`);
        setRequests((data || []).sort((a: Request, b: Request) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  }

  async function sendReply() {
    if (!replyText.trim() || !replyId || !activeBld) return;
    setSending(true);
    try {
      await api('POST', `/api/syndic/buildings/${activeBld.id}/portal-messages`, {
        owner_id: replyId, body: replyText.trim(),
      });
      setReplyText(''); setReplyId(null);
      loadData(activeBld.id);
    } catch (e: any) { Alert.alert('Error', e.message); }
    finally { setSending(false); }
  }

  async function updateRequestStatus(req: Request, status: string) {
    if (!activeBld) return;
    try {
      await api('PUT', `/api/syndic/requests/${req.id}`, { status });
      loadData(activeBld.id);
    } catch (e: any) { Alert.alert('Error', e.message); }
  }

  const unreadCount  = messages.filter(m => m.sender_role === 'co_owner' && !m.read_by_syndic).length;
  const openRequests = requests.filter(r => r.status === 'open' || r.status === 'in_progress').length;

  if ((buildingsLoading || loading) && !refreshing) return (
    <View style={styles.loading}><ActivityIndicator color={colors.amber} size="large" /></View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Inbox</Text>
        <BuildingDropdown buildings={buildings} active={activeBld} onSelect={setActiveBld} />
        <View style={styles.tabs}>
          <TouchableOpacity style={[styles.tab, tab === 'messages' && styles.tabActive]} onPress={() => setTab('messages')}>
            <Text style={[styles.tabText, tab === 'messages' && styles.tabTextActive]}>
              Messages{unreadCount > 0 ? ` (${unreadCount})` : ''}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tab, tab === 'requests' && styles.tabActive]} onPress={() => setTab('requests')}>
            <Text style={[styles.tabText, tab === 'requests' && styles.tabTextActive]}>
              Requests{openRequests > 0 ? ` (${openRequests})` : ''}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); if (activeBld) loadData(activeBld.id); }} tintColor={colors.amber} />}
      >
        {tab === 'messages' ? (
          messages.length === 0 ? (
            <View style={styles.empty}>
              <View style={styles.emptyIconWrap}><MailIcon size={28} color={colors.muted} strokeWidth={1.5} /></View>
              <Text style={styles.emptyText}>No messages yet</Text>
              <Text style={styles.emptySub}>Co-owner messages will appear here</Text>
            </View>
          ) : messages.map(m => (
            <View key={m.id}>
              <TouchableOpacity
                style={[styles.item, m.sender_role === 'co_owner' && !m.read_by_syndic && styles.itemUnread]}
                activeOpacity={0.7}
                onPress={() => setReplyId(replyId === m.owner_id ? null : m.owner_id)}
              >
                <View style={[styles.avatar, { backgroundColor: m.sender_role === 'co_owner' ? 'rgba(245,158,11,0.12)' : 'rgba(30,58,95,0.12)' }]}>
                  <MailIcon size={16} color={m.sender_role === 'co_owner' ? colors.amber2 : colors.navy} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName}>{m.sender_name}</Text>
                  <Text style={styles.itemBody} numberOfLines={1}>{m.body}</Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Text style={styles.time}>{timeAgo(m.created_at)}</Text>
                  {m.sender_role === 'co_owner' && !m.read_by_syndic && <View style={styles.unreadDot} />}
                </View>
              </TouchableOpacity>
              {replyId === m.owner_id && (
                <View style={styles.replyBox}>
                  <TextInput
                    style={styles.replyInput}
                    placeholder="Type your reply…"
                    placeholderTextColor={colors.muted}
                    value={replyText}
                    onChangeText={setReplyText}
                    multiline
                  />
                  <TouchableOpacity
                    style={[styles.replyBtn, (!replyText.trim() || sending) && { opacity: 0.5 }]}
                    onPress={sendReply}
                    disabled={!replyText.trim() || sending}
                  >
                    <Text style={styles.replyBtnText}>{sending ? 'Sending…' : 'Send'}</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))
        ) : (
          requests.length === 0 ? (
            <View style={styles.empty}>
              <View style={styles.emptyIconWrap}><WrenchIcon size={28} color={colors.muted} strokeWidth={1.5} /></View>
              <Text style={styles.emptyText}>No requests yet</Text>
              <Text style={styles.emptySub}>Co-owner requests will appear here</Text>
            </View>
          ) : requests.map(req => (
            <View key={req.id} style={styles.requestCard}>
              <View style={styles.requestHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.requestSubject} numberOfLines={1}>{req.subject}</Text>
                  <Text style={styles.requestMeta}>
                    {req.syndic_owners?.name || 'Co-owner'}{req.syndic_owners?.unit_number ? ` · Unit ${req.syndic_owners.unit_number}` : ''}
                  </Text>
                </View>
                <View style={{ gap: 4, alignItems: 'flex-end' }}>
                  <View style={[styles.badge, { backgroundColor: (STATUS_COLOR[req.status] || colors.muted) + '22', borderColor: STATUS_COLOR[req.status] || colors.muted }]}>
                    <Text style={[styles.badgeText, { color: STATUS_COLOR[req.status] || colors.muted }]}>{req.status.replace('_', ' ')}</Text>
                  </View>
                  <View style={[styles.badge, { backgroundColor: (PRIORITY_COLOR[req.priority] || colors.muted) + '22', borderColor: PRIORITY_COLOR[req.priority] || colors.muted }]}>
                    <Text style={[styles.badgeText, { color: PRIORITY_COLOR[req.priority] || colors.muted }]}>{req.priority}</Text>
                  </View>
                </View>
              </View>
              {req.description ? <Text style={styles.requestDesc} numberOfLines={2}>{req.description}</Text> : null}
              <View style={styles.requestActions}>
                {req.status === 'open' && (
                  <TouchableOpacity style={styles.actionBtn} onPress={() => updateRequestStatus(req, 'in_progress')}>
                    <Text style={styles.actionBtnText}>In progress</Text>
                  </TouchableOpacity>
                )}
                {(req.status === 'open' || req.status === 'in_progress') && (
                  <TouchableOpacity style={[styles.actionBtn, styles.actionBtnGreen]} onPress={() => updateRequestStatus(req, 'resolved')}>
                    <Text style={[styles.actionBtnText, { color: colors.green }]}>Resolve</Text>
                  </TouchableOpacity>
                )}
                <Text style={[styles.time, { marginLeft: 'auto' }]}>{timeAgo(req.created_at)}</Text>
              </View>
            </View>
          ))
        )}
        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    safe:    { flex: 1, backgroundColor: colors.bg },
    loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
    header:  { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
    title:   { fontFamily: 'CormorantGaramond_600SemiBold', fontSize: 30, color: colors.text },
    tabs:    { flexDirection: 'row', marginTop: 10, gap: 4 },
    tab:     { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
    tabActive: { backgroundColor: 'rgba(30,58,95,0.08)' },
    tabText:   { fontFamily: 'Inter_500Medium', fontSize: 13, color: colors.muted },
    tabTextActive: { color: colors.amber, fontFamily: 'Inter_600SemiBold' },
    item:    { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.card },
    itemUnread: { backgroundColor: 'rgba(245,158,11,0.05)' },
    avatar:  { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    itemName: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: colors.text },
    itemBody: { fontFamily: 'Inter_400Regular', fontSize: 12, color: colors.muted, marginTop: 2 },
    time:    { fontFamily: 'Inter_400Regular', fontSize: 11, color: colors.muted },
    unreadDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.amber },
    replyBox: { backgroundColor: colors.card, paddingHorizontal: 20, paddingBottom: 12, paddingTop: 4, borderBottomWidth: 1, borderBottomColor: colors.border },
    replyInput: { backgroundColor: colors.bg, borderRadius: 10, padding: 10, fontFamily: 'Inter_400Regular', fontSize: 13, color: colors.text, minHeight: 60, marginBottom: 8 },
    replyBtn: { backgroundColor: colors.navy, borderRadius: 8, paddingVertical: 9, paddingHorizontal: 18, alignSelf: 'flex-end' },
    replyBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: '#fff' },
    requestCard: { backgroundColor: colors.card, marginHorizontal: 16, marginTop: 10, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.border },
    requestHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 6 },
    requestSubject: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: colors.text },
    requestMeta: { fontFamily: 'Inter_400Regular', fontSize: 11, color: colors.muted, marginTop: 2 },
    requestDesc: { fontFamily: 'Inter_400Regular', fontSize: 12, color: colors.muted, lineHeight: 18, marginBottom: 8 },
    requestActions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
    actionBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, backgroundColor: 'rgba(30,58,95,0.08)', borderWidth: 1, borderColor: colors.border },
    actionBtnGreen: { backgroundColor: 'rgba(22,163,74,0.08)', borderColor: colors.green },
    actionBtnText: { fontFamily: 'Inter_500Medium', fontSize: 11, color: colors.text },
    badge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 99, borderWidth: 1 },
    badgeText: { fontFamily: 'Inter_600SemiBold', fontSize: 10 },
    empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 40 },
    emptyIconWrap: { width: 64, height: 64, borderRadius: 18, backgroundColor: 'rgba(30,58,95,0.08)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
    emptyText: { fontFamily: 'Inter_600SemiBold', fontSize: 16, color: colors.text, marginBottom: 8 },
    emptySub: { fontFamily: 'Inter_400Regular', fontSize: 13, color: colors.muted, textAlign: 'center', lineHeight: 20 },
  });
}
