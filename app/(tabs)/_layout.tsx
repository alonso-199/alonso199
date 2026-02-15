import { Tabs } from 'expo-router';
import { LayoutDashboard, PlusCircle, ClipboardList, BarChart3, CloudRain, FileText, Upload } from 'lucide-react-native';
import { TouchableOpacity, View } from 'react-native';
import { exportAllData, importAllData } from '../../utils/backup';
import Colors from '../../constants/colors';
import React from 'react';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textLight,
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopColor: Colors.border,
          paddingTop: 4,
        },
        headerStyle: {
          backgroundColor: Colors.surface,
        },
        headerTitleStyle: {
          color: Colors.text,
          fontWeight: '600',
        },
        headerShadowVisible: false,
        headerRight: () => (
          <View style={{ flexDirection: 'row', marginRight: 8 }}>
            <TouchableOpacity onPress={() => exportAllData()} style={{ marginRight: 12 }}>
              <FileText size={20} color={Colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => importAllData()}>
              <Upload size={20} color={Colors.primary} />
            </TouchableOpacity>
          </View>
        ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Inicio',
          tabBarIcon: ({ color, size }) => (
            <LayoutDashboard size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="add"
        options={{
          title: 'Agregar',
          tabBarIcon: ({ color, size }) => (
            <PlusCircle size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'Historial',
          tabBarIcon: ({ color, size }) => (
            <ClipboardList size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: 'Estadísticas',
          tabBarIcon: ({ color, size }) => (
            <BarChart3 size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="precipitaciones"
        options={{
          title: 'Precipitaciones',
          tabBarIcon: ({ color, size }) => (
            <CloudRain size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
