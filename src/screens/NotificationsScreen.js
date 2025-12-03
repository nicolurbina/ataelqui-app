import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, Alert } from 'react-native';
// AQUÍ FALTABA EL IMPORT DE IconButton, AHORA ESTÁ AGREGADO:
import { Text, Card, Chip, Searchbar, ActivityIndicator, FAB, Divider, IconButton } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { collection, onSnapshot, query, addDoc, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../firebaseConfig';

export default function NotificationsScreen() {
  const [productAlerts, setProductAlerts] = useState([]);
  const [systemAlerts, setSystemAlerts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState('Todas'); 
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. ALERTAS DE PRODUCTOS
    const qProducts = query(collection(db, "products"));
    const unsubscribeProducts = onSnapshot(qProducts, (snapshot) => {
      const generated = [];
      const today = new Date();

      snapshot.docs.forEach((doc) => {
        const p = doc.data();
        if (p.expiryDate) {
            const expDate = new Date(p.expiryDate);
            const diffDays = Math.ceil((expDate - today) / (1000 * 60 * 60 * 24)); 
            if (diffDays < 0) {
                generated.push({ id: doc.id + '_expired', title: 'Producto Vencido', desc: `${p.name} venció hace ${Math.abs(diffDays)} días.`, type: 'FEFO', color: '#D32F2F', icon: 'alert-octagon', date: p.expiryDate, isSystem: false });
            } else if (diffDays <= 7) {
                generated.push({ id: doc.id + '_fefo', title: 'Riesgo Vencimiento', desc: `${p.name} vence en ${diffDays} días.`, type: 'FEFO', color: '#F57C00', icon: 'clock-alert', date: p.expiryDate, isSystem: false });
            }
        }
        if (p.stock !== undefined && p.stock <= 10) {
            generated.push({ id: doc.id + '_stock', title: 'Stock Crítico', desc: `Quedan solo ${p.stock} unidades de ${p.name}.`, type: 'Stock', color: '#FBC02D', icon: 'package-variant-closed', date: new Date().toISOString().split('T')[0], isSystem: false });
        }
      });
      setProductAlerts(generated);
    });

    // 2. ALERTAS DE SISTEMA
    const qAlerts = query(collection(db, "general_alerts"), orderBy("date", "desc"));
    const unsubscribeAlerts = onSnapshot(qAlerts, (snapshot) => {
      setSystemAlerts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), isSystem: true })));
      setLoading(false);
    });

    return () => { unsubscribeProducts(); unsubscribeAlerts(); };
  }, []);

  const simulateSystemEvents = async () => {
    try {
      await addDoc(collection(db, "general_alerts"), {
        title: 'Discrepancia en Harina',
        desc: 'El conteo físico no coincide con el sistema.',
        type: 'Discrepancia',
        color: '#5E35B1',
        icon: 'file-compare',
        date: new Date().toISOString().split('T')[0],
        expected: 100, 
        counted: 80    
      });

      await addDoc(collection(db, "general_alerts"), {
        title: 'Sincronización Completa',
        desc: 'Datos actualizados con el servidor central.',
        type: 'Sistema',
        color: '#757575',
        icon: 'cloud-check',
        date: new Date().toISOString().split('T')[0]
      });
      Alert.alert("Simulación", "Se generó una Discrepancia.");
    } catch (e) { Alert.alert("Error", e.message); }
  };

  const deleteAlert = async (alert) => {
    if (!alert.isSystem) return;
    try { await deleteDoc(doc(db, "general_alerts", alert.id)); } catch (e) { console.log(e); }
  };

  const filteredAlerts = [...systemAlerts, ...productAlerts].filter(alert => {
    const matchesType = filter === 'Todas' || alert.type === filter;
    const matchesSearch = alert.desc.toLowerCase().includes(searchQuery.toLowerCase()) || alert.title.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesSearch;
  });

  if (loading) return <View style={styles.center}><ActivityIndicator color="#F36F21" /></View>;

  return (
    <View style={styles.container}>
        <View style={{padding: 15, backgroundColor:'white'}}>
            <Searchbar placeholder="Buscar..." onChangeText={setSearchQuery} value={searchQuery} style={{marginBottom:10, backgroundColor:'#f0f0f0'}} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {['Todas', 'FEFO', 'Stock', 'Discrepancia', 'Sistema'].map((f) => (
                    <Chip key={f} mode="outlined" style={[styles.chip, filter === f && {backgroundColor:'#FFF3E0', borderColor:'#F36F21'}]} onPress={() => setFilter(f)}>{f}</Chip>
                ))}
            </ScrollView>
        </View>

        <ScrollView style={{padding:10}}>
            {filteredAlerts.map((alert) => (
                <Card key={alert.id} style={styles.card} onLongPress={() => deleteAlert(alert)}>
                    <Card.Title 
                        title={alert.title} 
                        titleStyle={{color: alert.color, fontWeight:'bold'}}
                        subtitle={alert.type + " • " + alert.date}
                        left={(props) => <MaterialCommunityIcons {...props} name={alert.icon} size={40} color={alert.color} />}
                        // AQUÍ ES DONDE SE USABA IconButton Y FALLABA
                        right={(props) => alert.isSystem ? <IconButton {...props} icon="close" onPress={() => deleteAlert(alert)}/> : null}
                    />
                    <Card.Content>
                        <Text variant="bodyMedium">{alert.desc}</Text>
                        {alert.type === 'Discrepancia' && alert.expected !== undefined && (
                            <View style={{marginTop:10, padding:10, backgroundColor:'#F3E5F5', borderRadius:8}}>
                                <View style={{flexDirection:'row', justifyContent:'space-between', marginBottom:5}}>
                                    <Text>Esperado:</Text>
                                    <Text style={{fontWeight:'bold'}}>{alert.expected}</Text>
                                </View>
                                <View style={{flexDirection:'row', justifyContent:'space-between', marginBottom:5}}>
                                    <Text>Contado:</Text>
                                    <Text style={{fontWeight:'bold'}}>{alert.counted}</Text>
                                </View>
                                <Divider style={{marginVertical:5}} />
                                <View style={{flexDirection:'row', justifyContent:'space-between'}}>
                                    <Text style={{color: '#D32F2F', fontWeight:'bold'}}>Diferencia:</Text>
                                    <Text style={{color: '#D32F2F', fontWeight:'bold'}}>{alert.counted - alert.expected}</Text>
                                </View>
                            </View>
                        )}
                    </Card.Content>
                </Card>
            ))}
            <View style={{height:80}} /> 
        </ScrollView>
        <FAB icon="lightning-bolt" label="Simular" style={styles.fab} onPress={simulateSystemEvents} color="white" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f0f0' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  chip: { marginRight: 8 },
  card: { marginBottom: 10, backgroundColor: 'white' },
  fab: { position: 'absolute', margin: 16, right: 0, bottom: 0, backgroundColor: '#607D8B' },
});