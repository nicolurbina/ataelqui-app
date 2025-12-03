import React from 'react';
import { View, StyleSheet } from 'react-native';
import { DrawerContentScrollView, DrawerItemList, DrawerItem } from '@react-navigation/drawer';
import { Text, Avatar, Divider, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function CustomDrawer(props) {
    const theme = useTheme();

    return (
        <View style={{ flex: 1 }}>
            <DrawerContentScrollView
                {...props}
                contentContainerStyle={{ backgroundColor: theme.colors.primary, paddingTop: 0 }}
            >
                {/* 1. CABECERA DEL PERFIL (Perfectamente alineada) */}
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

                    {/* Estado visual */}
                    <View style={styles.statusContainer}>
                        <MaterialCommunityIcons name="circle" color="#4CAF50" size={10} style={{ marginRight: 5 }} />
                        <Text style={styles.statusText}>EN LÍNEA • BODEGA CENTRAL</Text>
                    </View>
                </View>

                {/* 2. LISTA DE MENÚ (Fondo blanco con esquinas redondeadas arriba) */}
                <View style={styles.menuContainer}>
                    <Text style={styles.sectionLabel}>MÓDULOS OPERATIVOS</Text>
                    <DrawerItemList {...props} />
                </View>
            </DrawerContentScrollView>

            {/* 3. FOOTER (Cerrar Sesión alineado) */}
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
                        marginLeft: 5, // TRUCO: Alinea el texto con los de arriba
                        fontSize: 15
                    }}
                    onPress={() => alert('Cerrar sesión')}
                />
                <Text style={styles.version}>v1.0.5 - Ataelqui App</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    header: {
        padding: 20,
        paddingTop: 50, // Espacio para la barra de estado
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
        borderTopLeftRadius: 30, // Efecto tarjeta redondeada
        borderTopRightRadius: 30,
        paddingTop: 20,
        paddingHorizontal: 10,
        minHeight: 500 // Asegura que el blanco cubra hacia abajo
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