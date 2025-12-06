import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { DrawerContentScrollView, DrawerItem } from '@react-navigation/drawer';
import { Text, Avatar, Divider, useTheme, Badge } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { signOut } from 'firebase/auth';
import { auth } from '../../firebaseConfig';
import { useNotifications } from '../context/NotificationsContext';

export default function CustomDrawer(props) {
    const theme = useTheme();
    const { badgeCount } = useNotifications();

    const handleLogout = async () => {
        try {
            await signOut(auth);
        } catch (error) {
            console.error("Error signing out: ", error);
        }
    };

    return (
        <View style={{ flex: 1 }}>
            <DrawerContentScrollView
                {...props}
                contentContainerStyle={{ backgroundColor: theme.colors.primary, paddingTop: 0 }}
            >
                {/* 1. CABECERA DEL PERFIL */}
                <View style={styles.header}>
                    <View style={styles.profileRow}>
                        <Avatar.Image
                            source={{ uri: 'https://i.pravatar.cc/150?img=12' }}
                            size={50}
                            style={styles.avatar}
                        />
                        <View style={styles.infoCol}>
                            <Text style={styles.name}>Yohan</Text>
                            <Text style={styles.id}>Supervisor ID: 8821</Text>
                        </View>
                    </View>

                    <View style={styles.statusContainer}>
                        <MaterialCommunityIcons name="circle" color="#4CAF50" size={10} style={{ marginRight: 5 }} />
                        <Text style={styles.statusText}>EN LÍNEA • BODEGA CENTRAL</Text>
                    </View>
                </View>

                {/* 2. LISTA DE MENÚ */}
                <View style={styles.menuContainer}>
                    <Text style={styles.sectionLabel}>MÓDULOS OPERATIVOS</Text>

                    {props.state.routes.map((route, index) => {
                        const { options } = props.descriptors[route.key];
                        const label =
                            options.drawerLabel !== undefined
                                ? options.drawerLabel
                                : options.title !== undefined
                                    ? options.title
                                    : route.name;

                        const isFocused = props.state.index === index;
                        const color = isFocused ? theme.colors.primary : '#666';
                        const backgroundColor = isFocused ? theme.colors.primary + '20' : 'transparent';

                        // Skip if hidden (though usually handled by drawerItemStyle display: none)
                        if (options.drawerItemStyle?.display === 'none') return null;

                        return (
                            <DrawerItem
                                key={route.key}
                                label={({ color }) => (
                                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flex: 1 }}>
                                        <Text style={{ color, fontWeight: 'bold', marginLeft: 10 }}>{label}</Text>
                                        {route.name === 'Notificaciones' && badgeCount > 0 && (
                                            <Badge size={22} style={{ backgroundColor: '#D32F2F', color: 'white', fontWeight: 'bold' }}>
                                                {badgeCount}
                                            </Badge>
                                        )}
                                    </View>
                                )}
                                icon={({ size, color }) => (
                                    options.drawerIcon ? options.drawerIcon({ size, color }) : null
                                )}
                                focused={isFocused}
                                activeTintColor={theme.colors.primary}
                                inactiveTintColor="#666"
                                activeBackgroundColor={theme.colors.primary + '20'}
                                onPress={() => props.navigation.navigate(route.name)}
                                style={{ borderRadius: 10, marginVertical: 2 }}
                            />
                        );
                    })}
                </View>
            </DrawerContentScrollView>

            {/* 3. FOOTER */}
            <View style={styles.footer}>
                <Divider style={{ marginBottom: 10 }} />
                <DrawerItem
                    icon={({ color, size }) => (
                        <MaterialCommunityIcons name="logout-variant" color="#D32F2F" size={24} />
                    )}
                    label="Cerrar Sesión"
                    labelStyle={{
                        color: '#D32F2F',
                        fontWeight: 'bold',
                        marginLeft: 5,
                        fontSize: 15
                    }}
                    onPress={handleLogout}
                />
                <Text style={styles.version}>v1.0.5 - Ataelqui App</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    header: {
        padding: 20,
        paddingTop: 50,
        paddingBottom: 20,
    },
    profileRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
    avatar: { backgroundColor: 'white', marginRight: 15 },
    infoCol: { flex: 1 },
    name: { fontSize: 22, fontWeight: 'bold', color: 'white', lineHeight: 24 },
    id: { fontSize: 13, color: 'rgba(255,255,255,0.8)' },
    statusContainer: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.15)', paddingVertical: 6, paddingHorizontal: 10,
        borderRadius: 20, alignSelf: 'flex-start'
    },
    statusText: { color: 'white', fontSize: 11, fontWeight: '600' },

    menuContainer: {
        flex: 1,
        backgroundColor: 'white',
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        paddingTop: 20,
        paddingHorizontal: 10,
        minHeight: 500
    },
    sectionLabel: {
        marginLeft: 18,
        marginBottom: 10,
        fontSize: 12,
        fontWeight: 'bold',
        color: '#aaa',
        letterSpacing: 1
    },
    footer: {
        padding: 20,
        backgroundColor: 'white',
        borderTopColor: '#f0f0f0',
        borderTopWidth: 1
    },
    version: { textAlign: 'center', color: '#ccc', fontSize: 10, marginTop: 5 }
});