import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, doc, onSnapshot, query } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Avatar, Button, Card, Chip, IconButton, Text } from 'react-native-paper';
import { auth, db } from '../../firebaseConfig';

export default function HomeScreen() {
    const navigation = useNavigation();
    const [criticalAlert, setCriticalAlert] = useState(null);
    const [tasksCount, setTasksCount] = useState(0);
    const [accuracy, setAccuracy] = useState(100);
    const [totalStock, setTotalStock] = useState(0);
    const [expiryProjection, setExpiryProjection] = useState([0, 0, 0, 0]); // [Sem 1, Sem 2, Sem 3, Sem 4]
    const [rotation, setRotation] = useState(0);
    const [userData, setUserData] = useState({ name: '', role: '', photoURL: null });
    const [rawProducts, setRawProducts] = useState([]);
    const [rawInventory, setRawInventory] = useState([]);

    useEffect(() => {
        // 1. PRODUCTS LISTENER
        const qProducts = query(collection(db, "products"));
        const unsubProd = onSnapshot(qProducts, (snapshot) => {
            setRawProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        // 2. INVENTORY (LOTS) LISTENER
        const qInventory = query(collection(db, "inventory"));
        const unsubInventory = onSnapshot(qInventory, (snapshot) => {
            setRawInventory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        // 3. EXACTITUD INVENTARIO (Existing logic)
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

        // 4. TAREAS PENDIENTES (Existing logic)
        const qReturns = query(collection(db, "returns"));
        const unsubReturns = onSnapshot(qReturns, (snap) => {
            setTasksCount(snap.docs.filter(d => d.data().status === 'Pendiente').length);
        });

        // 5. ROTACIÓN (Existing logic)
        const qKardex = query(collection(db, "kardex"));
        const unsubKardex = onSnapshot(qKardex, (snapshot) => {
            let totalOutputs = 0;
            const today = new Date();
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(today.getDate() - 30);

            snapshot.docs.forEach(doc => {
                const k = doc.data();
                if (k.type === 'Salida' && k.date) {
                    const kDate = k.date.toDate ? k.date.toDate() : new Date(k.date);
                    if (kDate >= thirtyDaysAgo) {
                        totalOutputs += parseInt(k.quantity || 0);
                    }
                }
            });
            setRotation(totalOutputs);
        });

        // 6. USER DATA (Updated logic)
        const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
            if (user) {
                let newData = { name: user.displayName || 'Usuario', role: 'Usuario', photoURL: null };

                try {
                    const userDocRef = doc(db, "users", user.uid);
                    // Use onSnapshot for real-time profile updates (e.g. image change)
                    const unsubUser = onSnapshot(userDocRef, (docSnap) => {
                        if (docSnap.exists()) {
                            const data = docSnap.data();
                            setUserData({
                                name: data.name || user.displayName || 'Usuario',
                                role: data.role || 'Usuario',
                                photoURL: data.photoURL || null
                            });
                        }
                    });
                    // Store unsubscribe function if needed, but for now we just let it accept updates
                    // Ideally we'd add this to the cleanup function list
                } catch (error) {
                    console.error("Error fetching user data:", error);
                    setUserData(newData);
                }
            } else {
                setUserData({ name: '', role: '', photoURL: null });
            }
        });

        return () => { unsubProd(); unsubInventory(); unsubCounts(); unsubReturns(); unsubKardex(); unsubscribeAuth(); };
    }, []);


    // --- EFFECT: CALCULATE DASHBOARD METRICS ---
    useEffect(() => {
        let topAlert = null;
        let minDiff = Infinity;
        let stockSum = 0;
        let projection = [0, 0, 0, 0];
        const today = new Date();

        // Helper to process expiry
        const processExpiry = (dateInput, name, sku, category, sourceId) => {
            if (!dateInput) return;

            let expDate = null;

            // 1. Resolve to Date Object (Robust)
            try {
                if (dateInput.toDate) {
                    // Firestore Timestamp
                    expDate = dateInput.toDate();
                } else if (typeof dateInput === 'string') {
                    // Strings
                    if (dateInput.includes('/')) {
                        // Assume DD/MM/YYYY (Common in LatAm)
                        const parts = dateInput.split('/');
                        if (parts.length === 3) {
                            expDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
                        }
                    } else if (dateInput.includes('-')) {
                        // Assume YYYY-MM-DD (ISO) - Parse manually to force Local Time (avoid UTC shift)
                        const parts = dateInput.split('T')[0].split('-');
                        if (parts.length === 3) {
                            expDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
                        }
                    }

                    // Fallback
                    if (!expDate || isNaN(expDate.getTime())) {
                        expDate = new Date(dateInput);
                    }
                } else if (dateInput instanceof Date) {
                    expDate = dateInput;
                }
            } catch (e) { return; }

            if (!expDate || isNaN(expDate.getTime())) return;

            // 2. Normalize to Midnight for accurate Day-Diff
            const now = new Date();
            now.setHours(0, 0, 0, 0);

            const target = new Date(expDate);
            target.setHours(0, 0, 0, 0);

            const diffTime = target.getTime() - now.getTime();
            const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

            // Alerta Crítica (<= 7 días)
            if (diffDays <= 7 && diffDays < minDiff) {
                minDiff = diffDays;
                topAlert = { id: sourceId, name: name, sku: sku, days: diffDays, category: category };
            }

            // Proyección 30 días
            // Note: We include negative diffDays (expired) in the first bucket? 
            // Previous logic: if (diffDays >= 0 && diffDays <= 30)
            // Ideally: Sem 1 should include "Everything expiring this week + Overdue" or just "Upcoming"?
            // Usually Projections show UPCOMING. Overdue is handled by alerts.
            // But let's stick to user request "No se mueve". 
            // If they have overdue items, maybe they want to see them?
            // Let's keep it strictly [0, 30] for now to match title "(30D)"

            if (diffDays >= 0 && diffDays <= 30) {
                if (diffDays <= 7) projection[0]++;
                else if (diffDays <= 14) projection[1]++;
                else if (diffDays <= 21) projection[2]++;
                else projection[3]++;
            }
        };

        // 1. Process Products (Direct Expiry & Stock)
        rawProducts.forEach(p => {
            // Stock Logic
            if (p.stock) stockSum += parseInt(p.stock);
            else if (p.totalStock) stockSum += parseInt(p.totalStock);
            else if (p.quantity) stockSum += parseInt(p.quantity);

            // Expiry Logic (Direct Product Date)
            processExpiry(p.expiryDate, p.name, p.sku, p.category, p.id);
        });

        // 2. Process Inventory (Lots Expiry)
        rawInventory.forEach(lot => {
            // We use lot data for Expiry, linking back to product name if possible
            // Note: lot.productName usually exists. If not, we might need to look up in rawProducts (optional)
            const name = lot.productName || lot.name || 'Producto Desconocido';
            const sku = lot.sku || lot.batch || 'Lote';
            processExpiry(lot.expiryDate, name, sku, 'Lote', lot.id);
        });

        setCriticalAlert(topAlert);
        setTotalStock(stockSum);
        setExpiryProjection(projection);

    }, [rawProducts, rawInventory]);

    // --- COMPONENTE INTERNO: GRÁFICO DE BARRAS ---
    const ExpiryChart = ({ data }) => {
        const max = Math.max(...data, 1); // Evitar división por 0
        // Colores: Rojo (Urgente), Naranja, Amarillo, Verde (Lejano)
        const colors = ['#FF5252', '#FF9800', '#FFEB3B', '#00E676'];
        const MAX_BAR_HEIGHT = 80; // Altura máxima en píxeles para las barras

        return (
            <Card style={styles.chartCard}>
                <Card.Content>
                    <Text variant="titleMedium" style={{ fontWeight: 'bold', color: '#555', marginBottom: 25, letterSpacing: 0.5 }}>PROYECCIÓN VENCIMIENTOS (30D)</Text>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', height: 140 }}>
                        {data.map((value, index) => {
                            const barHeight = (value / max) * MAX_BAR_HEIGHT;
                            const finalHeight = Math.max(barHeight, 4); // Mínimo 4px visual

                            return (
                                <View key={index} style={{ alignItems: 'center', width: 40, justifyContent: 'flex-end' }}>
                                    <Text style={{ fontWeight: 'bold', color: colors[index], marginBottom: 5, fontSize: 16 }}>{value}</Text>
                                    <View style={{
                                        width: '100%',
                                        height: finalHeight,
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
                        {userData.photoURL ? (
                            <Avatar.Image size={45} source={{ uri: userData.photoURL }} />
                        ) : (
                            <Avatar.Icon size={45} icon="account" style={{ backgroundColor: '#E0E0E0' }} />
                        )}
                    </TouchableOpacity>
                    <View style={{ marginLeft: 15, flex: 1 }}>
                        <Text variant="headlineSmall" style={styles.greeting}>Hola, {userData.name}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <MaterialCommunityIcons name="circle" size={10} color="#4CAF50" />
                            <Text style={styles.role}> {userData.role}</Text>
                        </View>
                    </View>
                    <IconButton icon="bell-outline" size={28} onPress={() => navigation.navigate('Notificaciones')} />
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
                            <Button mode="contained" buttonColor="#D32F2F" style={{ borderRadius: 8 }} onPress={() => navigation.navigate('Notificaciones')}>Resolver Ahora</Button>
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