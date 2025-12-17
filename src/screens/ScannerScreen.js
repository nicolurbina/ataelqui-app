import DateTimePicker from '@react-native-community/datetimepicker';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { addDoc, collection, getDocs, onSnapshot, query, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { ActivityIndicator, Button, Divider, IconButton, List, Modal, Portal, RadioButton, Text, TextInput } from 'react-native-paper';
import { db } from '../../firebaseConfig';

// --- COMPONENTE REUTILIZABLE: SELECTION MODAL ---
const SelectionModal = ({ visible, hide, title, items, onSelect, renderItem }) => {
  return (
    <Portal>
      <Modal visible={visible} onDismiss={hide} contentContainerStyle={styles.modal}>
        <Text variant="titleMedium" style={{ marginBottom: 15, textAlign: 'center', fontWeight: 'bold', color: '#F36F21' }}>{title}</Text>
        <ScrollView style={{ maxHeight: 300 }}>
          {items.length === 0 ? (
            <Text style={{ textAlign: 'center', color: '#666', padding: 20 }}>No hay opciones disponibles.</Text>
          ) : (
            items.map((item, index) => (
              <React.Fragment key={index}>
                {renderItem ? (
                  renderItem(item, () => { onSelect(item); hide(); })
                ) : (
                  <List.Item
                    title={item}
                    onPress={() => { onSelect(item); hide(); }}
                    left={props => <List.Icon {...props} icon="chevron-right" color="#F36F21" />}
                  />
                )}
                <Divider />
              </React.Fragment>
            ))
          )}
        </ScrollView>
        <Button mode="text" onPress={hide} style={{ marginTop: 10 }}>Cerrar</Button>
      </Modal>
    </Portal>
  );
};

export default function ScannerScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Form Data
  const [currentSku, setCurrentSku] = useState('');
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [category, setCategory] = useState('');
  const [provider, setProvider] = useState('');
  const [location, setLocation] = useState('');
  const [minStock, setMinStock] = useState('10');

  // Dropdown States
  const [showCatMenu, setShowCatMenu] = useState(false);
  const [showLocMenu, setShowLocMenu] = useState(false);
  const [showProviderMenu, setShowProviderMenu] = useState(false);
  const [providers, setProviders] = useState([]);

  const CATEGORIES = ["Insumos", "Grasas", "Repostería", "Lácteos", "Harinas", "Otros"];
  const WAREHOUSES = ["Bodega 1", "Bodega 2", "Bodega 3", "Bodega 4", "Bodega 5", "Cámara de Frío"];

  useEffect(() => {
    const u = onSnapshot(collection(db, "providers"), (s) => setProviders(s.docs.map(d => d.data().name)));
    return () => u();
  }, []);

  // Logic for Boxes
  const [format, setFormat] = useState('unidad'); // unidad | caja
  const [boxCount, setBoxCount] = useState('');
  const [unitsPerBox, setUnitsPerBox] = useState('');
  const [singleQty, setSingleQty] = useState('');

  // Expiry Date
  const [expiryDate, setExpiryDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [stickyDate, setStickyDate] = useState(null); // Remember last date

  // Manual Entry
  const [isManual, setIsManual] = useState(false);

  const handleBarCodeScanned = async ({ type, data }) => {
    setScanned(true);
    setCurrentSku(data);
    setLoading(true);
    try {
      // Check if exists
      const q = query(collection(db, "products"), where("sku", "==", data));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const p = snapshot.docs[0].data();
        setName(p.name);
        setBrand(p.brand || '');
        setCategory(p.category);
        setProvider(p.provider);
        setLocation(p.location);
        setMinStock(String(p.minStock || 10));
        // Pre-fill last date if available
        if (stickyDate) setExpiryDate(stickyDate);
      } else {
        // New product
        setName(''); setBrand(''); setCategory(''); setProvider(''); setLocation(''); setMinStock('10');
        if (stickyDate) setExpiryDate(stickyDate);
      }
      setShowForm(true);
    } catch (e) {
      Alert.alert("Error", e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleManualEntry = () => {
    setScanned(true);
    setIsManual(true);
    setCurrentSku('');
    setShowForm(true);
    if (stickyDate) setExpiryDate(stickyDate);
  };

  const handleSaveProduct = async () => {
    // 1. Validate All Required Fields (Strict)
    if (!currentSku || currentSku.trim() === '') return Alert.alert("Error", "El SKU es obligatorio.");
    if (!category || category.trim() === '') return Alert.alert("Error", "La Categoría es obligatoria.");
    if (!brand || brand.trim() === '') return Alert.alert("Error", "La Marca es obligatoria.");
    if (!name || name.trim() === '') return Alert.alert("Error", "El Nombre del Producto es obligatorio.");
    if (!provider || provider.trim() === '') return Alert.alert("Error", "El Proveedor es obligatorio.");
    if (!location || location.trim() === '') return Alert.alert("Error", "La Bodega es obligatoria.");
    if (!minStock || minStock.trim() === '') return Alert.alert("Error", "El Stock Mínimo es obligatorio.");

    let totalQty = 0;
    let details = "";

    if (format === 'unidad') {
      if (!singleQty || singleQty.trim() === '') return Alert.alert("Error", "La Cantidad es obligatoria.");
      totalQty = parseInt(singleQty);
      details = `${totalQty} un.`;
    } else {
      if (!boxCount || boxCount.trim() === '') return Alert.alert("Error", "El N° de Cajas es obligatorio.");
      if (!unitsPerBox || unitsPerBox.trim() === '') return Alert.alert("Error", "Las Unidades por Caja son obligatorias.");
      const boxes = parseInt(boxCount);
      const perBox = parseInt(unitsPerBox);
      if (!boxes || !perBox) return Alert.alert("Error", "Datos de caja inválidos.");
      totalQty = boxes * perBox;
      details = `${boxes} cajas x ${perBox} un.`;
    }

    if (!totalQty || totalQty <= 0) return Alert.alert("Error", "Cantidad inválida (debe ser mayor a 0).");

    setLoading(true);
    try {
      const dateString = expiryDate.toISOString().split('T')[0];

      // GUARDAR (FORMATO HÍBRIDO APP + API)
      await addDoc(collection(db, "products"), {
        sku: currentSku, name, brand, category, provider,
        location: location, // API usa location
        aisle: location,    // Guardamos aisle también por si acaso tu app vieja lo busca

        stock: totalQty,    // App usa stock
        quantity: totalQty, // API usa quantity
        minStock: parseInt(minStock) || 10,

        format, unitsPerBox: format === 'caja' ? parseInt(unitsPerBox) : 1,
        expiryDate: dateString,
        status: totalQty < 5 ? "Crítico" : "Saludable", createdAt: new Date(), updatedAt: new Date()
      });

      await addDoc(collection(db, "kardex"), {
        sku: currentSku, productName: name, type: "Entrada",
        quantity: totalQty, reason: "Ingreso (" + details + ")", date: new Date(), user: "Bodeguero"
      });

      // GENERATE PERSISTENT ALERTS
      const today = new Date();
      // 1. Stock
      if (totalQty <= 10) {
        await addDoc(collection(db, "notifications"), {
          title: 'Stock Crítico',
          desc: `Quedan solo ${totalQty} unidades de ${name}.`,
          type: 'Stock',
          color: '#FBC02D',
          icon: 'package-variant',
          date: new Date(),
          isSystem: true
        });
      }
      // 2. Expiry
      const expDate = new Date(dateString); // dateString is YYYY-MM-DD
      const diffDays = Math.ceil((expDate - today) / (1000 * 60 * 60 * 24));
      if (diffDays < 0) {
        await addDoc(collection(db, "notifications"), {
          title: 'Producto Vencido',
          desc: `${name} venció hace ${Math.abs(diffDays)} días.`,
          type: 'FEFO',
          color: '#D32F2F',
          icon: 'calendar-clock',
          date: new Date(),
          isSystem: true
        });
      } else if (diffDays <= 7) {
        await addDoc(collection(db, "notifications"), {
          title: 'Riesgo Vencimiento',
          desc: `${name} vence en ${diffDays} días.`,
          type: 'FEFO',
          color: '#F57C00',
          icon: 'calendar-clock',
          date: new Date(),
          isSystem: true
        });
      }

      setStickyDate(expiryDate);

      Alert.alert("¡Guardado!", "Sincronizado con Web/API.", [
        { text: "OK", onPress: () => { setShowForm(false); setScanned(false); } }
      ]);
    } catch (e) { Alert.alert("Error", e.message); } finally { setLoading(false); }
  };

  if (!permission?.granted) return <View style={styles.center}><Button onPress={requestPermission}>Dar Permiso</Button></View>;

  if (showForm) {
    return (
      <View style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 40, backgroundColor: '#fff', flexGrow: 1 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
            <Text variant="headlineSmall" style={{ fontWeight: 'bold', color: '#333' }}>Nuevo Producto</Text>
            <IconButton icon="close" size={24} onPress={() => { setShowForm(false); setScanned(false); setIsManual(false); }} />
          </View>

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>SKU</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <TextInput value={currentSku} onChangeText={setCurrentSku} mode="outlined" placeholder="Ej: PAN-001" style={[styles.input, { flex: 1 }]} dense />
                <IconButton icon="barcode-scan" iconColor="#F36F21" size={28} onPress={() => { setShowForm(false); setScanned(false); }} />
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Categoría</Text>
              <TouchableOpacity onPress={() => setShowCatMenu(true)}>
                <TextInput value={category} mode="outlined" placeholder="Seleccionar" editable={false} right={<TextInput.Icon icon="chevron-down" />} style={styles.input} dense />
              </TouchableOpacity>
              <SelectionModal
                visible={showCatMenu}
                hide={() => setShowCatMenu(false)}
                title="Seleccionar Categoría"
                items={CATEGORIES}
                onSelect={setCategory}
              />
            </View>
          </View>

          <Text style={styles.label}>Marca</Text>
          <TextInput value={brand} onChangeText={setBrand} mode="outlined" placeholder="Ej: Selecta" style={styles.input} dense />

          <Text style={styles.label}>Nombre del Producto</Text>
          <TextInput value={name} onChangeText={setName} mode="outlined" placeholder="Ej: Harina Selecta 25kg" style={styles.input} dense />

          <Text style={styles.label}>Proveedor</Text>
          <TouchableOpacity onPress={() => setShowProviderMenu(true)}>
            <TextInput value={provider} mode="outlined" placeholder="Seleccionar" editable={false} right={<TextInput.Icon icon="chevron-down" />} style={styles.input} dense />
          </TouchableOpacity>
          <SelectionModal
            visible={showProviderMenu}
            hide={() => setShowProviderMenu(false)}
            title="Seleccionar Proveedor"
            items={providers || []}
            onSelect={setProvider}
          />

          <Text style={styles.label}>Bodega</Text>
          <TouchableOpacity onPress={() => setShowLocMenu(true)}>
            <TextInput value={location} mode="outlined" placeholder="Seleccionar" editable={false} right={<TextInput.Icon icon="chevron-down" />} style={styles.input} dense />
          </TouchableOpacity>
          <SelectionModal
            visible={showLocMenu}
            hide={() => setShowLocMenu(false)}
            title="Seleccionar Bodega"
            items={WAREHOUSES}
            onSelect={setLocation}
          />

          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10, marginTop: 5 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 20 }}>
              <RadioButton value="unidad" status={format === 'unidad' ? 'checked' : 'unchecked'} onPress={() => setFormat('unidad')} color="#F36F21" />
              <Text onPress={() => setFormat('unidad')}>Unidad</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <RadioButton value="caja" status={format === 'caja' ? 'checked' : 'unchecked'} onPress={() => setFormat('caja')} color="#F36F21" />
              <Text onPress={() => setFormat('caja')}>Caja</Text>
            </View>
          </View>

          {format === 'unidad' ? (
            <>
              <Text style={styles.label}>Cantidad</Text>
              <TextInput value={singleQty} onChangeText={setSingleQty} keyboardType="numeric" mode="outlined" placeholder="0" style={styles.input} dense />
            </>
          ) : (
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>N° Cajas</Text>
                <TextInput value={boxCount} onChangeText={setBoxCount} keyboardType="numeric" mode="outlined" placeholder="0" style={styles.input} dense />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Unid/Caja</Text>
                <TextInput value={unitsPerBox} onChangeText={setUnitsPerBox} keyboardType="numeric" mode="outlined" placeholder="0" style={styles.input} dense />
              </View>
            </View>
          )}

          <TouchableOpacity onPress={() => setShowDatePicker(true)} style={{ marginTop: 10, marginBottom: 10 }}>
            <TextInput
              label="Fecha Vencimiento"
              value={expiryDate.toLocaleDateString()}
              editable={false}
              mode="outlined"
              right={<TextInput.Icon icon="calendar" />}
              style={styles.input}
              dense
            />
          </TouchableOpacity>
          {showDatePicker && (
            <DateTimePicker
              value={expiryDate}
              mode="date"
              display="default"
              onChange={(event, selectedDate) => {
                setShowDatePicker(false);
                if (selectedDate) setExpiryDate(selectedDate);
              }}
            />
          )}

          <Text style={styles.label}>Stock Mínimo</Text>
          <TextInput value={minStock} onChangeText={setMinStock} keyboardType="numeric" mode="outlined" placeholder="0" style={styles.input} dense />

          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
            <Button mode="outlined" onPress={() => { setShowForm(false); setScanned(false); setIsManual(false); }} textColor="#666" style={{ borderColor: '#ccc' }}>Cancelar</Button>
            <Button mode="contained" onPress={handleSaveProduct} loading={loading} buttonColor="#F36F21">Guardar Producto</Button>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {loading && <ActivityIndicator size="large" color="#F36F21" style={styles.loading} />}
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
      />
      <View style={styles.overlay}>
        <Text style={styles.text}>Escanea el código de barras</Text>
        <Button mode="contained" icon="keyboard" onPress={handleManualEntry} style={{ marginTop: 20, backgroundColor: 'rgba(255,255,255,0.2)' }}>
          Ingreso Manual
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', backgroundColor: 'black' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  overlay: { position: 'absolute', bottom: 50, left: 0, right: 0, alignItems: 'center' },
  text: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  input: { marginBottom: 10, backgroundColor: 'white' },
  loading: { position: 'absolute', top: '50%', left: '50%', zIndex: 10 },
  modal: { backgroundColor: 'white', padding: 20, margin: 20, borderRadius: 10, maxHeight: '80%' },
  label: { fontWeight: 'bold', marginBottom: 5, color: '#333' }
});