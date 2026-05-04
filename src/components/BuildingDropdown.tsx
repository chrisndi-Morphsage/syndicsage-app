import React, { useMemo, useState } from 'react';
import {
  View, Text, TouchableOpacity, Modal, StyleSheet, FlatList, Pressable,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { ThemeColors } from '../constants/colors';
import { ChevronRightIcon } from './Icons';

interface Building { id: string; name: string; }

interface Props {
  buildings: Building[];
  active: Building | null;
  onSelect: (b: Building) => void;
  noTopMargin?: boolean;
}

export default function BuildingDropdown({ buildings, active, onSelect, noTopMargin }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [open, setOpen] = useState(false);

  if (!buildings.length) return null;
  if (buildings.length === 1) {
    return (
      <View style={[styles.single, noTopMargin && { marginTop: 0 }]}>
        <Text style={styles.singleText}>{buildings[0].name}</Text>
      </View>
    );
  }

  return (
    <>
      <TouchableOpacity style={[styles.trigger, noTopMargin && { marginTop: 0 }]} onPress={() => setOpen(true)} activeOpacity={0.7}>
        <Text style={styles.triggerText} numberOfLines={1}>{active?.name ?? '—'}</Text>
        <View style={styles.chevron}>
          <ChevronRightIcon size={14} color={colors.navy} strokeWidth={2.5} />
        </View>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={e => e.stopPropagation()}>
            <Text style={styles.sheetTitle}>Select building</Text>
            <FlatList
              data={buildings}
              keyExtractor={b => b.id}
              ItemSeparatorComponent={() => <View style={styles.sep} />}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.option, active?.id === item.id && styles.optionActive]}
                  onPress={() => { onSelect(item); setOpen(false); }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.optionText, active?.id === item.id && styles.optionTextActive]}>
                    {item.name}
                  </Text>
                  {active?.id === item.id && <View style={styles.checkDot} />}
                </TouchableOpacity>
              )}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    single: { marginTop: 8, paddingVertical: 6 },
    singleText: { fontFamily: 'Inter_500Medium', fontSize: 13, color: colors.muted },
    trigger: {
      flexDirection: 'row', alignItems: 'center', marginTop: 8,
      backgroundColor: colors.bg2, borderRadius: 10, paddingHorizontal: 12,
      paddingVertical: 8, alignSelf: 'flex-start', maxWidth: '100%', gap: 6,
      borderWidth: 1, borderColor: colors.border,
    },
    triggerText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: colors.text, flexShrink: 1 },
    chevron: { transform: [{ rotate: '90deg' }] },
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', paddingHorizontal: 32 },
    sheet: {
      backgroundColor: colors.card, borderRadius: 16, paddingVertical: 8,
      borderWidth: 1, borderColor: colors.border,
      shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 20, shadowOffset: { width: 0, height: 8 },
    },
    sheetTitle: {
      fontFamily: 'Inter_600SemiBold', fontSize: 12, color: colors.muted,
      paddingHorizontal: 16, paddingVertical: 10, textTransform: 'uppercase', letterSpacing: 0.5,
    },
    sep: { height: 1, backgroundColor: colors.border, marginHorizontal: 16 },
    option: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
    optionActive: { backgroundColor: 'rgba(245,158,11,0.07)' },
    optionText: { fontFamily: 'Inter_500Medium', fontSize: 14, color: colors.text },
    optionTextActive: { fontFamily: 'Inter_600SemiBold', color: colors.amber },
    checkDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.amber },
  });
}
