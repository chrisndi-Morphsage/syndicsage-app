import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl, ActivityIndicator, Alert, TextInput, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import { useTheme } from '../context/ThemeContext';
import { useBuildingContext } from '../context/BuildingContext';
import { ThemeColors } from '../constants/colors';
import { api } from '../lib/api';
import { supabase } from '../lib/supabase';
import { SearchIcon, DocumentsIcon, UploadIcon } from '../components/Icons';

interface Doc { id: string; name: string; category: string; storage_path: string; size?: number; created_at: string; }
const CATS = ['All', 'Contracts', 'Minutes', 'Insurance', 'Legal', 'Other'];

function fmtSize(bytes?: number) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

export default function DocumentsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const DOC_ICON_COLORS: Record<string, string> = {
    Minutes:    colors.amber,
    Insurance:  '#38bdf8',
    Contracts:  colors.amber,
    Legal:      '#a78bfa',
    Compliance: colors.green,
    Other:      colors.muted,
  };

  const { active, loading: buildingsLoading } = useBuildingContext();
  const [docs, setDocs]             = useState<Doc[]>([]);
  const [cat, setCat]               = useState('All');
  const [loading, setLoading]       = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => { if (active?.id) loadData(); }, [active?.id]);

  async function loadData() {
    if (!active?.id) return;
    try {
      const data = await api('GET', `/api/syndic/buildings/${active.id}/documents`);
      setDocs(data.documents || data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  }

  async function openDoc(doc: Doc) {
    try {
      const { data, error } = await supabase.storage.from('syndic-documents').createSignedUrl(doc.storage_path, 60);
      if (error || !data?.signedUrl) throw error ?? new Error('No signed URL returned');
      await Linking.openURL(data.signedUrl);
    } catch (e: any) { Alert.alert('Error', e.message); }
  }

  async function uploadDoc() {
    if (!active?.id) return;
    const bldId = active.id;
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
      if (result.canceled) return;
      const file = result.assets[0];
      Alert.alert('Upload', `Upload "${file.name}"?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Upload', onPress: async () => {
            try {
              const { data: { session } } = await supabase.auth.getSession();
              const path = `${session?.user.id}/${bldId}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
              const response = await fetch(file.uri);
              const blob = await response.blob();
              const { error: upErr } = await supabase.storage.from('syndic-documents').upload(path, blob);
              if (upErr) throw upErr;
              await api('POST', `/api/syndic/buildings/${bldId}/documents`, { name: file.name, category: 'Other', storage_path: path, size: file.size });
              await loadData();
            } catch (e: any) { Alert.alert('Upload failed', e.message); }
          }
        },
      ]);
    } catch (e: any) { Alert.alert('Error', e.message); }
  }

  const filtered = docs
    .filter(d => cat === 'All' || d.category === cat)
    .filter(d => !search || d.name.toLowerCase().includes(search.toLowerCase()));

  if (buildingsLoading || loading) return <View style={styles.loading}><ActivityIndicator color={colors.amber} size="large" /></View>;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={{ flex: 1 }}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={colors.amber} />}
        >
          <View style={styles.header}>
            <Text style={styles.title}>Documents</Text>
            <Text style={styles.sub}>{active?.name || 'Your building'}</Text>
          </View>

          <View style={styles.searchWrap}>
            <SearchIcon size={16} color={colors.muted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search documents…"
              placeholderTextColor={colors.muted}
              value={search}
              onChangeText={setSearch}
              autoCorrect={false}
            />
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catsWrap} contentContainerStyle={{ paddingHorizontal: 24, gap: 8, paddingBottom: 16 }}>
            {CATS.map(c => (
              <TouchableOpacity key={c} style={[styles.cat, cat === c && styles.catActive]} onPress={() => setCat(c)}>
                <Text style={[styles.catText, cat === c && styles.catTextActive]}>{c}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {filtered.length === 0 ? (
            <View style={styles.empty}>
              <View style={styles.emptyIconWrap}>
                <DocumentsIcon size={28} color={colors.muted} strokeWidth={1.5} />
              </View>
              <Text style={styles.emptyText}>No documents</Text>
              <Text style={styles.emptySub}>Tap the upload button to add your first document</Text>
            </View>
          ) : filtered.map(doc => (
            <TouchableOpacity key={doc.id} style={styles.docItem} onPress={() => openDoc(doc)} activeOpacity={0.7}>
              <View style={styles.docIcon}>
                <DocumentsIcon size={18} color={DOC_ICON_COLORS[doc.category] || colors.muted} strokeWidth={1.8} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.docName} numberOfLines={1}>{doc.name}</Text>
                <Text style={styles.docMeta}>{doc.category} · {new Date(doc.created_at).toLocaleDateString('fr-BE', { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
              </View>
              <Text style={styles.docSize}>{fmtSize(doc.size)}</Text>
            </TouchableOpacity>
          ))}

          <View style={{ height: 100 }} />
        </ScrollView>

        <TouchableOpacity style={styles.fab} onPress={uploadDoc} activeOpacity={0.85}>
          <UploadIcon size={22} color="#fff" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
    header: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 12 },
    title: { fontFamily: 'CormorantGaramond_600SemiBold', fontSize: 30, color: colors.text },
    sub: { fontFamily: 'Inter_400Regular', fontSize: 13, color: colors.muted, marginTop: 2 },
    searchWrap: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      marginHorizontal: 24, marginBottom: 16,
      backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
      borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11,
    },
    searchInput: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 14, color: colors.text },
    catsWrap: { flexGrow: 0 },
    cat: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
    catActive: { backgroundColor: colors.amber, borderColor: colors.amber },
    catText: { fontFamily: 'Inter_500Medium', fontSize: 12, color: colors.muted },
    catTextActive: { color: '#0d1a2b' },
    docItem: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      paddingHorizontal: 24, paddingVertical: 12,
      borderBottomWidth: 1, borderBottomColor: colors.border,
      backgroundColor: colors.card,
    },
    docIcon: {
      width: 38, height: 38, borderRadius: 10,
      backgroundColor: colors.bg2, borderWidth: 1, borderColor: colors.border,
      alignItems: 'center', justifyContent: 'center',
    },
    docName: { fontFamily: 'Inter_500Medium', fontSize: 13, color: colors.text },
    docMeta: { fontFamily: 'Inter_400Regular', fontSize: 11, color: colors.muted, marginTop: 2 },
    docSize: { fontFamily: 'Inter_400Regular', fontSize: 11, color: colors.muted },
    empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 40 },
    emptyIconWrap: {
      width: 64, height: 64, borderRadius: 18,
      backgroundColor: 'rgba(30,58,95,0.08)', alignItems: 'center', justifyContent: 'center',
      marginBottom: 16,
    },
    emptyText: { fontFamily: 'Inter_600SemiBold', fontSize: 16, color: colors.text, marginBottom: 8 },
    emptySub: { fontFamily: 'Inter_400Regular', fontSize: 13, color: colors.muted, textAlign: 'center', lineHeight: 20 },
    fab: {
      position: 'absolute', bottom: 16, right: 20,
      width: 52, height: 52, borderRadius: 16,
      backgroundColor: colors.amber, alignItems: 'center', justifyContent: 'center',
      shadowColor: colors.amber, shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
    },
  });
}
