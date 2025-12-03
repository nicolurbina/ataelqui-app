import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert, TouchableOpacity, Platform, ActivityIndicator } from 'react-native';
import { Text, Button, TextInput, Chip, RadioButton, Modal, Portal, List, IconButton } from 'react-native-paper';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { collection, addDoc, query, where, getDocs } from 'firebase/firestore';
import DateTimePicker from '@react-native-community/datetimepicker';
import { db } from '../../firebaseConfig';

export default function ScannerScreen({ route, navigation }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);

  // ESTADOS DEL FORMULARIO
  const [showForm, setShowForm] = useState(false);
  const [isManual, setIsManual] = useState(false);
  const [scanningForSku, setScanningForSku] = useState(false); // NUEVO ESTADO

  const [currentSku, setCurrentSku] = useState('');
  const [name, setName] = useState('');

  const [category, setCategory] = useState('');
  const [showCatPicker, setShowCatPicker] = useState(false);
  const CATEGORIES = ["Insumos", "Grasas", "Repostería", "Lácteos"];

  const [provider, setProvider] = useState('');
  const [aisle, setAisle] = useState('');
  const [quantity, setQuantity] = useState('');

  const [format, setFormat] = useState('suelto');
  const [unitsPerBox, setUnitsPerBox] = useState('');

  // LÓGICA DE FECHAS
  const [stickyDate, setStickyDate] = useState(new Date());
  const [expiryDate, setExpiryDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);

  useEffect(() => { if (!permission) requestPermission(); }, [permission]);

  const resetFormFields = () => {
    setName(''); setCategory(''); setProvider(''); setQuantity('');
    setUnitsPerBox(''); setFormat('suelto');
    setExpiryDate(stickyDate);
  };

  const handleManualEntry = () => {
    setScanned(true);
    setIsManual(true);
    setCurrentSku('');
    resetFormFields();
    setShowForm(true);
  };

  // EFECTO PARA ABRIR MANUALMENTE DESDE OTRA PANTALLA
  useEffect(() => {
    if (route?.params?.openManual) {
      handleManualEntry();
      if (navigation) {
        navigation.setParams({ openManual: undefined });
      }
    }
  }, [route?.params]);

  const handleBarCodeScanned = async ({ data }) => {
    setScanned(true);

    // NUEVA LÓGICA: Si estamos escaneando solo para el SKU
    if (scanningForSku) {
      setCurrentSku(data);
      setScanningForSku(false);
      setShowForm(true); // Volvemos al formulario
      return;
    }

    setLoading(true);
    await checkSkuAndOpenForm(data);
  };

  const startSkuScan = () => {
    setScanningForSku(true);
    setShowForm(false); // Ocultamos formulario
    setScanned(false);  // Activamos cámara
  };

  const checkSkuAndOpenForm = async (skuToCheck) => {
    try {
      const q = query(collection(db, "products"), where("sku", "==", skuToCheck));
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        Alert.alert("Producto Existe", "Ya registrado.", [{ text: "OK", onPress: () => { setScanned(false); setLoading(false); } }]);
      } else {
        setIsManual(false);
        setCurrentSku(skuToCheck);
        resetFormFields();
        setLoading(false);
        setShowForm(true);
      }
    } catch (e) {
      Alert.alert("Error", e.message);
      setScanned(false);
      setLoading(false);
    }
  };

  const onDateChange = (event, selectedDate) => {
    setShowPicker(false);
    if (selectedDate) {
      setExpiryDate(selectedDate);
    }
  };

  const handleSaveProduct = async () => {
    if (!currentSku || !name || !quantity || !aisle || !category) return Alert.alert("Faltan Datos", "Verifica Categoría y otros campos.");

    setLoading(true);
    try {
      let totalStock = parseInt(quantity);
      let details = "Unidad Suelta";
      if (format === 'caja') {
        if (!unitsPerBox) { setLoading(false); return Alert.alert("Error", "Indica unidades por caja."); }
        totalStock = parseInt(quantity) * parseInt(unitsPerBox);
        details = `Caja de ${unitsPerBox} un.`;
      }

      const dateString = expiryDate.toISOString().split('T')[0];

      await addDoc(collection(db, "products"), {
        sku: currentSku, name,
        category: category,
        provider, aisle,
        stock: totalStock, format, unitsPerBox: format === 'caja' ? parseInt(unitsPerBox) : 1,
        expiryDate: dateString,
        status: totalStock < 5 ? "Crítico" : "Saludable", createdAt: new Date()
      });

      await addDoc(collection(db, "kardex"), {
        sku: currentSku, productName: name, type: "Entrada",
        quantity: totalStock, reason: "Ingreso (" + details + ")", date: new Date(), user: "Bodeguero"
      });

      setStickyDate(expiryDate);

      Alert.alert("¡Guardado!", "Listo para el siguiente.", [
        { text: "OK", onPress: () => { setShowForm(false); setScanned(false); } }
      ]);
    } catch (e) { Alert.alert("Error", e.message); } finally { setLoading(false); }
  };

  if (!permission?.granted) return <View style={styles.center}><Button onPress={requestPermission}>Dar Permiso</Button></View>;

  if (showForm) {
    return (
      <View style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 40, backgroundColor: '#fff', flexGrow: 1 }}>
          <Text variant="headlineSmall" style={{ color: '#F36F21', fontWeight: 'bold', marginBottom: 10 }}>Ingreso de Producto</Text>

          {isManual ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <TextInput label="SKU" value={currentSku} onChangeText={setCurrentSku} mode="outlined" style={[styles.input, { flex: 1, marginBottom: 0 }]} />
              <IconButton icon="barcode-scan" mode="contained" containerColor="#F36F21" iconColor="white" size={30} onPress={startSkuScan} />
            </View>
          ) : (
            <Chip icon="barcode" style={{ marginBottom: 15 }}>SKU: {currentSku}</Chip>
          )}

          <TextInput label="Nombre" value={name} onChangeText={setName} mode="outlined" style={styles.input} />

          <View style={{ flexDirection: 'row', gap: 10 }}>
            {/* SELECTOR DE CATEGORÍA */}
            <View style={{ flex: 1 }}>
              <TouchableOpacity onPress={() => setShowCatPicker(true)}>
                <TextInput
                  label="Categoría"
                  value={category}
                  mode="outlined"
                  editable={false}
                  right={<TextInput.Icon icon="chevron-down" onPress={() => setShowCatPicker(true)} />}
                  style={[styles.input, { backgroundColor: 'white' }]}
                />
              </TouchableOpacity>
            </View>
            <TextInput label="Proveedor" value={provider} onChangeText={setProvider} mode="outlined" style={[styles.input, { flex: 1 }]} />
          </View>

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TextInput label="Pasillo" value={aisle} onChangeText={setAisle} mode="outlined" style={[styles.input, { flex: 1 }]} />

            <TouchableOpacity onPress={() => setShowPicker(true)} style={{ flex: 1 }}>
              <TextInput
                label="Vencimiento"
                value={expiryDate.toLocaleDateString()}
                mode="outlined"
                editable={false}
                right={<TextInput.Icon icon="calendar" onPress={() => setShowPicker(true)} />}
                style={[styles.input, { backgroundColor: '#FFF3E0' }]}
              />
            </TouchableOpacity>
          </View>

          {showPicker && (
            <DateTimePicker value={expiryDate} mode="date" display="default" onChange={onDateChange} />
          )}

          <RadioButton.Group onValueChange={setFormat} value={format}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
              <RadioButton value="suelto" color="#F36F21" /><Text>Unidad</Text>
              <View style={{ width: 20 }} />
              <RadioButton value="caja" color="#F36F21" /><Text>Caja</Text>
            </View>
          </RadioButton.Group>

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TextInput label={format === 'caja' ? "N° Cajas" : "Cantidad"} value={quantity} onChangeText={setQuantity} keyboardType="numeric" mode="outlined" style={[styles.input, { flex: 1 }]} />
            {format === 'caja' && <TextInput label="Unid/Caja" value={unitsPerBox} onChangeText={setUnitsPerBox} keyboardType="numeric" mode="outlined" style={[styles.input, { flex: 1 }]} />}
          </View>

          <Button mode="contained" onPress={handleSaveProduct} loading={loading} buttonColor="#F36F21" style={{ marginTop: 20 }}>Guardar y Seguir</Button>
          <Button mode="text" onPress={() => { setShowForm(false); setScanned(false); }} style={{ marginTop: 10 }}>Cancelar</Button>
        </ScrollView>

        {/* MODAL PARA SELECCIONAR CATEGORÍA */}
        <Portal>
          <Modal visible={showCatPicker} onDismiss={() => setShowCatPicker(false)} contentContainerStyle={styles.modal}>
            <Text variant="titleMedium" style={{ marginBottom: 15, textAlign: 'center' }}>Selecciona Categoría</Text>
            {CATEGORIES.map((cat) => (
              <List.Item
                key={cat}
                title={cat}
                onPress={() => { setCategory(cat); setShowCatPicker(false); }}
                left={props => <List.Icon {...props} icon="tag-outline" />}
              />
            ))}
          </Modal>
        </Portal>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: 'black' }}>
      {!scanned && !loading ? <CameraView style={StyleSheet.absoluteFillObject} facing="back" onBarcodeScanned={handleBarCodeScanned} /> : <View style={styles.center}><ActivityIndicator size="large" color="#F36F21" /></View>}
      {!scanned && !loading && (
        <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <View style={{ width: 250, height: 250, borderWidth: 2, borderColor: 'white', borderRadius: 20 }} />
            <Text style={{ color: 'white', marginTop: 20, backgroundColor: 'rgba(0,0,0,0.6)', padding: 5 }}>
              {scanningForSku ? "Escanea el SKU" : "Escanea Código"}
            </Text>
          </View>
          <View style={{ padding: 20, paddingBottom: 40 }}>
            {scanningForSku ? (
              <Button mode="contained" buttonColor="#D32F2F" onPress={() => { setScanningForSku(false); setShowForm(true); setScanned(true); }}>Cancelar Escaneo</Button>
            ) : (
              <Button mode="contained" icon="keyboard" buttonColor="white" textColor="#F36F21" onPress={handleManualEntry}>Ingreso Manual</Button>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  input: { marginBottom: 10, backgroundColor: 'white' },
  modal: { backgroundColor: 'white', padding: 20, margin: 40, borderRadius: 10 }
});