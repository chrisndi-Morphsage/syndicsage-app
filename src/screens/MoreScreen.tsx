import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { useTheme } from '../context/ThemeContext';
import { ThemeColors } from '../constants/colors';
import { supabase } from '../lib/supabase';
import {
  ChevronRightIcon, LockIcon, SignOutIcon, TrashIcon,
  UserIcon, MailIcon, VideoIcon, VoteIcon, ScalesIcon,
} from '../components/Icons';

export default function MoreScreen() {
  const navigation = useNavigation<any>();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [biometricEnabled, setBiometric] = useState(false);
  const [profileName, setProfileName]    = useState('');
  const [profileInitial, setProfileInitial] = useState('?');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return;
      const meta = session.user.user_metadata;
      const name = meta?.full_name || meta?.name || session.user.email?.split('@')[0] || '';
      setProfileName(name);
      setProfileInitial(name.charAt(0).toUpperCase() || '?');
    });
  }, []);

  async function handleSignOut() {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => supabase.auth.signOut() },
    ]);
  }

  async function handleDeleteAccount() {
    Alert.alert(
      'Delete account',
      'This will permanently delete your SyndicSage account and all associated data. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete my account', style: 'destructive', onPress: async () => {
            try {
              const { data: { session } } = await supabase.auth.getSession();
              if (!session) return;
              await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/syndic/account`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${session.access_token}` },
              });
              await supabase.auth.signOut();
            } catch (e: any) { Alert.alert('Error', e.message); }
          }
        },
      ]
    );
  }

  async function toggleBiometric(value: boolean) {
    if (value) {
      const result = await LocalAuthentication.authenticateAsync({ promptMessage: 'Enable Face ID / Touch ID' });
      if (result.success) { await SecureStore.setItemAsync('biometric_enabled', 'true'); setBiometric(true); }
    } else {
      await SecureStore.deleteItemAsync('biometric_enabled');
      setBiometric(false);
    }
  }

  // Icon accent colours matching the mockup exactly
  const AMBER_BG   = 'rgba(245,158,11,0.15)';
  const CYAN_BG    = 'rgba(8,145,178,0.15)';
  const PURPLE_BG  = 'rgba(124,58,237,0.15)';
  const MUTED_BG   = colors.bg2;
  const RED_BG     = 'rgba(220,38,38,0.12)';
  const CYAN_IC    = '#38bdf8';
  const PURPLE_IC  = '#a78bfa';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>More</Text>
        </View>

        <TouchableOpacity style={styles.profileCard} activeOpacity={0.8}>
          <View style={styles.profileAvatar}><Text style={styles.avatarText}>{profileInitial}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.profileName}>{profileName || '—'}</Text>
            <View style={styles.planBadge}><Text style={styles.planText}>Professional plan</Text></View>
          </View>
          <ChevronRightIcon size={18} color={colors.muted} />
        </TouchableOpacity>

        <Text style={styles.sectionLabel}>Tools</Text>
        <View style={styles.items}>
          <Item colors={colors} iconBg={AMBER_BG} icon={<VideoIcon size={16} color={colors.amber} />} label="AG Meeting Room" badge="Pro" onPress={() => navigation.navigate('MeetingRoom')} />
          <Item colors={colors} iconBg={CYAN_BG}  icon={<VoteIcon size={16} color={CYAN_IC} />} label="Digital Voting" onPress={() => navigation.navigate('Voting')} />
          <Item colors={colors} iconBg={PURPLE_BG} icon={<ScalesIcon size={16} color={PURPLE_IC} />} label="AI Law Q&A" onPress={() => navigation.navigate('LawQA')} />
        </View>

        <Text style={styles.sectionLabel}>Security</Text>
        <View style={styles.items}>
          <View style={styles.card}>
            <View style={[styles.iconWrap, { backgroundColor: MUTED_BG }]}><LockIcon size={16} color={colors.muted} /></View>
            <Text style={styles.itemLabel}>Face ID / Touch ID</Text>
            <Switch
              value={biometricEnabled}
              onValueChange={toggleBiometric}
              trackColor={{ false: colors.border, true: colors.amber }}
              thumbColor="#fff"
            />
          </View>
        </View>

        <Text style={styles.sectionLabel}>Account</Text>
        <View style={styles.items}>
          <Item colors={colors} iconBg={MUTED_BG} icon={<UserIcon size={16} color={colors.muted} />} label="Profile & settings" />
          <Item colors={colors} iconBg={MUTED_BG} icon={<MailIcon size={16} color={colors.muted} />} label="Gmail integration" rightText="Connected" rightColor={colors.green} />
          <Item colors={colors} iconBg={RED_BG} icon={<SignOutIcon size={16} color={colors.red} />} label="Sign out" labelColor={colors.red} onPress={handleSignOut} />
          <Item colors={colors} iconBg={RED_BG} icon={<TrashIcon size={16} color={colors.red} />} label="Delete account" labelColor={colors.red} onPress={handleDeleteAccount} />
        </View>

        <Text style={styles.version}>SyndicSage · v1.0.0</Text>
        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Item({ colors, icon, iconBg, label, badge, rightText, rightColor, labelColor, onPress }: {
  colors: ThemeColors; icon: React.ReactNode; iconBg: string; label: string;
  badge?: string; rightText?: string; rightColor?: string; labelColor?: string; onPress?: () => void;
}) {
  return (
    <TouchableOpacity style={[{
      flexDirection: 'row', alignItems: 'center', gap: 12,
      backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border,
      padding: 13, marginBottom: 8,
    }]} activeOpacity={0.7} onPress={onPress}>
      <View style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: iconBg, alignItems: 'center', justifyContent: 'center' }}>
        {icon}
      </View>
      <Text style={{ fontFamily: 'Inter_500Medium', flex: 1, fontSize: 14, color: labelColor || colors.text }}>{label}</Text>
      {badge && (
        <View style={{ backgroundColor: 'rgba(245,158,11,0.15)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 5 }}>
          <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 11, color: colors.amber }}>{badge}</Text>
        </View>
      )}
      {rightText && <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 12, color: rightColor || colors.muted }}>{rightText}</Text>}
      <ChevronRightIcon size={14} color={colors.border} />
    </TouchableOpacity>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    header: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 16 },
    title: { fontFamily: 'CormorantGaramond_600SemiBold', fontSize: 30, color: colors.text },
    profileCard: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      marginHorizontal: 24, marginBottom: 24,
      backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
      borderRadius: 16, padding: 16,
    },
    profileAvatar: {
      width: 48, height: 48, borderRadius: 14, backgroundColor: colors.navy,
      alignItems: 'center', justifyContent: 'center',
    },
    avatarText: { fontFamily: 'Inter_700Bold', color: '#fff', fontSize: 18 },
    profileName: { fontFamily: 'Inter_600SemiBold', fontSize: 16, color: colors.text },
    planBadge: {
      marginTop: 3, alignSelf: 'flex-start',
      backgroundColor: 'rgba(245,158,11,0.15)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 5,
    },
    planText: { fontFamily: 'Inter_600SemiBold', fontSize: 11, color: colors.amber },
    sectionLabel: {
      fontFamily: 'Inter_600SemiBold', fontSize: 11, color: colors.muted,
      textTransform: 'uppercase', letterSpacing: 0.8,
      paddingHorizontal: 24, marginBottom: 8, marginTop: 8,
    },
    items: { paddingHorizontal: 24 },
    card: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border,
      padding: 13, marginBottom: 8,
    },
    iconWrap: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
    itemLabel: { fontFamily: 'Inter_500Medium', flex: 1, fontSize: 14, color: colors.text },
    version: { fontFamily: 'Inter_400Regular', textAlign: 'center', fontSize: 12, color: colors.muted, marginTop: 8 },
  });
}
