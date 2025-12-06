import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { Text, Card, Avatar, Button, IconButton, Chip } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { collection, query, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../../firebaseConfig';
import { onAuthStateChanged } from 'firebase/auth';

export default function HomeScreen() {
    const navigation = useNavigation();
    const [criticalAlert, setCriticalAlert] = useState(null);
    const [tasksCount, setTasksCount] = useState(0);
    const [accuracy, setAccuracy] = useState(100);
    const [totalStock, setTotalStock] = useState(0);
    const [expiryProjection, setExpiryProjection] = useState([0, 0, 0, 0]); // [Sem 1, Sem 2, Sem 3, Sem 4]
    const [rotation, setRotation] = useState(0);
    const [userName, setUserName] = useState('');
    const [userRole, setUserRole] = useState('');

    useEffect(() => {
        // 1. ALERTA MÁS CRÍTICA (FEFO), STOCK TOTAL Y PROYECCIÓN
        const qProducts = query(collection(db, "products"));
        const unsubProd = onSnapshot(qProducts, (snapshot) => {
            let topAlert = null;
            let minDiff = Infinity;
            let stockSum = 0;
            let projection = [0, 0, 0, 0];
            const today = new Date();

            snapshot.docs.forEach(doc => {
                const p = doc.data();

                // Calculo Stock Total
                if (p.stock) stockSum += parseInt(p.stock);

                // Calculo Alerta FEFO y Proyección
                if (p.expiryDate) {
                    const exp = new Date(p.expiryDate);
                    const diffTime = exp - today;
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                    // Alerta Crítica (<= 5 días)
                    if (diffDays <= 5 && diffDays < minDiff) {
                        minDiff = diffDays;
                        topAlert = { id: doc.id, name: p.name, sku: p.sku, days: diffDays, category: p.category };
                    }

                    // Proyección 30 días (Semanas)
                    if (diffDays >= 0 && diffDays <= 30) {
                        if (diffDays <= 7) projection[0]++;
                        else if (diffDays <= 14) projection[1]++;
                        else if (diffDays <= 21) projection[2]++;
                        else projection[3]++;
                    }
                }
            });
            setCriticalAlert(topAlert);
            setTotalStock(stockSum);
            setExpiryProjection(projection);
        });

        // 2. EXACTITUD INVENTARIO
        const qCounts = query(collection(db, "counts"));
        const unsubCounts = onSnapshot(qCounts, (snapshot) => {
            if (snapshot.empty) { setAccuracy(100); return; }
            let totalExpected = 0;
            let totalCounted = 0;
            snapshot.docs.forEach(doc => {
                const c = doc.data();
                if (c.expected && c.counted) {
                    totalExpected += parseInt(c.expected);
                    totalCounted += parseInt(c.counted);
                }
            });
            if (totalExpected === 0) setAccuracy(100);
            else {
                const diff = Math.abs(totalExpected - totalCounted);
                const acc = Math.max(0, ((totalExpected - diff) / totalExpected) * 100);
                setAccuracy(Math.round(acc));
            }
        });

        // 3. TAREAS PENDIENTES
        const qReturns = query(collection(db, "returns"));
        const unsubReturns = onSnapshot(qReturns, (snap) => {
            setTasksCount(snap.docs.filter(d => d.data().status === 'Pendiente').length);
        });

        // 4. ROTACIÓN (NUEVO)
        const qKardex = query(collection(db, "kardex"));
        const unsubKardex = onSnapshot(qKardex, (snapshot) => {
            let totalOutputs = 0;
            const today = new Date();
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(today.getDate() - 30);

            snapshot.docs.forEach(doc => {
                const k = doc.data();
                // Consideramos solo salidas en los últimos 30 días
                if (k.type === 'Salida' && k.date) {
                    const kDate = k.date.toDate ? k.date.toDate() : new Date(k.date);
                    if (kDate >= thirtyDaysAgo) {
                        totalOutputs += parseInt(k.quantity || 0);
                    }
                }
            });
            setRotation(totalOutputs);
        });

        // 5. USER DATA
        const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
            if (user) {
                setUserName(user.displayName || 'Usuario');
                try {
                    const userDocRef = doc(db, "users", user.uid);
                    const userDocSnap = await getDoc(userDocRef);
                    if (userDocSnap.exists()) {
                        const userData = userDocSnap.data();
                        if (userData.name) setUserName(userData.name);
                        if (userData.role) setUserRole(userData.role);
                        else setUserRole('Usuario');
                    } else {
                        setUserRole('Usuario');
                    }
                } catch (error) {
                    console.error("Error fetching user data:", error);
                    setUserRole('Usuario');
                }
            } else {
                setUserName('');
                setUserRole('');
            }
        });

        return () => { unsubProd(); unsubCounts(); unsubReturns(); unsubKardex(); unsubscribeAuth(); };
    }, []);

    // --- COMPONENTE INTERNO: GRÁFICO DE BARRAS ---
    const ExpiryChart = ({ data }) => {
        const max = Math.max(...data, 1); // Evitar división por 0
        // Colores: Rojo (Urgente), Naranja, Amarillo, Verde (Lejano)
        const colors = ['#FF5252', '#FF9800', '#FFEB3B', '#00E676'];

        return (
            <Card style={styles.chartCard}>
                <Card.Content>
                    <Text variant="titleMedium" style={{ fontWeight: 'bold', color: '#555', marginBottom: 25, letterSpacing: 0.5 }}>PROYECCIÓN VENCIMIENTOS (30D)</Text>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', height: 120 }}>
                        {data.map((value, index) => {
                            const barHeight = (value / max) * 100; // Porcentaje relativo al máximo
                            return (
                                <View key={index} style={{ alignItems: 'center', width: 40 }}>
                                    <Text style={{ fontWeight: 'bold', color: colors[index], marginBottom: 5, fontSize: 16 }}>{value}</Text>
                                    <View style={{
                                        width: '100%',
                                        height: `${Math.max(barHeight, 5)}%`, // Mínimo 5% para que se vea algo
                                        backgroundColor: colors[index],
                                        borderRadius: 8,
                                        borderBottomLeftRadius: 2,
                                        borderBottomRightRadius: 2
                                    }} />
                                    <Text style={{ marginTop: 8, color: '#999', fontSize: 12 }}>Sem {index + 1}</Text>
                                </View>
                            );
                        })}
                    </View>
                </Card.Content>
            </Card>
        );
    };

    return (
        <View style={styles.container}>
            {/* HEADER */}
            <View style={styles.header}>
                <View style={styles.headerContent}>
                    <TouchableOpacity onPress={() => navigation.openDrawer()}>
                        <Avatar.Icon size={45} icon="account" style={{ backgroundColor: '#E0E0E0' }} />
                    </TouchableOpacity>
                    <View style={{ marginLeft: 15, flex: 1 }}>
                        <Text variant="headlineSmall" style={styles.greeting}>Hola, {userName}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <MaterialCommunityIcons name="circle" size={10} color="#4CAF50" />
                            <Text style={styles.role}> {userRole}</Text>
                        </View>
                    </View>
                    <IconButton icon="bell-outline" size={28} onPress={() => navigation.navigate('Alertas')} />
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.content}>

                {/* ALERTA CRÍTICA */}
                {criticalAlert ? (
                    <Card style={styles.alertCard}>
                        <Card.Content>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <MaterialCommunityIcons name="alert-triangle" size={24} color="#D32F2F" />
                                    <Text style={styles.alertTitle}> ALERTA FEFO CRÍTICA</Text>
                                </View>
                                <Chip style={{ backgroundColor: '#FFEBEE' }} textStyle={{ color: '#D32F2F', fontWeight: 'bold', fontSize: 10 }} compact>Urgente</Chip>
                            </View>
                            <Text variant="titleMedium" style={{ fontWeight: 'bold' }}>Lote #{criticalAlert.sku} - {criticalAlert.name}</Text>
                            <Text style={{ color: '#D32F2F', fontWeight: 'bold', marginTop: 5, marginBottom: 15 }}>Vence en: {criticalAlert.days} Días</Text>
                            <Button mode="contained" buttonColor="#D32F2F" style={{ borderRadius: 8 }} onPress={() => navigation.navigate('Alertas')}>Resolver Ahora</Button>
                        </Card.Content>
                    </Card>
                ) : (
                    <Card style={[styles.alertCard, { backgroundColor: '#E8F5E9', borderLeftColor: '#4CAF50' }]}>
                        <Card.Content style={{ alignItems: 'center', paddingVertical: 20 }}>
                            <MaterialCommunityIcons name="check-decagram" size={40} color="#4CAF50" />
                            <Text style={{ color: '#2E7D32', fontWeight: 'bold', marginTop: 10 }}>Todo en orden</Text>
                            <Text style={{ color: '#4CAF50' }}>No hay vencimientos próximos</Text>
                        </Card.Content>
                    </Card>
                )}

                {/* TARJETAS: STOCK Y ROTACIÓN */}
                <View style={{ flexDirection: 'row', gap: 15, marginBottom: 20 }}>
                    <Card style={[styles.statCard, { paddingTop: 10 }]}>
                        <Card.Content>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <MaterialCommunityIcons name="package-variant-closed" size={24} color="#00C853" />
                                    <Text style={{ fontWeight: 'bold', marginLeft: 10, fontSize: 12, color: '#333' }}>STOCK TOTAL</Text>
                                </View>
                                <MaterialCommunityIcons name="circle" size={8} color="#00C853" />
                            </View>
                            <Text variant="headlineMedium" style={{ fontWeight: 'bold', color: '#00C853', marginTop: 10 }}>{totalStock.toLocaleString()} Unidades</Text>
                            <Text style={{ color: '#999', fontSize: 12 }}>Inventario disponible</Text>
                        </Card.Content>
                    </Card>

                    <Card style={[styles.statCard, { paddingTop: 10 }]}>
                        <Card.Content>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <MaterialCommunityIcons name="refresh" size={24} color="#2962FF" />
                                    <Text style={{ fontWeight: 'bold', marginLeft: 10, fontSize: 12, color: '#333' }}>ROTACIÓN</Text>
                                </View>
                                <MaterialCommunityIcons name="circle" size={8} color="#E0E0E0" />
                            </View>
                            <Text variant="headlineMedium" style={{ fontWeight: 'bold', color: '#2962FF', marginTop: 10 }}>
                                {totalStock > 0 ? (rotation / totalStock).toFixed(1) : "0.0"}x
                            </Text>
                            <Text style={{ color: '#999', fontSize: 12 }}>Velocidad de salida</Text>
                        </Card.Content>
                    </Card>
                </View>

                {/* GRÁFICO DE PROYECCIÓN (NUEVO) */}
                <ExpiryChart data={expiryProjection} />

                {/* ESTADÍSTICAS SECUNDARIAS */}
                <View style={styles.statsRow}>
                    <Card style={styles.statCard} onPress={() => navigation.navigate('Devoluciones')}>
                        <Card.Content>
                            <View style={styles.iconBoxOrange}>
                                <MaterialCommunityIcons name="clipboard-text-clock-outline" size={24} color="#F57C00" />
                            </View>
                            <Text variant="displaySmall" style={{ fontWeight: 'bold', marginTop: 10 }}>{tasksCount}</Text>
                            <Text style={{ color: '#666', fontSize: 12 }}>Devoluciones Pendientes</Text>
                        </Card.Content>
                    </Card>

                    <Card style={styles.statCard} onPress={() => navigation.navigate('Stock')}>
                        <Card.Content>
                            <View style={styles.iconBoxGreen}>
                                <MaterialCommunityIcons name="checkbox-marked-circle-outline" size={24} color="#4CAF50" />
                            </View>
                            <Text variant="displaySmall" style={{ fontWeight: 'bold', marginTop: 10 }}>{accuracy}%</Text>
                            <Text style={{ color: '#666', fontSize: 12 }}>Exactitud Inventario</Text>
                        </Card.Content>
                    </Card>
                </View>

                <Text variant="titleMedium" style={styles.sectionTitle}>GESTIÓN RÁPIDA</Text>

                {/* ACCESOS RÁPIDOS */}
                <View style={styles.quickAccessRow}>
                    <TouchableOpacity style={styles.quickBtn} onPress={() => navigation.navigate('Stock')}>
                        <View style={[styles.quickIcon, { backgroundColor: '#E8EAF6' }]}>
                            <MaterialCommunityIcons name="clipboard-list-outline" size={32} color="#3F51B5" />
                        </View>
                        <Text style={styles.quickText}>Inventario</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.quickBtn} onPress={() => navigation.navigate('Devoluciones')}>
                        <View style={[styles.quickIcon, { backgroundColor: '#E3F2FD' }]}>
                            <MaterialCommunityIcons name="truck-delivery-outline" size={32} color="#2196F3" />
                        </View>
                        <Text style={styles.quickText}>Devoluciones</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.quickBtn} onPress={() => navigation.navigate('Mermas')}>
                        <View style={[styles.quickIcon, { backgroundColor: '#FFEBEE' }]}>
                            <MaterialCommunityIcons name="trash-can-outline" size={32} color="#D32F2F" />
                        </View>
                        <Text style={styles.quickText}>Mermas</Text>
                    </TouchableOpacity>
                    <View style={{ width: 20 }} />
                </View>

            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FAFAFA' },
    header: { backgroundColor: '#fff', paddingTop: 50, paddingBottom: 15, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
    headerContent: { flexDirection: 'row', alignItems: 'center' },
    greeting: { fontWeight: 'bold', color: '#333' },
    role: { color: '#666', fontSize: 12 },
    content: { padding: 20 },
    alertCard: { backgroundColor: '#FFF', borderLeftWidth: 5, borderLeftColor: '#D32F2F', marginBottom: 20, elevation: 2, borderRadius: 12 },
    alertTitle: { color: '#D32F2F', fontWeight: 'bold', fontSize: 14 },
    statsRow: { flexDirection: 'row', gap: 15, marginBottom: 25 },
    statCard: { flex: 1, backgroundColor: 'white', borderRadius: 16, elevation: 2 },
    chartCard: { backgroundColor: 'white', borderRadius: 16, elevation: 2, marginBottom: 20, paddingVertical: 10 },
    iconBoxOrange: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#FFF3E0', justifyContent: 'center', alignItems: 'center' },
    iconBoxGreen: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#E8F5E9', justifyContent: 'center', alignItems: 'center' },
    sectionTitle: { color: '#999', fontWeight: 'bold', fontSize: 12, marginBottom: 15, letterSpacing: 1 },

    // ESTILOS DE LOS BOTONES REDONDOS
    quickAccessRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-start' },
    quickBtn: { alignItems: 'center', width: 80 },
    quickIcon: { width: 65, height: 65, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginBottom: 8, elevation: 2 },
    quickText: { fontSize: 12, fontWeight: 'bold', color: '#555', textAlign: 'center' }
});