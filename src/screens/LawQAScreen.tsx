import React, { useMemo, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { ThemeColors } from '../constants/colors';
import { api } from '../lib/api';
import { ScalesIcon } from '../components/Icons';

interface Message { role: 'user' | 'ai'; text: string; }

const SUGGESTED = [
  'What is the quorum for a general assembly?',
  'How much must go into the reserve fund each year?',
  'Can the syndic act without AG approval?',
  'What are the rules for urgent works?',
];

export default function LawQAScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput]       = useState('');
  const [loading, setLoading]   = useState(false);
  const scrollRef               = useRef<ScrollView>(null);

  async function ask(question?: string) {
    const q = (question || input).trim();
    if (!q || loading) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: q }]);
    setLoading(true);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    try {
      const data = await api('POST', '/api/syndic/law-qa', { question: q, lang: 'en' });
      setMessages(prev => [...prev, { role: 'ai', text: data.answer || 'No answer received.' }]);
    } catch (e: any) {
      setMessages(prev => [...prev, { role: 'ai', text: 'Sorry, something went wrong. Please try again.' }]);
    } finally {
      setLoading(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>AI Law Q&A</Text>
          <Text style={styles.sub}>Belgian VME co-ownership law</Text>
        </View>
        <View style={styles.aiBadge}><Text style={styles.aiBadgeText}>✦ Sage AI</Text></View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0}>
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
          showsVerticalScrollIndicator={false}
        >
          {messages.length === 0 ? (
            <View>
              <View style={styles.emptyCard}>
                <View style={styles.emptyIconWrap}><ScalesIcon size={28} color="#a78bfa" strokeWidth={1.5} /></View>
                <Text style={styles.emptyTitle}>Ask anything about Belgian VME law</Text>
                <Text style={styles.emptySub}>Sage AI knows articles 577-2 to 577-14 of the Belgian Civil Code and the Wet van 18 juni 2018.</Text>
              </View>
              <Text style={styles.suggestLabel}>Suggested questions</Text>
              {SUGGESTED.map((s, i) => (
                <TouchableOpacity key={i} style={styles.suggestItem} onPress={() => ask(s)} activeOpacity={0.7}>
                  <Text style={styles.suggestText}>{s}</Text>
                  <Text style={styles.suggestArrow}>→</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            messages.map((m, i) => (
              <View key={i} style={[styles.bubble, m.role === 'user' ? styles.bubbleUser : styles.bubbleAi]}>
                {m.role === 'ai' && <Text style={styles.bubbleLabel}>✦ Sage AI</Text>}
                <Text style={m.role === 'user' ? styles.bubbleTextUser : styles.bubbleTextAi}>{m.text}</Text>
              </View>
            ))
          )}
          {loading && (
            <View style={[styles.bubble, styles.bubbleAi]}>
              <Text style={styles.bubbleLabel}>✦ Sage AI</Text>
              <ActivityIndicator color={colors.amber} size="small" style={{ marginTop: 4 }} />
            </View>
          )}
        </ScrollView>

        {/* Input */}
        <View style={styles.inputWrap}>
          <TextInput
            style={styles.input}
            placeholder="Ask a legal question…"
            placeholderTextColor={colors.muted}
            value={input}
            onChangeText={setInput}
            multiline
            returnKeyType="send"
            onSubmitEditing={() => ask()}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!input.trim() || loading) && { opacity: 0.4 }]}
            onPress={() => ask()}
            disabled={!input.trim() || loading}
          >
            <Text style={styles.sendBtnText}>→</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
    aiBadge: { backgroundColor: 'rgba(245,158,11,0.12)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
    aiBadgeText: { fontFamily: 'Inter_600SemiBold', fontSize: 11, color: colors.amber },
    emptyCard: {
      backgroundColor: colors.card, borderRadius: 16, padding: 20,
      borderWidth: 1, borderColor: colors.border, alignItems: 'center',
      marginBottom: 24,
    },
    emptyIconWrap: { width: 64, height: 64, borderRadius: 18, backgroundColor: 'rgba(124,58,237,0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
    emptyTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: colors.text, textAlign: 'center', marginBottom: 8 },
    emptySub: { fontFamily: 'Inter_400Regular', fontSize: 13, color: colors.muted, textAlign: 'center', lineHeight: 19 },
    suggestLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 11, color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10 },
    suggestItem: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: colors.card, borderRadius: 12, padding: 14,
      borderWidth: 1, borderColor: colors.border, marginBottom: 8,
    },
    suggestText: { fontFamily: 'Inter_500Medium', fontSize: 13, color: colors.text, flex: 1, lineHeight: 18 },
    suggestArrow: { fontFamily: 'Inter_600SemiBold', fontSize: 16, color: colors.amber, marginLeft: 8 },
    bubble: { borderRadius: 14, padding: 12, marginBottom: 10, maxWidth: '88%' },
    bubbleUser: { backgroundColor: colors.navy, alignSelf: 'flex-end' },
    bubbleAi: {
      backgroundColor: colors.card, alignSelf: 'flex-start',
      borderWidth: 1, borderColor: colors.border,
    },
    bubbleLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 10, color: colors.amber, marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.4 },
    bubbleTextUser: { fontFamily: 'Inter_400Regular', fontSize: 14, color: '#fff', lineHeight: 20 },
    bubbleTextAi: { fontFamily: 'Inter_400Regular', fontSize: 14, color: colors.text, lineHeight: 21 },
    inputWrap: {
      flexDirection: 'row', alignItems: 'flex-end', gap: 10,
      paddingHorizontal: 16, paddingVertical: 12,
      borderTopWidth: 1, borderTopColor: colors.border,
      backgroundColor: colors.card,
    },
    input: {
      flex: 1, backgroundColor: colors.bg, borderRadius: 12,
      paddingHorizontal: 14, paddingVertical: 10,
      fontFamily: 'Inter_400Regular', fontSize: 14, color: colors.text,
      borderWidth: 1, borderColor: colors.border, maxHeight: 100,
    },
    sendBtn: {
      width: 42, height: 42, borderRadius: 12,
      backgroundColor: colors.amber, alignItems: 'center', justifyContent: 'center',
    },
    sendBtnText: { fontSize: 18, color: '#fff', fontWeight: '700' },
  });
}
