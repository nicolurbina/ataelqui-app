import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, Alert, Modal as NativeModal } from 'react-native';
import { Text, Card, Button, FAB, TextInput, RadioButton, SegmentedButtons, IconButton } from 'react-native-paper';
import { collection, addDoc, query, where, getDocs, updateDoc, doc, onSnapshot, orderBy } from 'firebase/firestore';
import { CameraView, useCameraPermissions } from 'expo-camera'; // Importamos cámara
import { db } from '../../firebaseConfig';

export default function WasteScreen() {
  const [wastes, setWastes] = useState([]);
  const [filter, setFilter] = useState('all');

  // ESTADOS DEL MODAL Y CÁMARA
  const [modalVisible, setModalVisible] = useState(false);
  const [cameraVisible, setCameraVisible] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  const [sku, setSku] = useState('');
  const [qty, setQty] = useState('');
  const [cause, setCause] = useState('Vencido');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = query(collection(db, "waste"), orderBy("date", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setWastes(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    if (!permission) requestPermission();
    return () => unsubscribe();
  }, [permission]);

  // INICIAR PROCESO DE MERMA
  const startWasteProcess = () => {
    setSku(''); setQty(''); setCause('Vencido');
    // Por defecto abrimos cámara
    setCameraVisible(true);
    setModalVisible(true);
  };

  const handleBarCodeScanned = ({ data }) => {
    setSku(data);
    setCameraVisible(false); // Cerramos cámara, mostramos formulario
    Alert.alert("Código Detectado", `SKU: ${data}`);
  };

  const switchToManual = () => {
    setCameraVisible(false);
    // Nos quedamos en el modal pero con el formulario visible
  };

  const handleConfirmWaste = async () => {
    if (!sku || !qty) return Alert.alert("Error", "SKU y Cantidad obligatorios");
    setLoading(true);

    try {
      // 1. Verificar Stock
      const q = query(collection(db, "products"), where("sku", "==", sku));
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        setLoading(false);
        return Alert.alert("Error", "SKU no encontrado en inventario.");
      }

      const pDoc = snapshot.docs[0];
      const currentStock = pDoc.data().stock;
      const deduction = parseInt(qty);

      if (currentStock < deduction) {
        setLoading(false);
        return Alert.alert("Error", `Stock insuficiente. Tienes: ${currentStock}`);
      }

      // 2. Descontar
      await updateDoc(doc(db, "products", pDoc.id), { stock: currentStock - deduction });

      // 3. Registrar Merma
      await addDoc(collection(db, "waste"), { sku, productName: pDoc.data().name, quantity: deduction, cause, date: new Date() });

      // 4. Registrar Kardex
      await addDoc(collection(db, "kardex"), { sku, productName: pDoc.data().name, type: "Salida", quantity: deduction, reason: `Merma (${cause})`, date: new Date(), user: "Bodeguero" });

      // 5. Trigger Alert for Waste
      await addDoc(collection(db, "general_alerts"), {
        title: 'Merma Registrada',
        desc: `Producto: ${pDoc.data().name}. Cantidad: ${deduction}. Causa: ${cause}.`,
        type: 'Merma',
        color: '#795548',
        icon: 'trash-can',
        date: new Date().toISOString().split('T')[0],
        isSystem: true
      });

      Alert.alert("Baja Exitosa", "Inventario actualizado.");
      setModalVisible(false);
    } catch (e) {
      Alert.alert("Error", e.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredList = filter === 'all' ? wastes : wastes.filter(w => w.cause.toLowerCase() === filter.toLowerCase());

  return (
    <View style={styles.container}>
      <View style={{ padding: 15, backgroundColor: 'white' }}>
        <SegmentedButtons value={filter} onValueChange={setFilter} buttons={[{ value: 'all', label: 'Todas' }, { value: 'vencido', label: 'Vencido' }, { value: 'daño', label: 'Daño' }]} />
      </View>

      <ScrollView style={{ padding: 10 }}>
        {filteredList.map((item) => (
          <Card key={item.id} style={styles.card}>
            <Card.Content>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontWeight: 'bold' }}>{item.productName}</Text>
                <Text style={{ color: '#D32F2F', fontWeight: 'bold' }}>-{item.quantity}</Text>
              </View>
              <Text variant="bodySmall">SKU: {item.sku} | {item.cause}</Text>
              <Text variant="bodySmall" style={{ color: '#666' }}>{new Date(item.date.seconds * 1000).toLocaleDateString()}</Text>
            </Card.Content>
          </Card>
        ))}
      </ScrollView>

      <FAB icon="plus" style={styles.fab} onPress={startWasteProcess} label="Nueva Baja" />

      {/* MODAL FULL SCREEN PARA EL PROCESO */}
      <NativeModal visible={modalVisible} animationType="slide" onRequestClose={() => setModalVisible(false)}>
        {cameraVisible ? (
          <View style={{ flex: 1, backgroundColor: 'black' }}>
            <CameraView style={StyleSheet.absoluteFillObject} facing="back" onBarcodeScanned={handleBarCodeScanned} />
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <View style={{ width: 250, height: 250, borderWidth: 2, borderColor: 'white', borderRadius: 20 }} />
            </View>
            <View style={{ padding: 20, paddingBottom: 40 }}>
              <Button mode="contained" buttonColor="white" textColor="black" icon="keyboard" onPress={switchToManual}>Ingresar Manualmente</Button>
              <Button mode="text" textColor="white" onPress={() => setModalVisible(false)} style={{ marginTop: 10 }}>Cancelar</Button>
            </View>
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 50 }}>
            <Text variant="headlineSmall" style={{ marginBottom: 20 }}>Detalle de Merma</Text>
            <TextInput label="SKU" value={sku} onChangeText={setSku} mode="outlined" style={styles.input} />
            <TextInput label="Cantidad" value={qty} onChangeText={setQty} keyboardType="numeric" mode="outlined" style={styles.input} />

            <Text style={{ marginTop: 10 }}>Causa:</Text>
            <RadioButton.Group onValueChange={setCause} value={cause}>
              <View style={{ flexDirection: 'row', marginBottom: 20 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}><RadioButton value="Vencido" /><Text>Vencido</Text></View>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 20 }}><RadioButton value="Daño" /><Text>Daño</Text></View>
              </View>
            </RadioButton.Group>

            <Button mode="contained" buttonColor="#D32F2F" loading={loading} onPress={handleConfirmWaste}>Confirmar Baja</Button>
            <Button mode="text" onPress={() => setModalVisible(false)} style={{ marginTop: 10 }}>Cancelar</Button>
          </ScrollView>
        )}
      </NativeModal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f0f0' },
  card: { marginBottom: 10, backgroundColor: 'white' },
  fab: { position: 'absolute', margin: 16, right: 0, bottom: 0, backgroundColor: '#F36F21' },
  input: { marginBottom: 15, backgroundColor: 'white' }
});