import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useFonts } from 'expo-font';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import {
  CormorantGaramond_400Regular,
  CormorantGaramond_600SemiBold,
} from '@expo-google-fonts/cormorant-garamond';

import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from './src/hooks/useAuth';
import { lightColors } from './src/constants/colors';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import ChargesScreen from './src/screens/ChargesScreen';
import InboxScreen from './src/screens/InboxScreen';
import DocumentsScreen from './src/screens/DocumentsScreen';
import MoreScreen from './src/screens/MoreScreen';
import MeetingRoomScreen from './src/screens/MeetingRoomScreen';
import VotingScreen from './src/screens/VotingScreen';
import LawQAScreen from './src/screens/LawQAScreen';
import RequestsScreen from './src/screens/RequestsScreen';
import {
  HomeIcon, ChargesIcon, InboxIcon, DocumentsIcon, MoreIcon,
} from './src/components/Icons';

const Tab   = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function MoreStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MoreMain"     component={MoreScreen} />
      <Stack.Screen name="MeetingRoom"  component={MeetingRoomScreen} />
      <Stack.Screen name="Voting"       component={VotingScreen} />
      <Stack.Screen name="LawQA"        component={LawQAScreen} />
      <Stack.Screen name="Requests"     component={RequestsScreen} />
    </Stack.Navigator>
  );
}

function TabIcon({ Icon, focused }: { Icon: React.ComponentType<any>; focused: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={[tabIconStyles.wrap, focused && { backgroundColor: 'rgba(245,158,11,0.12)' }]}>
      <Icon
        size={20}
        color={focused ? colors.amber : colors.muted}
        strokeWidth={focused ? 2.5 : 2}
      />
    </View>
  );
}

function MainApp() {
  const { colors, isDark } = useTheme();
  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: isDark ? 'rgba(13,26,43,0.97)' : 'rgba(255,255,255,0.97)',
            borderTopWidth: 1,
            borderTopColor: colors.border,
            height: 84,
            paddingBottom: 20,
            paddingTop: 8,
            shadowColor: isDark ? '#000' : colors.navy,
            shadowOpacity: isDark ? 0.3 : 0.06,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: -2 },
          },
          tabBarShowLabel: true,
          tabBarLabelStyle: tabIconStyles.label,
          tabBarActiveTintColor: colors.amber,
          tabBarInactiveTintColor: colors.muted,
        }}
      >
        <Tab.Screen
          name="Home"
          component={HomeScreen}
          options={{
            tabBarLabel: 'Home',
            tabBarIcon: ({ focused }) => <TabIcon Icon={HomeIcon} focused={focused} />,
          }}
        />
        <Tab.Screen
          name="Charges"
          component={ChargesScreen}
          options={{
            tabBarLabel: 'Charges',
            tabBarIcon: ({ focused }) => <TabIcon Icon={ChargesIcon} focused={focused} />,
          }}
        />
        <Tab.Screen
          name="Inbox"
          component={InboxScreen}
          options={{
            tabBarLabel: 'Inbox',
            tabBarIcon: ({ focused }) => <TabIcon Icon={InboxIcon} focused={focused} />,
          }}
        />
        <Tab.Screen
          name="Documents"
          component={DocumentsScreen}
          options={{
            tabBarLabel: 'Documents',
            tabBarIcon: ({ focused }) => <TabIcon Icon={DocumentsIcon} focused={focused} />,
          }}
        />
        <Tab.Screen
          name="More"
          component={MoreStack}
          options={{
            tabBarLabel: 'More',
            tabBarIcon: ({ focused }) => <TabIcon Icon={MoreIcon} focused={focused} />,
          }}
        />
      </Tab.Navigator>
    </>
  );
}

export default function App() {
  const { session, loading: authLoading } = useAuth();
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    CormorantGaramond_400Regular,
    CormorantGaramond_600SemiBold,
  });

  if (authLoading || !fontsLoaded) {
    return (
      <View style={splashStyles.wrap}>
        <Text style={splashStyles.logo}>
          Syndic<Text style={splashStyles.accent}>Sage</Text>
        </Text>
        <ActivityIndicator color={lightColors.amber} size="large" style={{ marginTop: 32 }} />
      </View>
    );
  }

  return (
    <ThemeProvider>
      <SafeAreaProvider>
        <NavigationContainer>
          {session ? <MainApp /> : <LoginScreen />}
        </NavigationContainer>
      </SafeAreaProvider>
    </ThemeProvider>
  );
}

const splashStyles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: lightColors.bg },
  logo: { fontFamily: 'CormorantGaramond_600SemiBold', fontSize: 38, color: lightColors.navy },
  accent: { color: lightColors.amber },
});

const tabIconStyles = StyleSheet.create({
  wrap: { width: 36, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  label: { fontFamily: 'Inter_500Medium', fontSize: 10, marginTop: 2 },
});
